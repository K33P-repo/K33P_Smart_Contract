// deploy.ts - Fixed K33P contract deployment script
import { Lucid, Blockfrost, SpendingValidator, Data } from "lucid-cardano";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

console.log("Deploy script is running...");

// Configuration
const CONFIG = {
  network: "Preprod" as const,
  blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
  blockfrostApiKey: process.env.BLOCKFROST_API_KEY || "preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG",
  seedPhrase: process.env.SEED_PHRASE || "blame purpose battle mistake match cousin degree route bag return clump key metal actress poet outside group sword bring gravity weapon report alone dove",
  plutusScriptPath: "C:/Users/USER/Desktop/K33P_Smart_Contract/smart_contract_validator/plutus.json",
  minAda: 2_000_000n, // 2 ADA minimum for deployment
};

async function deployK33pContract() {
  console.log("🚀 Starting K33P contract deployment...");
  
  try {
    // 1. Initialize Lucid with Blockfrost
    console.log("📡 Connecting to Blockfrost...");
    const lucid = await Lucid.new(
      new Blockfrost(CONFIG.blockfrostUrl, CONFIG.blockfrostApiKey),
      CONFIG.network
    );

    // 2. Set up wallet
    console.log("💼 Setting up wallet...");
    lucid.selectWalletFromSeed(CONFIG.seedPhrase);
    
    const walletAddress = await lucid.wallet.address();
    console.log(`📍 Wallet address: ${walletAddress}`);

    // 3. Check wallet balance
    const utxos = await lucid.wallet.getUtxos();
    const totalAda = utxos.reduce((sum, utxo) => sum + utxo.assets.lovelace, 0n);
    console.log(`💰 Wallet balance: ${Number(totalAda) / 1_000_000} ADA`);

    if (totalAda < CONFIG.minAda) {
      throw new Error(`Insufficient funds! Need at least ${Number(CONFIG.minAda) / 1_000_000} ADA`);
    }

    // 4. Load compiled Plutus script
    console.log("📄 Loading Plutus script...");
    if (!fs.existsSync(CONFIG.plutusScriptPath)) {
      throw new Error(`Plutus script not found at ${CONFIG.plutusScriptPath}`);
    }

    const plutusScript = JSON.parse(fs.readFileSync(CONFIG.plutusScriptPath, "utf8"));
    
    // 5. Create validator
    const validator: SpendingValidator = {
      type: "PlutusV2",
      script: plutusScript.cborHex,
    };

    // 6. Generate script address
    const scriptAddress = lucid.utils.validatorToAddress(validator);
    console.log(`🏠 Script address: ${scriptAddress}`);

    // 7. Build deployment transaction - FIXED VERSION
    console.log("🔨 Building deployment transaction...");
    
    // Option 1: Simple deployment (just send ADA to script address)
    const tx = await lucid
      .newTx()
      .payToContract(
        scriptAddress,
        { inline: Data.void() }, // Empty datum
        { lovelace: CONFIG.minAda }
      )
      // ❌ REMOVED: .attachSpendingValidator(validator) 
      // This was causing the MalformedScriptWitnesses error!
      .complete();

    // Option 2: Deploy as reference script (uncomment if you want reference script)
    // const tx = await lucid
    //   .newTx()
    //   .payToContract(
    //     scriptAddress,
    //     { inline: Data.void() },
    //     { lovelace: CONFIG.minAda }
    //   )
    //   .payToAddressWithData(
    //     walletAddress, // Send reference script to your own address
    //     { scriptRef: validator }, // This creates a reference script
    //     { lovelace: CONFIG.minAda }
    //   )
    //   .complete();

    console.log("💾 Transaction built successfully");

    // 8. Sign transaction
    console.log("✍️ Signing transaction...");
    const signedTx = await tx.sign().complete();

    // 9. Submit transaction
    console.log("📤 Submitting transaction to network...");
    const txHash = await signedTx.submit();

    // 10. Success! 
    console.log("\n🎉 CONTRACT DEPLOYED SUCCESSFULLY! 🎉");
    console.log("=".repeat(50));
    console.log(`📋 Transaction Hash: ${txHash}`);
    console.log(`🏠 Script Address: ${scriptAddress}`);
    console.log(`🔗 CardanoScan: https://preprod.cardanoscan.io/transaction/${txHash}`);
    console.log(`💰 Cost: ${Number(CONFIG.minAda) / 1_000_000} ADA + fees`);
    console.log("=".repeat(50));

    // 11. Save deployment info
    const deploymentInfo = {
      contractName: "k33p_validator",
      network: CONFIG.network,
      txHash,
      scriptAddress,
      deployedAt: new Date().toISOString(),
      blockfrostApiKey: CONFIG.blockfrostApiKey.slice(0, 8) + "...",
      validator: {
        type: "PlutusV2",
        scriptSize: plutusScript.cborHex ? plutusScript.cborHex.length / 2 : 0,
      }
    };

    fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("📄 Deployment info saved to deployment-info.json");

    // 12. Wait for confirmation
    console.log("\n⏳ Waiting for transaction confirmation...");
    await waitForConfirmation(lucid, txHash);

    return deploymentInfo;

  } catch (error: any) {
    console.error("\n❌ DEPLOYMENT FAILED!");
    console.error("Error:", error);
    
    if (error.message?.includes("insufficient")) {
      console.log("\n💡 Solutions:");
      console.log("1. Get testnet ADA from: https://docs.cardano.org/cardano-testnet/tools/faucet/");
      console.log("2. Wait 5-10 minutes for faucet transaction to confirm");
    }
    
    if (error.message?.includes("Blockfrost")) {
      console.log("\n💡 Blockfrost Issues:");
      console.log("1. Check your API key is correct");
      console.log("2. Ensure you're using a PREPROD project key");
      console.log("3. Verify your Blockfrost project has remaining requests");
    }

    throw error;
  }
}

async function waitForConfirmation(lucid: Lucid, txHash: string, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await lucid.awaitTx(txHash);
      console.log("✅ Transaction confirmed!");
      return;
    } catch {
      console.log(`⏳ Waiting for confirmation... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  console.log("⚠️ Timeout waiting for confirmation, but transaction may still succeed");
}

async function main() {
  try {
    await deployK33pContract();
    process.exit(0);
  } catch (error: any) {
    console.error("\n💥 Deployment script failed:", error);
    process.exit(1);
  }
}

const isMainModule = import.meta.url === `file://${fileURLToPath(import.meta.url)}` || 
                    process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  console.log("🎯 Running as main module...");
  main();
}

export { deployK33pContract };