const { Router } = require("express");
const crypto = require("crypto");

const router = Router();

// In-memory storage
const listings = new Map();

router.post("/", (req, res) => {
  const { item, price, sellerAddress, description } = req.body;
  if (!item || !price || !sellerAddress) {
    return res.status(400).json({ error: "item, price, and sellerAddress are required" });
  }

  const id = crypto.randomUUID();
  const listing = {
    id,
    item,
    price,
    sellerAddress,
    description: description || "",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  listings.set(id, listing);
  res.status(201).json(listing);
});

router.get("/", (req, res) => {
  const { status } = req.query;
  let results = Array.from(listings.values());
  if (status) {
    results = results.filter((l) => l.status === status);
  }
  res.json(results);
});

router.get("/:id", (req, res) => {
  const listing = listings.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  res.json(listing);
});

router.patch("/:id", (req, res) => {
  const listing = listings.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const { status, escrowId, buyerAddress } = req.body;
  if (status) listing.status = status;
  if (escrowId !== undefined) listing.escrowId = escrowId;
  if (buyerAddress) listing.buyerAddress = buyerAddress;

  listings.set(req.params.id, listing);
  res.json(listing);
});

router.delete("/:id", (req, res) => {
  if (!listings.has(req.params.id)) {
    return res.status(404).json({ error: "Listing not found" });
  }
  listings.delete(req.params.id);
  res.status(204).send();
});

module.exports = router;
