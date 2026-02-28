// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Escrow is ReentrancyGuard {
    enum Status { Active, Completed, Refunded }

    struct EscrowData {
        address buyer;
        address seller;
        uint256 amount;
        string description;
        Status status;
        uint256 createdAt;
        uint256 timeout;
    }

    uint256 public nextEscrowId;
    uint256 public constant DEFAULT_TIMEOUT = 7 days;

    mapping(uint256 => EscrowData) public escrows;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        string description
    );
    event EscrowCompleted(uint256 indexed escrowId, address indexed seller, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);

    /// @notice Create an escrow by locking BTC. Caller is the buyer.
    function createEscrow(address seller, string calldata description) external payable returns (uint256) {
        require(msg.value > 0, "Must send BTC");
        require(seller != address(0), "Invalid seller");
        uint256 escrowId = nextEscrowId++;

        escrows[escrowId] = EscrowData({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            description: description,
            status: Status.Active,
            createdAt: block.timestamp,
            timeout: DEFAULT_TIMEOUT
        });

        emit EscrowCreated(escrowId, msg.sender, seller, msg.value, description);
        return escrowId;
    }

    /// @notice Buyer confirms delivery, releasing funds to seller.
    function confirmDelivery(uint256 escrowId) external nonReentrant {
        EscrowData storage e = escrows[escrowId];
        require(e.status == Status.Active, "Not active");
        require(msg.sender == e.buyer, "Only buyer");

        e.status = Status.Completed;

        (bool sent, ) = e.seller.call{value: e.amount}("");
        require(sent, "Transfer failed");

        emit EscrowCompleted(escrowId, e.seller, e.amount);
    }

    /// @notice Refund buyer after timeout has passed. Anyone can call.
    function refund(uint256 escrowId) external nonReentrant {
        EscrowData storage e = escrows[escrowId];
        require(e.status == Status.Active, "Not active");
        require(block.timestamp >= e.createdAt + e.timeout, "Timeout not reached");

        e.status = Status.Refunded;

        (bool sent, ) = e.buyer.call{value: e.amount}("");
        require(sent, "Transfer failed");

        emit EscrowRefunded(escrowId, e.buyer, e.amount);
    }

    /// @notice Get escrow details.
    function getEscrow(uint256 escrowId) external view returns (
        address buyer,
        address seller,
        uint256 amount,
        string memory description,
        Status status,
        uint256 createdAt,
        uint256 timeout
    ) {
        EscrowData storage e = escrows[escrowId];
        return (e.buyer, e.seller, e.amount, e.description, e.status, e.createdAt, e.timeout);
    }
}
