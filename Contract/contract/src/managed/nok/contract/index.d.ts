import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  secretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  register_nok(context: __compactRuntime.CircuitContext<PS>,
               owner_identifier_0: bigint,
               nok_hash_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  approve_nok_login(context: __compactRuntime.CircuitContext<PS>,
                    owner_identifier_0: bigint,
                    nok_hash_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  check_nok_registered(context: __compactRuntime.CircuitContext<PS>,
                       owner_identifier_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  register_nok(context: __compactRuntime.CircuitContext<PS>,
               owner_identifier_0: bigint,
               nok_hash_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  approve_nok_login(context: __compactRuntime.CircuitContext<PS>,
                    owner_identifier_0: bigint,
                    nok_hash_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  check_nok_registered(context: __compactRuntime.CircuitContext<PS>,
                       owner_identifier_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  publicKey(sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  publicKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  register_nok(context: __compactRuntime.CircuitContext<PS>,
               owner_identifier_0: bigint,
               nok_hash_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  approve_nok_login(context: __compactRuntime.CircuitContext<PS>,
                    owner_identifier_0: bigint,
                    nok_hash_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  check_nok_registered(context: __compactRuntime.CircuitContext<PS>,
                       owner_identifier_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  noks: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { nokHash: bigint,
                             ownerIdentifier: bigint,
                             registeredAt: bigint
                           };
    [Symbol.iterator](): Iterator<[bigint, { nokHash: bigint, ownerIdentifier: bigint, registeredAt: bigint }]>
  };
  readonly admin: Uint8Array;
  readonly round: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               adminPublicKey_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
