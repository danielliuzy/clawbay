import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from skill directory, then fall back to project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const RPC_URL = process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY not set in environment");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL, {
  name: "goat-testnet3",
  chainId: 48816,
});
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function getBalance() {
  const address = wallet.address;
  const balance = await provider.getBalance(address);
  const btc = ethers.formatEther(balance);
  console.log(JSON.stringify({ address, balance: btc, unit: "BTC", network: "GOAT Testnet3" }));
}

async function getAddress() {
  console.log(JSON.stringify({ address: wallet.address }));
}

const action = process.argv[2];

switch (action) {
  case "balance":
    getBalance().catch(console.error);
    break;
  case "address":
    getAddress().catch(console.error);
    break;
  default:
    console.error("Usage: wallet.ts <balance|address>");
    process.exit(1);
}
