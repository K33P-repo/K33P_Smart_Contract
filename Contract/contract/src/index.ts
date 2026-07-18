// SPDX-License-Identifier: Apache-2.0
//
// Public entrypoint for the NOK contract package.
//   • `Nok`        — the compiled contract (Contract, ledger, pureCircuits)
//   • witness API  — private-state helpers implemented in TypeScript

export * as Nok from './managed/nok/contract/index.js';
export * from './nok-witnesses.js';
