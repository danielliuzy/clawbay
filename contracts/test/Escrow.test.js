const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Escrow", function () {
  let escrow, buyer, seller, other;
  const AMOUNT = ethers.parseEther("0.001");
  const DESCRIPTION = "AirPods Pro";

  beforeEach(async function () {
    [buyer, seller, other] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
  });

  describe("createEscrow", function () {
    it("should create an escrow", async function () {
      const tx = await escrow.connect(buyer).createEscrow(seller.address, DESCRIPTION, { value: AMOUNT });
      const receipt = await tx.wait();

      const e = await escrow.getEscrow(0);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.amount).to.equal(AMOUNT);
      expect(e.description).to.equal(DESCRIPTION);
      expect(e.status).to.equal(0); // Active
    });

    it("should emit EscrowCreated event", async function () {
      await expect(escrow.connect(buyer).createEscrow(seller.address, DESCRIPTION, { value: AMOUNT }))
        .to.emit(escrow, "EscrowCreated")
        .withArgs(0, buyer.address, seller.address, AMOUNT, DESCRIPTION);
    });

    it("should reject zero value", async function () {
      await expect(escrow.connect(buyer).createEscrow(seller.address, DESCRIPTION, { value: 0 }))
        .to.be.revertedWith("Must send BTC");
    });

    it("should allow self-escrow", async function () {
      await escrow.connect(buyer).createEscrow(buyer.address, DESCRIPTION, { value: AMOUNT });
      const e = await escrow.getEscrow(0);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(buyer.address);
    });
  });

  describe("confirmDelivery", function () {
    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, DESCRIPTION, { value: AMOUNT });
    });

    it("should release funds to seller", async function () {
      const balBefore = await ethers.provider.getBalance(seller.address);
      await escrow.connect(buyer).confirmDelivery(0);
      const balAfter = await ethers.provider.getBalance(seller.address);

      expect(balAfter - balBefore).to.equal(AMOUNT);

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(1); // Completed
    });

    it("should reject non-buyer", async function () {
      await expect(escrow.connect(seller).confirmDelivery(0))
        .to.be.revertedWith("Only buyer");
    });

    it("should reject double confirm", async function () {
      await escrow.connect(buyer).confirmDelivery(0);
      await expect(escrow.connect(buyer).confirmDelivery(0))
        .to.be.revertedWith("Not active");
    });
  });

  describe("refund", function () {
    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, DESCRIPTION, { value: AMOUNT });
    });

    it("should refund after timeout", async function () {
      await time.increase(7 * 24 * 60 * 60); // 7 days

      const balBefore = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(other).refund(0);
      const balAfter = await ethers.provider.getBalance(buyer.address);

      expect(balAfter - balBefore).to.equal(AMOUNT);

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(2); // Refunded
    });

    it("should reject before timeout", async function () {
      await expect(escrow.connect(other).refund(0))
        .to.be.revertedWith("Timeout not reached");
    });
  });
});
