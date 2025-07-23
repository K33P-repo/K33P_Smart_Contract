import { Lucid, Blockfrost, fromText, Data, Constr } from "lucid-cardano";
import fs from "fs";

const API_KEY = "preprod3W1XBWtJSpHSjqlHcrxuPo3uv2Q5BOFM";
const lucid = await Lucid.new(
  new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", API_KEY),
  "Preprod"
);

// Load compiled validator
const validatorJson = JSON.parse(fs.readFileSync("./blueprint/scripts/k33p_validator.json", "utf8"));
const script = validatorJson.cborHex;
const scriptHash = lucid.utils.validatorToScriptHash(script);

console.log("Script hash:", scriptHash);

// Prepare dummy datum and redeemer
const datum = Data.to(
  new Constr(0, [
    new Constr(0, [fromText("c863c72c1471ad0fd184f45639896008d40608e9cfb6f3087dee53039ad434e97b059ef64551ab94808aabaf678ea7f4c1357812e5a853dae06f93c076becc3d")]), // AuthDatumType(AuthDatum)
  ])
);

const redeemer = Data.to(
  new Constr(0, [
    new Constr(0, [fromText("c863c72c1471ad0fd184f45639896008d40608e9cfb6f3087dee53039ad434e97b059ef64551ab94808aabaf678ea7f4c1357812e5a853dae06f93c076becc3d")]) // AuthRedeemerType(StoreAuthData)
  ])
);

// Log hex for testing
console.log("Datum (hex):", datum);
console.log("Redeemer (hex):", redeemer);