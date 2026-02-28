---
name: goat-escrow
description: Create and manage P2P escrow transactions on GOAT Network (Bitcoin L2). Use when the user wants to create an escrow, lock BTC for a trade, confirm delivery to release funds, check escrow status, or request a refund. Part of ClawBay P2P marketplace.
---

# GOAT Escrow

Manage on-chain P2P escrow on GOAT Network Testnet3. Locks BTC in a smart contract until the buyer confirms delivery.

## Setup

Requires environment variables in `~/.openclaw/skills/goat-escrow/.env`:
- `GOAT_RPC_URL` — RPC endpoint (default: `https://rpc.testnet3.goat.network`)
- `PRIVATE_KEY` — Wallet private key
- `ESCROW_CONTRACT_ADDRESS` — Deployed Escrow contract address

## Available Actions

### Create Escrow

Lock BTC in escrow for a seller:

```bash
npx ts-node ~/.openclaw/skills/goat-escrow/scripts/escrow.ts create <sellerAddress> <amountInBTC> <description>
```

Example:
```bash
npx ts-node ~/.openclaw/skills/goat-escrow/scripts/escrow.ts create 0xABC123... 0.001 "AirPods Pro"
```

Returns: escrow ID and transaction hash. Show the tx on explorer: `https://explorer.testnet3.goat.network/tx/<TXHASH>`

### Check Escrow Status

```bash
npx ts-node ~/.openclaw/skills/goat-escrow/scripts/escrow.ts status <escrowId>
```

Returns: buyer, seller, amount, description, status (Active/Completed/Refunded), creation time.

### Confirm Delivery

Buyer confirms they received the item, releasing BTC to seller:

```bash
npx ts-node ~/.openclaw/skills/goat-escrow/scripts/escrow.ts confirm <escrowId>
```

Only the buyer can call this. Returns transaction hash.

### Request Refund

Refund buyer after timeout (7 days). Anyone can trigger:

```bash
npx ts-node ~/.openclaw/skills/goat-escrow/scripts/escrow.ts refund <escrowId>
```

Returns transaction hash if timeout has passed.

## Escrow Lifecycle

1. **Active** — BTC locked, waiting for buyer to confirm delivery
2. **Completed** — Buyer confirmed, BTC released to seller
3. **Refunded** — Timeout passed, BTC returned to buyer

## Important Notes

- The caller's wallet (PRIVATE_KEY) is the buyer when creating escrow
- Amount is in BTC (e.g., 0.001 = 0.001 BTC)
- Default timeout is 7 days — after that, anyone can trigger refund
- Always show transaction links: `https://explorer.testnet3.goat.network/tx/<HASH>`
