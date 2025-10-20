// backend/src/utils/lucid.js

import { Lucid, Blockfrost, Data, fromText, toHex } from "lucid-cardano";
import { bech32 } from "bech32";
import fs from "fs";
import path from "path";

/* ----------------------------- PRIVATE KEY LOADER ----------------------------- */
function getBackendPrivateKey() {
  if (process.env.BACKEND_PRIVATE_KEY) {
    const key = process.env.BACKEND_PRIVATE_KEY.trim();

    // Handle cborHex format from .skey files
    if (key.startsWith("5820") && key.length === 68) {
      const hexKey = key.substring(4);
      const keyBytes = Buffer.from(hexKey, "hex");
      const words = bech32.toWords(keyBytes);
      const bech32Key = bech32.encode("ed25519_sk", words);
      return bech32Key;
    }

    return key;
  }

  const keyPath = process.env.BACKEND_PRIVATE_KEY_PATH;
  if (!keyPath) throw new Error("No BACKEND_PRIVATE_KEY or BACKEND_PRIVATE_KEY_PATH found");

  const fileContent = fs.readFileSync(keyPath, "utf8");
  try {
    const parsed = JSON.parse(fileContent);
    if (parsed.cborHex) return parsed.cborHex;
  } catch (_) {}
  return fileContent.trim();
}

/* ----------------------------- LUCID INITIALIZER ----------------------------- */
export const initLucid = async () => {
  return await Lucid.new(
    new Blockfrost(process.env.BLOCKFROST_URL, process.env.BLOCKFROST_API_KEY),
    process.env.NETWORK || "Preprod"
  );
};

/* ----------------------------- LOAD PLUTUS VALIDATOR ----------------------------- */
function loadValidator() {
  const filePath = path.resolve("./plutus.json");
  const plutus = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // Get first validator (adjust index if you have multiple)
  const compiled = plutus.validators[0].compiledCode;
  if (!compiled) throw new Error("compiledCode missing in plutus.json");

  return {
    type: "PlutusV3", // matches your plutusVersion in JSON
    script: compiled,
  };
}

/* ----------------------------- GET SCRIPT ADDRESS ----------------------------- */
export async function getScriptAddress() {
  const lucid = await initLucid();
  const validator = loadValidator();
  return lucid.utils.validatorToAddress(validator);
}

/* ----------------------------- EXAMPLE DATUM/REDEEMER SCHEMA ----------------------------- */

// simplified structure for on-chain signup
const SignupDatumValueSchema = Data.Object({
  wallet: Data.Bytes(), // simplified for now (can replace with Address encoding later)
  user_id: Data.Bytes(),
  zk_proof: Data.Bytes(),
  timestamp: Data.Integer(),
});

const IdentityDatumSchema = Data.Enum([
  Data.Object({ SignupDatum: SignupDatumValueSchema }),
]);

const K33pDatumSchema = Data.Enum([
  Data.Object({ IdentityDatumType: IdentityDatumSchema }),
]);

const IdentityRedeemerSchema = Data.Enum([
  Data.Object({ ProcessSignup: Data.Object({ signature: Data.Bytes() }) }),
]);

const K33pRedeemerSchema = Data.Enum([
  Data.Object({ IdentityRedeemerType: IdentityRedeemerSchema }),
]);

/* ----------------------------- SIGNUP TRANSACTION ----------------------------- */
export async function signupTxBuilder(userAddress, userData) {
  const lucid = await initLucid();
  const validator = loadValidator();
  lucid.selectWalletFromPrivateKey(getBackendPrivateKey());

  const scriptAddress = lucid.utils.validatorToAddress(validator);

  // Build datum that matches the Aiken schema
  const datum = Data.to(
    {
      IdentityDatumType: {
        SignupDatum: {
          wallet: fromText(userAddress),
          user_id: fromText(userData.user_id),
          zk_proof: userData.zk_proof,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        },
      },
    },
    K33pDatumSchema
  );

  const tx = await lucid
    .newTx()
    .payToContract(scriptAddress, { inline: datum }, { lovelace: BigInt(2_000_000) })
    .complete();

  const signed = await tx.sign().complete();
  const txHash = await signed.submit();

  console.log("✅ Signup transaction submitted:", txHash);
  return txHash;
}

/* ----------------------------- REFUND TRANSACTION ----------------------------- */
export async function refundTx(ownerAddress, utxo) {
  const lucid = await initLucid();
  const validator = loadValidator();
  lucid.selectWalletFromPrivateKey(getBackendPrivateKey());

  const redeemer = Data.to(
    {
      IdentityRedeemerType: {
        ProcessRefund: { signature: fromText("backend_sig") },
      },
    },
    K33pRedeemerSchema
  );

  const tx = await lucid
    .newTx()
    .collectFrom([utxo], redeemer)
    .attachSpendingValidator(validator)
    .payToAddress(ownerAddress, { lovelace: BigInt(utxo.assets.lovelace) })
    .complete();

  const signed = await tx.sign().complete();
  const txHash = await signed.submit();

  console.log("✅ Refund transaction submitted:", txHash);
  return txHash;
}

/* ----------------------------- FETCH UTXOs BY PHONE HASH ----------------------------- */
export async function fetchUtxos(phoneHashHex) {
  const lucid = await initLucid();
  const scriptAddress = await getScriptAddress();

  const utxos = await lucid.utxosAt(scriptAddress);

  // Example filter (depending on how phone_hash is stored)
  return utxos.filter((u) => {
    try {
      const datum = Data.from(u.datum, K33pDatumSchema);
      const phoneHex = toHex(datum?.IdentityDatumType?.SignupDatum?.user_id || "");
      return phoneHex === phoneHashHex;
    } catch (err) {
      console.error("Error parsing UTXO datum:", err);
      return false;
    }
  });
}
