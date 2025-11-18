import { Contract, Witnesses } from '../contracts/managed/nok-access/contract/index.cjs';

// Define private state type
export type NOKAccessPrivateState = {
  secretKey: Uint8Array;
};

// Create private state helper
export function createNOKAccessPrivateState(secretKey: Uint8Array): NOKAccessPrivateState {
  return { secretKey };
}

// Implement witness functions matching the Witnesses<T> type
export const witnesses: Witnesses<NOKAccessPrivateState> = {
  secretKey: ({ privateState }) => {
    return [privateState, privateState.secretKey];
  },
};