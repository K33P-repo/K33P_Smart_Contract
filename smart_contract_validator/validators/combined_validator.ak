use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use aiken/primitive/bytearray
use cardano/address.{Address, VerificationKey}
use cardano/transaction.{Transaction, Output}

//
// TYPES
//

pub type AuthData {
  phone_hash: ByteArray,
}

pub type AuthDatum {
  version: Int,
  auth_data: AuthData,
  is_active: Bool,
}

pub type AuthRedeemer {
  StoreAuthData(AuthData)
  UpdateAuthData(AuthData)
  DeleteAuthData
}

pub type SignupDatumValue {
  wallet: Address,
  user_id: String,
  zk_proof: ByteArray,
}

pub type RefundDatumValue {
  wallet: Address,
  refund_amount: Int,
}

pub type DeleteDatumValue {
  wallet: Address,
}

pub type IdentityDatum {
  SignupDatum(SignupDatumValue)
  RefundDatum(RefundDatumValue)
  DeleteDatum(DeleteDatumValue)
}

pub type IdentityRedeemer {
  SignupRedeemer
  RefundRedeemer
  DeleteRedeemer
}

pub type K33pDatum {
  AuthDatumType(AuthDatum)
  IdentityDatumType(IdentityDatum)
}

pub type K33pRedeemer {
  AuthRedeemerType(AuthRedeemer)
  IdentityRedeemerType(IdentityRedeemer)
}

//
// HELPER FUNCTIONS
//

fn validate_auth_transaction(
  datum: Option<AuthDatum>,
  redeemer: AuthRedeemer,
  tx: Transaction,
) -> Bool {
  when redeemer is {
    StoreAuthData(data) ->
      when datum is {
        None -> bytearray.length(data.phone_hash) == 28
        Some(_) -> False
      }

    UpdateAuthData(data) ->
      when datum is {
        Some(existing) ->
          existing.is_active &&
          bytearray.length(data.phone_hash) == 28 &&
          list.length(tx.extra_signatories) > 0
        None -> False
      }

    DeleteAuthData ->
      when datum is {
        Some(existing) ->
          existing.is_active &&
          list.length(tx.extra_signatories) > 0
        None -> False
      }
  }
}

fn validate_identity_transaction(
  datum: Option<IdentityDatum>,
  redeemer: IdentityRedeemer,
  tx: Transaction,
) -> Bool {
  when (datum, redeemer) is {
    (Some(SignupDatum(value)), SignupRedeemer) -> {
      let wallet_credential =
        when value.wallet.payment_credential is {
          VerificationKey(vk) -> Some(vk)
          _ -> None
        }

      when wallet_credential is {
        Some(cred) -> list.has(tx.extra_signatories, cred)
        None -> False
      }
    }

    (Some(RefundDatum(value)), RefundRedeemer) ->
      value.refund_amount > 0

    (Some(DeleteDatum(value)), DeleteRedeemer) -> {
      let wallet_credential =
        when value.wallet.payment_credential is {
          VerificationKey(vk) -> Some(vk)
          _ -> None
        }

      when wallet_credential is {
        Some(cred) -> list.has(tx.extra_signatories, cred)
        None -> False
      }
    }

    _ -> False
  }
}

//
// VALIDATOR FUNCTION
//

validator k33p_validator {
  spend(
    datum: Option<K33pDatum>,
    redeemer: K33pRedeemer,
    _utxo,
    tx: Transaction,
  ) -> Bool {
    when (datum, redeemer) is {
      (Some(AuthDatumType(auth_datum)), AuthRedeemerType(auth_redeemer)) ->
        validate_auth_transaction(Some(auth_datum), auth_redeemer, tx)

      (None, AuthRedeemerType(auth_redeemer)) ->
        validate_auth_transaction(None, auth_redeemer, tx)

      (Some(IdentityDatumType(identity_datum)), IdentityRedeemerType(identity_redeemer)) ->
        validate_identity_transaction(Some(identity_datum), identity_redeemer, tx)

      (None, IdentityRedeemerType(identity_redeemer)) ->
        validate_identity_transaction(None, identity_redeemer, tx)

      _ -> False
    }
  }
}

