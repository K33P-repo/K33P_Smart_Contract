// SPDX-License-Identifier: Apache-2.0
//
// Witness (private-state) implementations for the NOK contract.
//
// The NOK contract has a single witness — `secretKey()` — which returns the
// admin's 32-byte secret. This secret never leaves the operator machine; the
// circuit re-derives the admin public key from it and compares against the
// on-chain `admin` cell.

import { type WitnessContext } from '@midnight-ntwrk/compact-runtime';

/** Private state held off-chain by the NOK operator (the K33P backend). */
export type NokPrivateState = {
  /** The admin secret key (32 bytes). Used to pass the admin check. */
  readonly secretKey: Uint8Array;
};

/** Witness function type definitions matching the compiled contract. */
export type NokWitnesses = {
  secretKey: (context: WitnessContext<NokPrivateState>) => [NokPrivateState, Uint8Array];
};

/** Witness implementations. */
export const nokWitnesses: NokWitnesses = {
  secretKey: ({ privateState }): [NokPrivateState, Uint8Array] => [privateState, privateState.secretKey],
};

/** Build the initial private state from a 32-byte admin secret. */
export function createNokPrivateState(secretKey: Uint8Array): NokPrivateState {
  if (secretKey.length !== 32) {
    throw new Error('Admin secret key must be exactly 32 bytes');
  }
  return { secretKey };
}
