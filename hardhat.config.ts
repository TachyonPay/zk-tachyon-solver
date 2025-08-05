import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      // Default Hardhat network
    },
    horizen_testnet: {
      url: process.env.HORIZEN_TESTNET_RPC_URL || "https://horizen-rpc-testnet.appchain.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 845320009,
      gasPrice: "auto",
    },
    base_sepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      gasPrice: "auto",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 5,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      horizen_testnet: "not-needed", // Custom network, may not need API key
      base_sepolia: process.env.BASESCAN_API_KEY || "not-needed"
    },
    customChains: [
      {
        network: "horizen_testnet",
        chainId: 845320009,
        urls: {
          apiURL: "https://horizen-explorer-testnet.appchain.base.org/api",
          browserURL: "https://horizen-explorer-testnet.appchain.base.org/"
        }
      },
      {
        network: "base_sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://sepolia-explorer.base.org/api",
          browserURL: "https://sepolia-explorer.base.org/"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
