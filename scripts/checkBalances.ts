import { ethers } from "hardhat";

async function checkBalance(networkName: string, rpcUrl: string, chainId: number) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const walletAddress = process.env.WALLET_ADDRESS || process.env.PRIVATE_KEY ? 
      new ethers.Wallet(process.env.PRIVATE_KEY!, provider).address : "";
    
    if (!walletAddress) {
      console.log(`❌ No wallet address found for ${networkName}`);
      return;
    }

    const balance = await provider.getBalance(walletAddress);
    const balanceInEth = ethers.formatEther(balance);
    
    console.log(`💰 ${networkName}:`);
    console.log(`   Address: ${walletAddress}`);
    console.log(`   Balance: ${balanceInEth} ETH`);
    console.log(`   Chain ID: ${chainId}`);
    console.log(`   Sufficient for deployment: ${parseFloat(balanceInEth) > 0.001 ? "✅ Yes" : "❌ No"}\n`);
    
  } catch (error) {
    console.log(`❌ Error checking ${networkName}:`, error);
  }
}

async function main() {
  console.log("💳 Checking Wallet Balances Across Networks...\n");
  
  const networks = [
    {
      name: "Horizen Testnet",
      rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL || "https://horizen-rpc-testnet.appchain.base.org",
      chainId: 845320009
    },
    {
      name: "Base Sepolia",
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532
    }
  ];

  for (const network of networks) {
    await checkBalance(network.name, network.rpcUrl, network.chainId);
  }

  console.log("🔗 Faucet Links:");
  console.log("Base Sepolia: https://bridge.base.org/deposit");
  console.log("Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
  console.log("\n🚀 Once funded, deploy with:");
  console.log("npx hardhat run scripts/deploy.ts --network base_sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  }); 