// interact.ts - Fixed K33P Contract Interaction Functions
import { Lucid, Blockfrost, SpendingValidator, Data, Constr, UTxO, fromText } from "lucid-cardano";
import { readFileSync } from "fs";
import { createHash } from "crypto";

// Your deployed contract info
const DEPLOYED_CONTRACT = {
  scriptAddress: "addr_test1wznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734",
  txHash: "36bf47052ff7585bea8607e2e7258a51f003d75bff133e19e0cd39efa7670ed6"
};

const CONFIG = {
  network: "Preprod" as const,
  blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
  blockfrostApiKey: "preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG",
  plutusScriptPath: "smart_contract_validator\plutus.json", // Use relative path
};

// Data type constructors matching your Aiken contract
const AuthData = (phoneHash: string) => new Constr(0, [phoneHash]);
const AuthDatum = (version: bigint, authData: any, isActive: boolean) => 
  new Constr(0, [version, authData, isActive]);

const SignupDatumValue = (wallet: string, userId: string, zkProof: string) =>
  new Constr(0, [wallet, userId, zkProof]);

const RefundDatumValue = (wallet: string, refundAmount: bigint) =>
  new Constr(0, [wallet, refundAmount]);

// Redeemer constructors
const StoreAuthDataRedeemer = (authData: any) => new Constr(0, [authData]);
const UpdateAuthDataRedeemer = (authData: any) => new Constr(1, [authData]);
const DeleteAuthDataRedeemer = () => new Constr(2, []);

const SignupRedeemer = () => new Constr(0, []);
const RefundRedeemer = () => new Constr(1, []);

// Utility function to hash phone number + PIN
function hashPhoneAndPin(phoneNumber: string, pin: string): string {
  const combined = phoneNumber + pin;
  const hash = createHash('sha256').update(combined).digest('hex');
  return hash.substring(0, 56); // 28 bytes = 56 hex characters
}

export class K33PContract {
  private lucid: Lucid;
  private validator: SpendingValidator;

  constructor(lucid: Lucid, validator: SpendingValidator) {
    this.lucid = lucid;
    this.validator = validator;
  }

  static async initialize(seedPhrase: string): Promise<K33PContract> {
    const lucid = await Lucid.new(
      new Blockfrost(CONFIG.blockfrostUrl, CONFIG.blockfrostApiKey),
      CONFIG.network
    );
    
    lucid.selectWalletFromSeed(seedPhrase);
    
    try {
      const plutusScript = JSON.parse(readFileSync(CONFIG.plutusScriptPath, "utf8"));
      const validator: SpendingValidator = {
        type: "PlutusV2",
        script: plutusScript.cborHex,
      };

      return new K33PContract(lucid, validator);
    } catch (error) {
      throw new Error(`Failed to load Plutus script: ${error}`);
    }
  }

  // 1. Store Authentication Data (Phone + PIN hash)
  async storeAuthData(phoneNumber: string, pin: string): Promise<string> {
    console.log("📱 Storing authentication data (phone + PIN hash)...");
    
    const phoneHash = hashPhoneAndPin(phoneNumber, pin);
    const authData = AuthData(phoneHash);
    const datum = AuthDatum(1n, authData, true);

    const tx = await this.lucid
      .newTx()
      .payToContract(
        DEPLOYED_CONTRACT.scriptAddress,
        { inline: Data.to(datum) },
        { lovelace: 2_000_000n } // 2 ADA
      )
      .complete();

    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();
    
    console.log(`✅ Auth data stored (Phone + PIN hash): ${txHash}`);
    console.log(`📊 Data stored: ${phoneHash.substring(0, 20)}...`);
    return txHash;
  }

  // 2. User Signup with ZK Proof (This should trigger 2 ADA refund)
  async userSignup(userId: string, zkProof: string): Promise<string> {
    console.log("👤 Processing user signup with refund...");
    
    const walletAddress = await this.lucid.wallet.address();
    const signupData = SignupDatumValue(walletAddress, userId, zkProof);
    const datum = new Constr(1, [signupData]); // IdentityDatumType

    // Find UTxOs at the script address to spend from
    const scriptUtxos = await this.lucid.utxosAt(DEPLOYED_CONTRACT.scriptAddress);
    if (scriptUtxos.length === 0) {
      throw new Error("No UTxOs found at script address for refund");
    }

    console.log(`Found ${scriptUtxos.length} UTxOs at contract address`);

    const redeemer = new Constr(1, [SignupRedeemer()]); // IdentityRedeemerType

    const tx = await this.lucid
      .newTx()
      .collectFrom(scriptUtxos.slice(0, 1), Data.to(redeemer)) // Spend the 2 ADA UTXO
      .attachSpendingValidator(this.validator)
      .payToAddress(walletAddress, { lovelace: 2_000_000n }) // Return 2 ADA to user
      .payToContract(
        DEPLOYED_CONTRACT.scriptAddress,
        { inline: Data.to(datum) },
        { lovelace: 1_000_000n } // Keep some ADA for new datum
      )
      .complete();

    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();
    
    console.log(`✅ User signup completed with 2 ADA refund: ${txHash}`);
    return txHash;
  }

