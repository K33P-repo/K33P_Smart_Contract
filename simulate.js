import fs from "fs/promises";
import { Lucid, Blockfrost, Data } from "lucid-cardano";

const BLOCKFROST_API_KEY = "preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG";
const NETWORK = "Preprod";

// Example 24-word mnemonic (replace with your own securely)
const MNEMONIC = "motion bachelor upper lunar dentist transfer evolve point crane process flock peanut knee lone cattle riot gossip tobacco hero soft lazy prefer exhaust glance";

async function main() {
  // Initialize Lucid with Blockfrost provider and network
  const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", BLOCKFROST_API_KEY),
    NETWORK
  );

  // Select wallet from mnemonic (recommended for MVP & ease)
  lucid.selectWalletFromMnemonic(MNEMONIC);

  // Optionally log wallet address for verification
  const address = await lucid.wallet.address();
  console.log("Wallet address:", address);

  // Load validator script (Plutus V2)
  const validatorScript = await fs.readFile("./validator_0.plutus", { encoding: "utf8" });
  const validator = {
    type: "PlutusV2",
    script: validatorScript,
  };

  // Load datum and redeemer JSON files
  const datum = JSON.parse(await fs.readFile("./datum.json", { encoding: "utf8" }));
  const redeemer = JSON.parse(await fs.readFile("./redeemer.json", { encoding: "utf8" }));

  // Build transaction: pay 5 ADA to script address with inline datum
  const tx = await lucid
    .newTx()
    .payToContract(
      await lucid.utils.validatorToAddress(validator),
      { inline: Data.from(datum) },
      { lovelace: 5_000_000n }
    )
    .attachSpendingValidator(validator, redeemer) // Attach redeemer to spending validator
    .complete();

  // Sign the transaction
  const signedTx = await tx.sign().complete();

  // Submit the transaction to the network
  const txHash = await signedTx.submit();

  console.log("✅ Transaction submitted. Tx Hash:", txHash);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});