import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from skill directory, then fall back to project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const SERVER_URL = process.env.CLAWBAY_SERVER_URL || "http://localhost:3838";
const RPC_URL = process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;

const ESCROW_ABI = [
  "function createEscrow(address seller, string calldata description) external payable returns (uint256)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, string description)",
];

async function listItem(item: string, priceBTC: string, sellerAddress: string, description: string) {
  const res = await fetch(`${SERVER_URL}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, price: priceBTC, sellerAddress, description }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("ERROR:", data.error);
    process.exit(1);
  }
  console.log(JSON.stringify({ success: true, listing: data }));
}

async function browse() {
  const res = await fetch(`${SERVER_URL}/listings?status=active`);
  const listings = await res.json();

  if (listings.length === 0) {
    console.log(JSON.stringify({ success: true, listings: [], message: "No active listings" }));
    return;
  }

  console.log(JSON.stringify({ success: true, listings }));
}

async function details(listingId: string) {
  const res = await fetch(`${SERVER_URL}/listings/${listingId}`);
  if (!res.ok) {
    console.error("ERROR: Listing not found");
    process.exit(1);
  }
  const data = await res.json();
  console.log(JSON.stringify({ success: true, listing: data }));
}

async function buyItem(listingId: string) {
  if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("ERROR: PRIVATE_KEY and ESCROW_CONTRACT_ADDRESS must be set");
    process.exit(1);
  }

  // Fetch listing
  const listingRes = await fetch(`${SERVER_URL}/listings/${listingId}`);
  if (!listingRes.ok) {
    console.error("ERROR: Listing not found");
    process.exit(1);
  }
  const listing = await listingRes.json();

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
  const event = receipt.logs.find((log: any) => {
    try {
      return contract.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "EscrowCreated";
    } catch {
      return false;
    }
  });
  if (event) {
    const parsed = contract.interface.parseLog({ topics: event.topics as string[], data: event.data });
    escrowId = parsed?.args[0].toString() || "unknown";
  }

  // Update listing status
  await fetch(`${SERVER_URL}/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "sold", escrowId, buyerAddress: wallet.address }),
  });

  console.log(JSON.stringify({
    success: true,
    action: "bought",
    listingId,
    escrowId,
    txHash: tx.hash,
    buyer: wallet.address,
    seller: listing.sellerAddress,
    amount: listing.price,
    item: listing.item,
  }));
}

async function cancelListing(listingId: string) {
  const res = await fetch(`${SERVER_URL}/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!res.ok) {
    console.error("ERROR: Failed to cancel listing");
    process.exit(1);
  }
  const data = await res.json();
  console.log(JSON.stringify({ success: true, listing: data }));
}

const [, , action, ...args] = process.argv;

switch (action) {
  case "list":
    if (args.length < 3) {
      console.error("Usage: marketplace.ts list <item> <priceBTC> <sellerAddress> [description]");
      process.exit(1);
    }
    listItem(args[0], args[1], args[2], args.slice(3).join(" ") || "").catch(console.error);
    break;
  case "browse":
    browse().catch(console.error);
    break;
  case "details":
    if (!args[0]) {
      console.error("Usage: marketplace.ts details <listingId>");
      process.exit(1);
    }
    details(args[0]).catch(console.error);
    break;
  case "buy":
    if (!args[0]) {
      console.error("Usage: marketplace.ts buy <listingId>");
      process.exit(1);
    }
    buyItem(args[0]).catch(console.error);
    break;
  case "cancel":
    if (!args[0]) {
      console.error("Usage: marketplace.ts cancel <listingId>");
      process.exit(1);
    }
    cancelListing(args[0]).catch(console.error);
    break;
  default:
    console.error("Usage: marketplace.ts <list|browse|details|buy|cancel> [args]");
    process.exit(1);
}