  // 3. Check what data is actually stored in the contract
  async inspectContractData(): Promise<any[]> {
    console.log("🔍 Inspecting contract data...");
    
    const scriptUtxos = await this.lucid.utxosAt(DEPLOYED_CONTRACT.scriptAddress);
    const dataResults = [];

    for (let i = 0; i < scriptUtxos.length; i++) {
      const utxo = scriptUtxos[i];
      console.log(`\n--- UTxO ${i + 1} ---`);
      console.log(`Amount: ${Number(utxo.assets.lovelace) / 1_000_000} ADA`);
      console.log(`TxHash: ${utxo.txHash}`);
      
      if (utxo.datum) {
        try {
          const decodedDatum = Data.from(utxo.datum);
          console.log(`Datum (raw): ${JSON.stringify(decodedDatum, null, 2)}`);
          
          dataResults.push({
            utxoIndex: i,
            amount: Number(utxo.assets.lovelace) / 1_000_000,
            txHash: utxo.txHash,
            datum: decodedDatum
          });
        } catch (error) {
          console.log(`Failed to decode datum: ${error}`);
        }
      } else {
        console.log("No datum found");
      }
    }

    return dataResults;
  }

  // 4. Test the 2 ADA refund mechanism
  async testRefundMechanism(): Promise<void> {
    console.log("\n🧪 Testing 2 ADA Refund Mechanism...");
    
    // Check initial wallet balance
    const initialBalance = await this.getWalletInfo();
    console.log(`Initial wallet balance: ${initialBalance.balance} ADA`);

    // Check contract UTxOs before signup
    const utxosBefore = await this.getContractUtxos();
    console.log(`Contract UTxOs before signup: ${utxosBefore.length}`);

    try {
      // Perform user signup (should trigger refund)
      const signupTxHash = await this.userSignup("test_user_123", "zk_proof_placeholder");
      
      // Wait for transaction confirmation
      console.log("⏳ Waiting for transaction confirmation...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      // Check final wallet balance
      const finalBalance = await this.getWalletInfo();
      console.log(`Final wallet balance: ${finalBalance.balance} ADA`);
      
      const balanceDiff = finalBalance.balance - initialBalance.balance;
      console.log(`Balance difference: ${balanceDiff} ADA`);

      // Check contract UTxOs after signup
      const utxosAfter = await this.getContractUtxos();
      console.log(`Contract UTxOs after signup: ${utxosAfter.length}`);

      if (balanceDiff > 1.5) { // Accounting for fees
        console.log("✅ Refund mechanism working correctly!");
      } else {
        console.log("❌ Refund may not have worked properly");
      }

    } catch (error) {
      console.error("❌ Refund test failed:", error);
    }
  }

  // 5. Get Contract UTxOs (for monitoring)
  async getContractUtxos(): Promise<UTxO[]> {
    return await this.lucid.utxosAt(DEPLOYED_CONTRACT.scriptAddress);
  }

  // 6. Get wallet balance and info
  async getWalletInfo() {
    const address = await this.lucid.wallet.address();
    const utxos = await this.lucid.wallet.getUtxos();
    const balance = utxos.reduce((sum, utxo) => sum + utxo.assets.lovelace, 0n);
    
    return {
      address,
      balance: Number(balance) / 1_000_000,
      utxoCount: utxos.length
    };
  }

  // 7. Helper function to check transaction status
  async waitForTransaction(txHash: string, maxWaitTime: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const utxos = await this.lucid.utxosByOutRef([{ txHash, outputIndex: 0 }]);
        if (utxos.length > 0) {
          return true;
        }
      } catch (error) {
        // Transaction not yet confirmed
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
    
    return false;
  }
}

// Example usage and testing functions
export async function testContractInteractions(): Promise<void> {
  const seedPhrase = "blame purpose battle mistake match cousin degree route bag return clump key metal actress poet outside group sword bring gravity weapon report alone dove";
  
  try {
    console.log("🚀 Initializing K33P Contract...");
    const contract = await K33PContract.initialize(seedPhrase);
    
    // Test 1: Check what data is currently stored
    console.log("\n=== Test 1: Inspect Current Contract Data ===");
    await contract.inspectContractData();
    
    // Test 2: Store auth data (phone + PIN)
    console.log("\n=== Test 2: Store Authentication Data (Phone + PIN) ===");
    const phoneNumber = "+1234567890";
    const pin = "1234";
    await contract.storeAuthData(phoneNumber, pin);
    
    // Test 3: Test the refund mechanism
    console.log("\n=== Test 3: Test 2 ADA Refund Mechanism ===");
    await contract.testRefundMechanism();
    
    // Test 4: Final contract state
    console.log("\n=== Test 4: Final Contract State ===");
    await contract.inspectContractData();
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run tests if called directly
if (typeof require !== 'undefined' && require.main === module) {
  testContractInteractions();
}