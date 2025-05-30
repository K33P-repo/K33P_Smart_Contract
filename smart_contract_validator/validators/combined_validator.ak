// k33p_validator_enhanced.ak - Enhanced K33P Identity Validator with Refund Logic
// Author: Emmanuel Joseph (K33P smart contract Developer)
// Built with Aiken v1.1.0+ standards - Enhanced Version

use aiken/collection/list
use aiken/interval.{Finite, Interval, IntervalBound}
use aiken/primitive/bytearray
use aiken/primitive/string
use cardano/address.{Address, Credential}
use cardano/assets
use cardano/transaction.{Output, OutputReference, Transaction}

// Protocol Constants
const min_lovelace: Int = 2_000_000

const refund_amount: Int = 2_000_000

const phone_hash_length: Int = 32

const proof_length: Int = 64

const max_time_window: Int = 86400

// 1 day in slots

const max_user_id_length: Int = 50

const min_user_id_length: Int = 3

const max_reason_length: Int = 200

// Core Types
pub type AuthData {
  phone_hash: ByteArray,
  created_at: Int,
}

pub type AuthDatum {
  version: Int,
  auth_data: AuthData,
  is_active: Bool,
  nonce: Int,
}

pub type AuthRedeemer {
  StoreAuthData { auth_data: AuthData, signature: ByteArray }
  UpdateAuthData { auth_data: AuthData, signature: ByteArray }
  DeactivateAuthData { signature: ByteArray }
}

pub type SignupDatumValue {
  wallet: Address,
  user_id: String,
  zk_proof: ByteArray,
  timestamp: Int,
}

pub type RefundDatumValue {
  wallet: Address,
  refund_amount: Int,
  reason: String,
  timestamp: Int,
}

pub type DeleteDatumValue {
  wallet: Address,
  timestamp: Int,
}

pub type IdentityDatum {
  SignupDatum(SignupDatumValue)
  RefundDatum(RefundDatumValue)
  DeleteDatum(DeleteDatumValue)
}

pub type IdentityRedeemer {
  ProcessSignup { signature: ByteArray }
  ProcessRefund { signature: ByteArray }
  ProcessDeletion { signature: ByteArray }
}

pub type K33pDatum {
  AuthDatumType(AuthDatum)
  IdentityDatumType(IdentityDatum)
}

pub type K33pRedeemer {
  AuthRedeemerType(AuthRedeemer)
  IdentityRedeemerType(IdentityRedeemer)
}

// Utility Functions
fn get_lovelace_amount(output: Output) -> Int {
  assets.lovelace_of(output.value)
}

fn get_verification_key(addr: Address) -> Option<ByteArray> {
  when addr.payment_credential is {
    Credential.VerificationKey(vk) -> Some(vk)
    Credential.Script(_) -> None
  }
}

fn get_finite_value(bound: IntervalBound<Int>) -> Option<Int> {
  when bound.bound_type is {
    Finite(b) -> Some(b)
    _ -> None
  }
}

fn validate_timing(tx: Transaction, expected_timestamp: Int) -> Bool {
  let lower = get_finite_value(tx.validity_range.lower_bound)
  let upper = get_finite_value(tx.validity_range.upper_bound)
  when (lower, upper) is {
    (Some(l), Some(u)) -> {
      let time_window = u - l
      time_window <= max_time_window && time_window >= 0 && expected_timestamp >= l && expected_timestamp <= u
    }
    _ -> False
  }
}

// Validators
fn validate_phone_hash(phone_hash: ByteArray) -> Bool {
  bytearray.length(phone_hash) == phone_hash_length && phone_hash != #""
}

fn validate_zk_proof(proof: ByteArray) -> Bool {
  bytearray.length(proof) == proof_length && proof != #""
}

fn validate_user_id(user_id: String) -> Bool {
  let user_id_bytes = string.to_bytearray(user_id)
  let len = bytearray.length(user_id_bytes)
  len >= min_user_id_length && len <= max_user_id_length && user_id_bytes != #""
}

fn validate_refund_reason(reason: String) -> Bool {
  let reason_bytes = string.to_bytearray(reason)
  let len = bytearray.length(reason_bytes)
  len > 0 && len <= max_reason_length && reason_bytes != #""
}

fn validate_auth_data(data: AuthData) -> Bool {
  validate_phone_hash(data.phone_hash) && data.created_at > 0 && data.created_at < 2147483647
}

