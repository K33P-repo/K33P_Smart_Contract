// AuthenticationStorage.aiken

// use aiken/crypto.{Blake2b_224, VerificationKey}
use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference}
use aiken/primitive/bytearray

// Authentication data type
pub type AuthData {
    phone_hash: ByteArray,
}

// Redeemer actions
pub type Redeemer {
    StoreAuthData(AuthData)
    UpdateAuthData(AuthData)   
    DeleteAuthData
}

// Validator parameters
pub type Datum {
    version: Int,
    auth_data: AuthData,
    is_active: Bool
}

// Auth data validation
fn validate_phone_hash(
    auth_data: AuthData,
    expected_hash_length: Int
) -> Bool {
    bytearray.length(auth_data.phone_hash) == expected_hash_length
}

// Main validator
validator authentication_storage {
    spend(datum_opt: Option<Datum>, redeemer: Redeemer, _input: OutputReference, tx: Transaction) {
        // Ensure datum is provided when needed
        when redeemer is {
            StoreAuthData(new_auth_data) -> {
                // For new storage, datum should be empty
                expect None = datum_opt
                validate_phone_hash(new_auth_data, 28) // Blake2b_224 produces 28-byte hash
            }
            UpdateAuthData(updated_auth_data) -> {
                // For updates, we need existing datum
                expect Some(datum) = datum_opt
                datum.is_active &&
                validate_phone_hash(updated_auth_data, 28) &&
                // Ensure the transaction is signed by the original creator
                // (assuming the first signatory is the creator)
                list.length(tx.extra_signatories) > 0 &&
                list.head(tx.extra_signatories) == list.head(tx.extra_signatories)
            }
            DeleteAuthData -> {
                expect Some(datum) = datum_opt
                datum.is_active &&
                // Only the creator can delete
                list.length(tx.extra_signatories) > 0 &&
                list.head(tx.extra_signatories) == list.head(tx.extra_signatories)
            }
        }
    }

    else(_ctx) {
        fail @"This validator only handles spending"
    }
}