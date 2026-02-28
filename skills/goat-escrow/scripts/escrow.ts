import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from skill directory, then fall back to project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const RPC_URL = process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;

if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY not set");
  process.exit(1);
}
if (!CONTRACT_ADDRESS) {
  console.error("ERROR: ESCROW_CONTRACT_ADDRESS not set");
  process.exit(1);
}

const ABI = [
  "function createEscrow(address seller, string calldata description) external payable returns (uint256)",
  "function confirmDelivery(uint256 escrowId) external",
  "function refund(uint256 escrowId) external",
  "function getEscrow(uint256 escrowId) external view returns (address buyer, address seller, uint256 amount, string description, uint8 status, uint256 createdAt, uint256 timeout)",
  "function nextEscrowId() external view returns (uint256)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, string description)",
  "event EscrowCompleted(uint256 indexed escrowId, address indexed seller, uint256 amount)",
  "event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount)",
];

const STATUS_LABELS = ["Active", "Completed", "Refunded"];

const provider = new ethers.JsonRpcProvider(RPC_URL, {
  name: "goat-testnet3",
  chainId: 48816,
});
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

async function createEscrow(seller: string, amountBTC: string, description: string) {
  const value = ethers.parseEther(amountBTC);
  console.log(`Creating escrow: ${amountBTC} BTC to ${seller} for "${description}"...`);

  const tx = await contract.createEscrow(seller, description, { value });
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  const event = receipt.logs.find((log: any) => {
    try {
      return contract.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "EscrowCreated";
    } catch {
      return false;
    }
  });

  let escrowId = "unknown";
  if (event) {
    const parsed = contract.interface.parseLog({ topics: event.topics as string[], data: event.data });
    escrowId = parsed?.args[0].toString() || "unknown";
  }

  console.log(JSON.stringify({
    success: true,
    escrowId,
    txHash: tx.hash,
    buyer: wallet.address,
    seller,
    amount: amountBTC,
    description,
  }));
}

async function getStatus(escrowId: string) {
  const [buyer, seller, amount, description, status, createdAt, timeout] =
    await contract.getEscrow(escrowId);

  console.log(JSON.stringify({
    escrowId,
    buyer,
    seller,
    amount: ethers.formatEther(amount),
    description,
    status: STATUS_LABELS[status],
    createdAt: new Date(Number(createdAt) * 1000).toISOString(),
    timeoutSeconds: Number(timeout),
  }));
}

async function confirmDelivery(escrowId: string) {
  console.log(`Confirming delivery for escrow #${escrowId}...`);
  const tx = await contract.confirmDelivery(escrowId);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log(JSON.stringify({ success: true, escrowId, txHash: tx.hash, action: "confirmed" }));
}

async function requestRefund(escrowId: string) {
  console.log(`Requesting refund for escrow #${escrowId}...`);
  const tx = await contract.refund(escrowId);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log(JSON.stringify({ success: true, escrowId, txHash: tx.hash, action: "refunded" }));
}

const [, , action, ...args] = process.argv;

switch (action) {
  case "create":
    if (args.length < 3) {
      console.error("Usage: escrow.ts create <sellerAddress> <amountBTC> <description>");
      process.exit(1);
    }
    createEscrow(args[0], args[1], args.slice(2).join(" ")).catch(console.error);
    break;
  case "status":
    if (!args[0]) {
      console.error("Usage: escrow.ts status <escrowId>");
      process.exit(1);
    }
    getStatus(args[0]).catch(console.error);
    break;
  case "confirm":
    if (!args[0]) {
      console.error("Usage: escrow.ts confirm <escrowId>");
      process.exit(1);
    }
    confirmDelivery(args[0]).catch(console.error);
    break;
  case "refund":
    if (!args[0]) {
      console.error("Usage: escrow.ts refund <escrowId>");
      process.exit(1);
    }
    requestRefund(args[0]).catch(console.error);
    break;
  default:
    console.error("Usage: escrow.ts <create|status|confirm|refund> [args]");
    process.exit(1);
}