fn validate_signup_data(data: SignupDatumValue) -> Bool {
  validate_user_id(data.user_id) && validate_zk_proof(data.zk_proof) && data.timestamp > 0 && data.timestamp < 2147483647
}

fn validate_refund_data(data: RefundDatumValue) -> Bool {
  data.refund_amount > 0 && data.refund_amount <= 1000000000000 && validate_refund_reason(
    data.reason,
  ) && data.timestamp > 0 && data.timestamp < 2147483647
}

fn validate_delete_data(data: DeleteDatumValue) -> Bool {
  data.timestamp > 0 && data.timestamp < 2147483647
}

fn validate_min_ada(output: Output) -> Bool {
  get_lovelace_amount(output) >= min_lovelace
}

fn validate_wallet_authorization(wallet: Address, tx: Transaction) -> Bool {
  when get_verification_key(wallet) is {
    Some(vk) -> list.has(tx.extra_signatories, vk)
    None -> False
  }
}

// ✨ SIGNUP REFUND VALIDATION
fn validate_signup_refund(tx: Transaction, wallet: Address) -> Bool {
  let paid_input =
    list.any(
      tx.inputs,
      fn(input) {
        input.output.address == wallet && get_lovelace_amount(input.output) >= refund_amount
      },
    )

  let refunded_output =
    list.any(
      tx.outputs,
      fn(output) {
        output.address == wallet && get_lovelace_amount(output) == refund_amount
      },
    )

  paid_input && refunded_output
}

// Main Validation Branches
fn validate_auth_redeemer_spend(
  datum: AuthDatum,
  redeemer: AuthRedeemer,
  tx: Transaction,
) -> Bool {
  when redeemer is {
    StoreAuthData { auth_data, signature: _ } ->
      validate_auth_data(auth_data) && validate_timing(tx, auth_data.created_at) && datum.is_active && datum.version > 0

    UpdateAuthData { auth_data, signature: _ } ->
      validate_auth_data(auth_data) && validate_timing(tx, auth_data.created_at) && datum.is_active && datum.version > 0 && auth_data.created_at >= datum.auth_data.created_at

    DeactivateAuthData { signature: _ } ->
      validate_timing(tx, datum.auth_data.created_at) && datum.is_active
  }
}

fn validate_identity_redeemer_spend(
  datum: IdentityDatum,
  redeemer: IdentityRedeemer,
  tx: Transaction,
) -> Bool {
  when (datum, redeemer) is {
    (SignupDatum(signup_data), ProcessSignup { signature: _ }) -> {
      let signup_valid = validate_signup_data(signup_data)
      let timing_valid = validate_timing(tx, signup_data.timestamp)
      let auth_valid = validate_wallet_authorization(signup_data.wallet, tx)
      let refund_valid = validate_signup_refund(tx, signup_data.wallet)

      signup_valid && timing_valid && auth_valid && refund_valid
    }

    (RefundDatum(refund_data), ProcessRefund { signature: _ }) ->
      validate_refund_data(refund_data) && validate_timing(
        tx,
        refund_data.timestamp,
      ) && validate_wallet_authorization(refund_data.wallet, tx)

    (DeleteDatum(delete_data), ProcessDeletion { signature: _ }) ->
      validate_delete_data(delete_data) && validate_timing(
        tx,
        delete_data.timestamp,
      ) && validate_wallet_authorization(delete_data.wallet, tx)

    _ -> False
  }
}

fn validate_outputs(tx: Transaction) -> Bool {
  list.all(tx.outputs, validate_min_ada)
}

// 🔒 Validator Entry Point
validator k33p_validator {
  spend(
    datum: Option<K33pDatum>,
    redeemer: K33pRedeemer,
    _utxo: OutputReference,
    ctx: Transaction,
  ) {
    validate_outputs(ctx) && when datum is {
      Some(actual_datum) ->
        when (actual_datum, redeemer) is {
          (AuthDatumType(auth_datum), AuthRedeemerType(auth_redeemer)) ->
            validate_auth_redeemer_spend(auth_datum, auth_redeemer, ctx)

          (
            IdentityDatumType(identity_datum),
            IdentityRedeemerType(identity_redeemer),
          ) ->
            validate_identity_redeemer_spend(
              identity_datum,
              identity_redeemer,
              ctx,
            )

          _ -> False
        }
      None -> False
    }
  }

  else(_ctx) {
    False
  }
}
