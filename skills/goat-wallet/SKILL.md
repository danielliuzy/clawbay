---
name: goat-wallet
description: Check BTC wallet balance and address on GOAT Network (Bitcoin L2, Testnet3). Use when the user asks about their wallet, balance, address, or wants to check funds on GOAT Network.
---

# GOAT Wallet

Check your BTC balance and wallet address on GOAT Network Testnet3.

## Setup

Requires environment variables in `~/.openclaw/skills/goat-wallet/.env`:
- `GOAT_RPC_URL` — RPC endpoint (default: `https://rpc.testnet3.goat.network`)
- `PRIVATE_KEY` — Wallet private key

## Available Actions

### Check Balance

Run the wallet script with the `balance` action:

```bash
npx ts-node ~/.openclaw/skills/goat-wallet/scripts/wallet.ts balance
```

Returns the wallet address and BTC balance on GOAT Testnet3.

### Get Address

Run the wallet script with the `address` action:

```bash
npx ts-node ~/.openclaw/skills/goat-wallet/scripts/wallet.ts address
```

Returns the wallet's public address.

## Network Info

| Parameter | Value |
|---|---|
| Network | GOAT Testnet3 |
| Chain ID | 48816 |
| Native Currency | BTC (18 decimals) |
| Explorer | `https://explorer.testnet3.goat.network` |
| Faucet | `https://bridge.testnet3.goat.network` |

When showing balances, format as BTC with up to 6 decimal places. Link to the explorer for the user's address: `https://explorer.testnet3.goat.network/address/<ADDRESS>`
