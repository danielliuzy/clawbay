---
name: clawbay-marketplace
description: Browse and list items for sale on ClawBay P2P marketplace, and buy items with BTC escrow on GOAT Network. Requires a product image for listings (uploaded to Blossom). Use when the user wants to list something for sale with a photo, browse listings, buy an item, or manage their ClawBay marketplace listings.
---

# ClawBay Marketplace

P2P marketplace for trading physical goods with BTC escrow on GOAT Network. Listings are stored on Nostr (decentralized, persistent) using NIP-99 Classified Listings (kind 30402).

## Setup

Requires environment variables in `~/.openclaw/skills/clawbay-marketplace/.env`:
- `PRIVATE_KEY` — Wallet private key (also used to derive Nostr identity — same secp256k1 curve)
- `ESCROW_CONTRACT_ADDRESS` — Deployed Escrow contract address
- `GOAT_RPC_URL` — RPC endpoint (default: `https://rpc.testnet3.goat.network`)
- `NOSTR_RELAYS` — Comma-separated relay URLs (default: `wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band`)

Your Nostr identity is automatically derived from your ETH private key — no separate Nostr key needed.

## Available Actions

### List an Item for Sale

**Requires an image.** If the user wants to list an item, they must provide a photo.

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts list <item> <priceBTC> <sellerAddress> [description] --image /path/to/image
```

Example:
```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts list "AirPods Pro" 0.001 0xABC123... "Like new, with case" --image /path/to/photo.jpg
```

The image will be uploaded to Blossom (blossom.nostr.build) and the URL stored in the listing.

To get the seller's address, use the goat-wallet skill first.

**Important:** If the user tries to list without an image, ask them to provide a photo first.

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

This creates an on-chain escrow and updates the listing status on Nostr:

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts buy <listingId>
```

This will:
1. Fetch the listing from Nostr relays
2. Create an escrow on GOAT Network (locks BTC in smart contract)
3. Republish the listing on Nostr with status "sold" and escrow metadata

The buyer's wallet is determined by PRIVATE_KEY.

### Cancel a Listing

```bash
npx ts-node ~/.openclaw/skills/clawbay-marketplace/scripts/marketplace.ts cancel <listingId>
```

Republishes the listing on Nostr with status "cancelled".

## Typical Flow

1. **Seller**: "List my AirPods for 0.001 BTC" → use `list` action
2. **Buyer**: "What's for sale?" → use `browse` action
3. **Buyer**: "Buy the AirPods" → use `buy` action (creates escrow)
4. **Buyer**: "I got the item" → use goat-escrow skill's `confirm` action
5. If no confirmation → use goat-escrow skill's `refund` action after timeout

## Image Support (Required)

**All listings require a product image.** If the user wants to list an item without providing an image, ask them to send a photo first.

- When the user sends an image with their listing request, save it to a temp file and pass the path via `--image`
- Images are automatically uploaded to Blossom (blossom.nostr.build)
- The image URL is stored in the Nostr listing and returned in the response
- When browsing, listings include an `image` field with the Blossom URL

**Example:**
```bash
npx ts-node scripts/marketplace.ts list "iPhone 15" 0.01 0xABC... "Like new" --image /tmp/photo.jpg
```

**Response includes image URL:**
```json
{
  "success": true,
  "listing": {
    "id": "abc123",
    "item": "iPhone 15",
    "price": "0.01",
    "image": "https://blossom.nostr.build/abc123.jpg"
  }
}
```

## BTC Unit Conversions

| Unit | BTC | Satoshis |
|------|-----|----------|
| **1 BTC** | 1 | 100,000,000 |
| **1 mBTC** (millibit) | 0.001 | 100,000 |
| **1 μBTC / bit** (microbit) | 0.000001 | 100 |
| **1 sat** (satoshi) | 0.00000001 | 1 |

**Quick satoshi reference:**

| Satoshis | BTC |
|----------|-----|
| 1 | 0.00000001 |
| 100 | 0.000001 |
| 1,000 | 0.00001 |
| 10,000 | 0.0001 |
| 100,000 | 0.001 |
| 1,000,000 | 0.01 |

When the user specifies a price, convert to BTC for the listing:
- "100 sats" → 0.000001 BTC
- "5 mBTC" → 0.005 BTC
- "500 bits" → 0.0005 BTC

## Formatting

When displaying listings, format them nicely:
- Show item name, price in BTC, and seller address (truncated)
- If listing has an image, show it as: `Image: <url>` (the full Blossom URL)
- If listing has an escrow ID, show escrow status
- Link to explorer for transaction verification

**Example listing display:**
```
📦 iPhone 15 — 0.01 BTC
   Seller: 0x318B01...2f42
   Description: Like new condition
   Image: https://blossom.nostr.build/abc123.jpg
   Listing ID: abc-123-def
```
