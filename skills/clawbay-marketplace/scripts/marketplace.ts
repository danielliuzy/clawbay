import WebSocket from "ws";
// @ts-ignore – polyfill for nostr-tools relay connections in Node.js
(globalThis as any).WebSocket = WebSocket;

// @ts-ignore - nostr-tools subpath imports
import { finalizeEvent } from "nostr-tools/pure";
// @ts-ignore - nostr-tools subpath imports
import { SimplePool } from "nostr-tools/pool";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { ethers } from "ethers";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env from skill directory, then fall back to project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const RPC_URL = process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;

const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.nostr.band"];
const RELAYS = process.env.NOSTR_RELAYS ? process.env.NOSTR_RELAYS.split(",").map((r) => r.trim()) : DEFAULT_RELAYS;

const KIND_CLASSIFIED = 30402;
const KIND_BLOSSOM_AUTH = 24242;
const CLAWBAY_TAG = "clawbay";
const BLOSSOM_SERVER = "https://blossom.nostr.build";

const ESCROW_ABI = [
  "function createEscrow(address seller, string calldata description) external payable returns (uint256)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, string description)",
];

// --- Nostr helpers ---

function getSecretKey(): Uint8Array {
  if (!PRIVATE_KEY) {
    console.error("ERROR: PRIVATE_KEY must be set");
    process.exit(1);
  }
  // ETH private keys are 32-byte hex, same curve as Nostr (secp256k1)
  const raw = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY.slice(2) : PRIVATE_KEY;
  return hexToBytes(raw);
}

function getTag(event: any, name: string): string | undefined {
  const tag = event.tags.find((t: string[]) => t[0] === name);
  return tag ? tag[1] : undefined;
}

interface Listing {
  id: string;
  item: string;
  price: string;
  description: string;
  status: string;
  sellerAddress: string;
  escrowId?: string;
  buyerAddress?: string;
  txHash?: string;
  image?: string;
  createdAt: number;
  pubkey: string;
}

function parseListing(event: any): Listing {
  return {
    id: getTag(event, "d") || "",
    item: getTag(event, "title") || "",
    price: getTag(event, "price") || "0",
    description: getTag(event, "description") || "",
    status: getTag(event, "status") || "active",
    sellerAddress: getTag(event, "seller_eth") || "",
    escrowId: getTag(event, "escrow_id"),
    buyerAddress: getTag(event, "buyer_eth"),
    txHash: getTag(event, "tx_hash"),
    image: getTag(event, "image"),
    createdAt: event.created_at,
    pubkey: event.pubkey,
  };
}

const pool = new SimplePool();

async function publishToRelays(event: any): Promise<string[]> {
  const results = await Promise.allSettled(pool.publish(RELAYS, event));
  const published = RELAYS.filter((_, i) => results[i].status === "fulfilled");

  if (published.length === 0) {
    console.error("ERROR: Failed to publish to any relay");
    results.forEach((r: PromiseSettledResult<any>, i: number) => {
      if (r.status === "rejected") console.error(`  ${RELAYS[i]}: ${r.reason}`);
    });
    process.exit(1);
  }

  return published;
}

async function uploadToBlossom(imagePath: string): Promise<string> {
  console.error(`[INFO] Starting Blossom upload for: ${imagePath}`);
  const sk = getSecretKey();

  // Read the image file
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBytes = new Uint8Array(imageBuffer);
  const imageHash = bytesToHex(sha256(imageBytes));
  console.error(`[INFO] Image size: ${imageBytes.length} bytes, SHA256: ${imageHash.slice(0, 16)}...`);

  // Determine content type from extension
  const ext = path.extname(imagePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const contentType = contentTypes[ext] || "application/octet-stream";

  // Create Blossom auth event (kind 24242)
  const authEvent = finalizeEvent(
    {
      kind: KIND_BLOSSOM_AUTH,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["t", "upload"],
        ["x", imageHash],
        ["expiration", String(Math.floor(Date.now() / 1000) + 300)], // 5 min expiry
      ],
      content: "Upload image to Blossom",
    },
    sk
  );

  // Base64 encode the auth event for the header
  const authHeader = "Nostr " + Buffer.from(JSON.stringify(authEvent)).toString("base64");

  // Upload to Blossom
  const response = await fetch(`${BLOSSOM_SERVER}/upload`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Authorization": authHeader,
    },
    body: imageBytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Blossom upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json() as { url: string; sha256: string; size: number; type: string };

  return result.url;
}

