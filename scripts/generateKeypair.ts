import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🔑 Generating new Ethereum keypair...\n");

  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();

  console.log("📋 Generated Keypair:");
  console.log("==========================================");
  console.log("🔐 Private Key:", wallet.privateKey);
  console.log("🗝️  Public Key: ", wallet.publicKey);
  console.log("📍 Address:    ", wallet.address);
  console.log("==========================================\n");

  // Generate a mnemonic wallet as backup
  const mnemonicWallet = ethers.Wallet.createRandom();

  console.log("🎲 Alternative: Mnemonic Phrase");
  console.log("==========================================");
  console.log("Mnemonic:", mnemonicWallet.mnemonic?.phrase);
  console.log("Private Key:", mnemonicWallet.privateKey);
  console.log("Address:", mnemonicWallet.address);
  console.log("==========================================\n");

  // Create .env file content
  const envContent = `# Generated Ethereum Keypairs - ${new Date().toISOString()}
# ⚠️  WARNING: Keep this file secure and NEVER commit to version control

# Primary Keypair
PRIVATE_KEY=${wallet.privateKey}
PUBLIC_KEY=${wallet.publicKey}
WALLET_ADDRESS=${wallet.address}

# Alternative Keypair (with Mnemonic)
MNEMONIC_PHRASE="${mnemonicWallet.mnemonic?.phrase}"
MNEMONIC_PRIVATE_KEY=${mnemonicWallet.privateKey}
MNEMONIC_WALLET_ADDRESS=${mnemonicWallet.address}

# Common environment variables for development
ETHERSCAN_API_KEY=your_etherscan_api_key_here
INFURA_PROJECT_ID=your_infura_project_id_here
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Network RPC URLs (replace with your provider URLs)
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID

# Bridge Contract Addresses (update after deployment)
BRIDGE_CONTRACT_ADDRESS=
RELAYER_ADDRESS=${wallet.address}
`;

  // Write to .env file
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    // Check if .env already exists
    if (fs.existsSync(envPath)) {
      const backupPath = path.join(process.cwd(), `.env.backup.${Date.now()}`);
      fs.copyFileSync(envPath, backupPath);
      console.log(`📁 Existing .env backed up to: ${backupPath}`);
    }

    fs.writeFileSync(envPath, envContent);
    console.log("✅ Keypair written to .env file successfully!");
    console.log(`📁 Location: ${envPath}\n`);

  } catch (error) {
    console.error("❌ Failed to write .env file:", error);
    process.exit(1);
  }

  console.log("⚠️  SECURITY REMINDERS:");
  console.log("- The .env file contains sensitive private keys");
  console.log("- Make sure .env is in your .gitignore file");
  console.log("- Never share or commit the .env file to version control");
  console.log("- Use these keys only for development/testing\n");

  console.log("💡 Next Steps:");
  console.log("1. Import PRIVATE_KEY into MetaMask for testing");
  console.log("2. Get testnet ETH from faucets for development");
  console.log("3. Update ETHERSCAN_API_KEY and RPC URLs as needed");
  console.log("4. Deploy your bridge contract and update BRIDGE_CONTRACT_ADDRESS\n");

  console.log("🚀 Ready to use with your bridging solution!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Keypair generation failed:", error);
    process.exit(1);
  }); 