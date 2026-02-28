---
name: clawbay-marketplace
description: Browse and list items for sale on ClawBay P2P marketplace, and buy items with BTC escrow on GOAT Network. Use when the user wants to list something for sale, browse listings, buy an item, or manage their ClawBay marketplace listings.
---

# ClawBay Marketplace

P2P marketplace for trading physical goods with BTC escrow on GOAT Network.

## Setup

Requires environment variables in `~/.openclaw/skills/clawbay-marketplace/.env`:
- `CLAWBAY_SERVER_URL` — ClawBay server URL (default: `http://localhost:3000`)
- `GOAT_RPC_URL` — RPC endpoint (default: `https://rpc.testnet3.goat.network`)
- `PRIVATE_KEY` — Wallet private key
- `ESCROW_CONTRACT_ADDRESS` — Deployed Escrow contract address

## Available Actions

### List an Item for Sale

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts list <item> <priceBTC> <sellerAddress> [description]
```

Example:
```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts list "AirPods Pro" 0.001 0xABC123... "Like new, with case"
```

To get the seller's address, use the goat-wallet skill first.

### Browse Listings

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts browse
```

Shows all active listings with item name, price, and seller.

### Get Listing Details

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts details <listingId>
```

### Buy an Item

This creates an on-chain escrow and updates the listing status:

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts buy <listingId>
```

This will:
1. Fetch the listing details from the server
2. Create an escrow on GOAT Network (locks BTC in smart contract)
3. Update the listing status to "sold"

The buyer's wallet is determined by PRIVATE_KEY.

### Cancel a Listing

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts cancel <listingId>
```

## Typical Flow

1. **Seller**: "List my AirPods for 0.001 BTC" → use `list` action
2. **Buyer**: "What's for sale?" → use `browse` action
3. **Buyer**: "Buy the AirPods" → use `buy` action (creates escrow)
4. **Buyer**: "I got the item" → use goat-escrow skill's `confirm` action
5. If no confirmation → use goat-escrow skill's `refund` action after timeout

## Formatting

When displaying listings, format them nicely:
- Show item name, price in BTC, and seller address (truncated)
- If listing has an escrow ID, show escrow status
- Link to explorer for transaction verification
