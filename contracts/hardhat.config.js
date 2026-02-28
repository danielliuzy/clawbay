require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

module.exports = {
  solidity: "0.8.24",
  networks: {
    goatTestnet3: {
      url: process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network",
      chainId: 48816,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
