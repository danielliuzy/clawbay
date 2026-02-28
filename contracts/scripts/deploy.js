const hre = require("hardhat");

async function main() {
  console.log("Deploying Escrow contract to", hre.network.name, "...");

  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("Escrow deployed to:", address);
  console.log("\nAdd this to your .env file:");
  console.log(`ESCROW_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
