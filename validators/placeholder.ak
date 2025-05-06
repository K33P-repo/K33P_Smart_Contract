use aiken/hash.{blake2b_256, sha2_256}
use aiken/bytearray
use aiken/transaction.{ScriptContext, Transaction, Spending, OutputReference, Output}
use aiken/list
use aiken/option.{Option, None, Some}
use aiken/transaction/credential.{Credential, VerificationKeyCredential, ScriptCredential}

type Datum {
    hashed_seed: ByteArray,
    owner: Credential,
}

type Redeemer {
    action: Action,
    seed_phrase: ByteArray,
}

type Action {
    Verify
    Update
}

validator seed_phrase_manager {
    spend(datum: Datum, redeemer: Redeemer, context: ScriptContext) {
        let tx = context.transaction
        let is_owner = is_signed_by(tx, datum.owner)
        
        if is_owner {
            case redeemer.action {
                Verify {verify_seed(datum, redeemer)}
                Update { update_seed(tx, context.purpose, datum, redeemer) }
            }
        } else {
            False
        }
    }
}

fn verify_seed(datum: Datum, redeemer: Redeemer) -> Bool {
    hash_seed(redeemer.seed_phrase) == datum.hashed_seed
}

// fn update_seed(tx: Transaction, purpose: ScriptPurpose, old_datum: Datum, redeemer: Redeemer) -> Bool {
//     let new_hashed_seed = hash_seed(redeemer.seed_phrase)
    
//     case purpose {
//         Spending(output_ref) {
//             find_script_output(tx, output_ref)
//                 |> option.and_then(fn(output) {
//                     case output.datum {
//                         Some(new_datum) ->
//                             Some(
//                                 new_datum.hashed_seed == new_hashed_seed
//                                 && new_datum.owner == old_datum.owner
//                             )
//                         None -> None
//                     }
//                 })
//                 |> option.with_default(False)
//         _ 
//         }-> False
//     }
// }

fn hash_seed(seed: ByteArray) -> ByteArray {
    seed |> blake2b_256 // Simplified to one hash
}

fn is_signed_by(tx: Transaction, credential: Credential) -> Bool {
    case credential {
        VerificationKeyCredential(vkh) {
          list.has(tx.signatories, vkh)
        }
            
        ScriptCredential(_) -{
          False
        } 
            
    }
}

fn find_script_output(tx: Transaction, output_ref: OutputReference) -> Option<Output> {
    tx.outputs
        |> list.find(fn(output) {
            // Adjust based on actual Output type
            // Placeholder: assumes Output has a reference field
            output.reference == output_ref
        })
}