async function queryListings(filter: Record<string, any>): Promise<any[]> {
  const events = await pool.querySync(RELAYS, { kinds: [KIND_CLASSIFIED], "#t": [CLAWBAY_TAG], ...filter });

  // For parameterized replaceable events, keep only the latest per `d` tag
  const latest = new Map<string, any>();
  for (const event of events) {
    const d = getTag(event, "d") || "";
    const existing = latest.get(d);
    if (!existing || event.created_at > existing.created_at) {
      latest.set(d, event);
    }
  }

  return Array.from(latest.values());
}

// --- Actions ---

async function listItem(item: string, priceBTC: string, sellerAddress: string, description: string, imagePath: string) {
  const sk = getSecretKey();
  const id = crypto.randomUUID();

  // Upload image to Blossom (required)
  console.error(`[INFO] Uploading image to Blossom...`);
  const imageUrl = await uploadToBlossom(imagePath);
  console.error(`[INFO] Image uploaded: ${imageUrl}`);

  const tags: string[][] = [
    ["d", id],
    ["title", item],
    ["price", priceBTC, "BTC"],
    ["description", description],
    ["status", "active"],
    ["t", CLAWBAY_TAG],
    ["seller_eth", sellerAddress],
    ["image", imageUrl],
  ];

  const event = finalizeEvent(
    {
      kind: KIND_CLASSIFIED,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: `${item} — ${priceBTC} BTC`,
    },
    sk
  );

  const published = await publishToRelays(event);

  console.log(
    JSON.stringify({
      success: true,
      listing: {
        id,
        item,
        price: priceBTC,
        sellerAddress,
        description,
        status: "active",
        image: imageUrl,
      },
      relays: published,
    })
  );
}

async function browse() {
  const events = await queryListings({});
  const listings = events.map(parseListing).filter((l) => l.status === "active");

  if (listings.length === 0) {
    console.log(JSON.stringify({ success: true, listings: [], message: "No active listings" }));
    return;
  }

  console.log(JSON.stringify({ success: true, listings }));
}

async function details(listingId: string) {
  const events = await queryListings({ "#d": [listingId] });

  if (events.length === 0) {
    console.error("ERROR: Listing not found");
    process.exit(1);
  }

  const listing = parseListing(events[0]);
  console.log(JSON.stringify({ success: true, listing }));
}

