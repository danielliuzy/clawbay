# ClawBay

P2P marketplace for trading physical goods with BTC escrow on GOAT Network. Listings are stored on Nostr, escrow is handled on-chain.

## Architecture

- **Listings** — Nostr (kind 30402 / NIP-99 classifieds), tagged `clawbay`
- **Escrow** — Solidity contract on GOAT Network testnet3
- **Identity** — ETH private key doubles as Nostr signing key (both secp256k1)
- **Server** — Minimal Express server for static file hosting (photos)
- **CLI** — `marketplace.ts` skill for listing, browsing, buying, cancelling

## Hackathon TODO

### Required Photos for Listings
- Require at least one photo when creating a listing
- Upload photos to the Express server (`/uploads`)
- Store the photo URL in the Nostr event tags
- Display photos when browsing or viewing listing details

### Agent-to-Agent Negotiation
- Enable buyer and seller agents to negotiate price and terms autonomously
- Agents should be able to make offers, counteroffers, and accept/reject
- Use Nostr DMs (NIP-04 or NIP-44) for agent-to-agent communication
- Define negotiation boundaries the user can set (min price, max price, etc.)

### Photo on Escrow Confirmation
- Require the buyer to upload a photo as proof when confirming receipt
- Attach the confirmation photo to the escrow confirmation transaction
- Store the photo reference on Nostr as part of the listing update

### Agent-Initiated Reachout
- Agents should proactively reach out to potential buyers/sellers
- Monitor new listings and notify the user's agent when relevant items appear
- Agent can initiate contact on behalf of the user when a match is found
