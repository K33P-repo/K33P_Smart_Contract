import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
  secretKey(context: __compactRuntime.WitnessContext<Ledger, T>): [T, Uint8Array];
}

export type ImpureCircuits<T> = {
  register_nok(context: __compactRuntime.CircuitContext<T>,
               owner_identifier_0: bigint,
               nok_hash_0: bigint): __compactRuntime.CircuitResults<T, []>;
  approve_nok_login(context: __compactRuntime.CircuitContext<T>,
                    owner_identifier_0: bigint,
                    nok_hash_0: bigint): __compactRuntime.CircuitResults<T, boolean>;
  check_nok_registered(context: __compactRuntime.CircuitContext<T>,
                       owner_identifier_0: bigint): __compactRuntime.CircuitResults<T, boolean>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  register_nok(context: __compactRuntime.CircuitContext<T>,
               owner_identifier_0: bigint,
               nok_hash_0: bigint): __compactRuntime.CircuitResults<T, []>;
  approve_nok_login(context: __compactRuntime.CircuitContext<T>,
                    owner_identifier_0: bigint,
                    nok_hash_0: bigint): __compactRuntime.CircuitResults<T, boolean>;
  check_nok_registered(context: __compactRuntime.CircuitContext<T>,
                       owner_identifier_0: bigint): __compactRuntime.CircuitResults<T, boolean>;
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

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<T>): __compactRuntime.ConstructorResult<T>;
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