async function buyItem(listingId: string) {
  if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("ERROR: PRIVATE_KEY and ESCROW_CONTRACT_ADDRESS must be set");
    process.exit(1);
  }

  // Fetch listing from Nostr
  const events = await queryListings({ "#d": [listingId] });
  if (events.length === 0) {
    console.error("ERROR: Listing not found");
    process.exit(1);
  }

  const originalEvent = events[0];
  const listing = parseListing(originalEvent);

  if (listing.status !== "active") {
    console.error("ERROR: Listing is not active (status: " + listing.status + ")");
    process.exit(1);
  }

  // Create escrow on-chain
  const provider = new ethers.JsonRpcProvider(RPC_URL, { name: "goat-testnet3", chainId: 48816 });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ESCROW_ABI, wallet);

  const value = ethers.parseEther(listing.price);
  console.log(`Creating escrow: ${listing.price} BTC for "${listing.item}"...`);

  const tx = await contract.createEscrow(listing.sellerAddress, listing.item, { value });
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();

  // Parse escrow ID from event
  let escrowId = "unknown";
  const escrowEvent = receipt.logs.find((log: any) => {
    try {
      return contract.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "EscrowCreated";
    } catch {
      return false;
    }
  });
  if (escrowEvent) {
    const parsed = contract.interface.parseLog({ topics: escrowEvent.topics as string[], data: escrowEvent.data });
    escrowId = parsed?.args[0].toString() || "unknown";
  }

  // Republish listing as sold on Nostr
  const sk = getSecretKey();
  const tags: string[][] = [
    ["d", listingId],
    ["title", listing.item],
    ["price", listing.price, "BTC"],
    ["description", listing.description],
    ["status", "sold"],
    ["t", CLAWBAY_TAG],
    ["seller_eth", listing.sellerAddress],
    ["escrow_id", escrowId],
    ["buyer_eth", wallet.address],
    ["tx_hash", tx.hash],
  ];

  // Preserve image if present
  if (listing.image) {
    tags.push(["image", listing.image]);
  }

  const updatedEvent = finalizeEvent(
    {
      kind: KIND_CLASSIFIED,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: `${listing.item} — SOLD`,
    },
    sk
  );

  await publishToRelays(updatedEvent);

  console.log(
    JSON.stringify({
      success: true,
      action: "bought",
      listingId,
      escrowId,
      txHash: tx.hash,
      buyer: wallet.address,
      seller: listing.sellerAddress,
      amount: listing.price,
      item: listing.item,
    })
  );
}

async function cancelListing(listingId: string) {
  const sk = getSecretKey();

  // Fetch the existing listing
  const events = await queryListings({ "#d": [listingId] });
  if (events.length === 0) {
    console.error("ERROR: Listing not found");
    process.exit(1);
  }

  const listing = parseListing(events[0]);

  // Republish with cancelled status
  const tags: string[][] = [
    ["d", listingId],
    ["title", listing.item],
    ["price", listing.price, "BTC"],
    ["description", listing.description],
    ["status", "cancelled"],
    ["t", CLAWBAY_TAG],
    ["seller_eth", listing.sellerAddress],
  ];

  // Preserve image if present
  if (listing.image) {
    tags.push(["image", listing.image]);
  }

  const event = finalizeEvent(
    {
      kind: KIND_CLASSIFIED,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: `${listing.item} — CANCELLED`,
    },
    sk
  );

  await publishToRelays(event);

  console.log(
    JSON.stringify({
      success: true,
      listing: { ...listing, status: "cancelled" },
    })
  );
}

// --- CLI ---

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      flags[key] = value;
    } else {
      positional.push(args[i]);
    }
  }

  return { positional, flags };
}

async function main() {
  const [, , action, ...rawArgs] = process.argv;
  const { positional: args, flags } = parseArgs(rawArgs);

  // Debug logging
  if (process.env.DEBUG) {
    console.error(`[DEBUG] Action: ${action}`);
    console.error(`[DEBUG] Args: ${JSON.stringify(args)}`);
    console.error(`[DEBUG] Flags: ${JSON.stringify(flags)}`);
  }

  try {
    switch (action) {
      case "list":
        if (args.length < 3 || !flags.image) {
          console.error("Usage: marketplace.ts list <item> <priceBTC> <sellerAddress> [description] --image /path/to/image");
          console.error("ERROR: --image is required");
          process.exit(1);
        }
        console.error(`[INFO] Image provided: ${flags.image}`);
        await listItem(args[0], args[1], args[2], args.slice(3).join(" ") || "", flags.image);
        break;
      case "browse":
        await browse();
        break;
      case "details":
        if (!args[0]) {
          console.error("Usage: marketplace.ts details <listingId>");
          process.exit(1);
        }
        await details(args[0]);
        break;
      case "buy":
        if (!args[0]) {
          console.error("Usage: marketplace.ts buy <listingId>");
          process.exit(1);
        }
        await buyItem(args[0]);
        break;
      case "cancel":
        if (!args[0]) {
          console.error("Usage: marketplace.ts cancel <listingId>");
          process.exit(1);
        }
        await cancelListing(args[0]);
        break;
      default:
        console.error("Usage: marketplace.ts <list|browse|details|buy|cancel> [args]");
        process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
}

main();
