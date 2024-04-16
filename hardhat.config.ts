import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
require('./tasks/deployFacet');
require('./tasks/updateLenderKYBStatus');
require('./tasks/updatePoolManagerKYBStatus');
require('./tasks/updateCreditPoolStatus');
dotenv.config();

// Verify a contract
task("verify-contract", "Verify contract")
  .addParam("contractToVerify", "The contract address")
  .setAction(async (taskArgs, hre) => {
    try {
      console.log("Verifying contract...");
      await hre.run("verify:verify", {
        address: taskArgs.contractToVerify,
        constructorArguments: [],
        contract: "contracts/<contract>.sol:<contract>",
      });
    } catch (err: any) {
      if (err.message.includes("Reason: Already Verified")) {
        console.log("Contract is already verified!");
      } else {
        console.log(err.message);
      }
    }
  });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mainnet: {
      url: process.env.RPC_URL_MAINNET,
      accounts: process.env.PK_MAINNET !== undefined ? [process.env.PK_MAINNET] : [],
    },
    goerli: {
      url: process.env.RPC_URL,
      accounts: process.env.PK !== undefined ? [process.env.PK] : [],
      gas: 2100000,
      gasPrice: 8000000000,
    },
    sepolia: {
      url: process.env.RPC_URL,
      accounts: process.env.PK !== undefined ? [process.env.PK] : [],
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    token: "ETH",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY
        ? process.env.ETHERSCAN_API_KEY
        : "",
    },
  },
};

export default config;
