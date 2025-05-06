use aiken/hash
use aiken/bytearray
use aiken/transaction/credential

// Define our validator types
type DatumType {
  hashed_seed: ByteArray,
  owner: Credential,
}

type RedeemerType {
  action: Action,
  seed_phrase: ByteArray,
}

type Action {
  Verify
  Update
}

// Main validator function
validator {
  fn seed_phrase_manager(datum: DatumType, redeemer: RedeemerType, context: ScriptContext) -> Bool {
    // Extract the transaction information
    let ScriptContext { transaction, purpose } = context
    
    // We only care about spending
    when purpose is {
      Spending(output_reference) -> {
        // Check that the transaction is signed by the owner
        must_be_signed_by(transaction, datum.owner) &&
          // Handle different actions
          when redeemer.action is {
            // Verify action: check if provided seed_phrase hashes to stored value
            Verify -> {
              let hashed_input = hash_seed_phrase(redeemer.seed_phrase)
              hashed_input == datum.hashed_seed
            }
            
            // Update action: update the hashed seed phrase
            Update -> {
              // Ensure new datum contains new hashed seed phrase
              let new_output = must_find_script_output(transaction, purpose)
              let new_datum: DatumType = new_output.datum
              
              // Verify the new hash is valid
              let hashed_input = hash_seed_phrase(redeemer.seed_phrase)
              new_datum.hashed_seed == hashed_input &&
                new_datum.owner == datum.owner
            }
          }
      }
      _ -> False
    }
  }
}

// Helper function to hash a seed phrase
fn hash_seed_phrase(seed_phrase: ByteArray) -> ByteArray {
  // Use double-hashing for extra security
  hash.blake2b_256(hash.sha2_256(seed_phrase))
}

// Helper to check signatures
fn must_be_signed_by(transaction: Transaction, credential: Credential) -> Bool {
  list.has(transaction.extra_signatories, credential.hash) ||
    when credential is {
      VerificationKeyCredential(vk) -> list.has(transaction.extra_signatories, vk)
      ScriptCredential(_) -> False
    }
}

// Helper to find outputs containing our script
fn must_find_script_output(transaction: Transaction, purpose: ScriptPurpose) -> Output {
  // Implementation would find the correct output 
  // based on the transaction outputs that contain our script address
  // This is pseudocode, actual implementation would be more detailed
  let script_address = get_script_address(purpose)
  
  when list.find(transaction.outputs, fn(output) { output.address == script_address }) is {
    Some(output) -> output
    None -> error("No script output found")
  }
}

// Helper to get script address
fn get_script_address(purpose: ScriptPurpose) -> Address {
  // Implementation would extract the script address from the purpose
  // Pseudocode for now
  when purpose is {
    Spending(output_reference) -> /*derive address logic*/
    _ -> error("Not a spending purpose")
  }
}