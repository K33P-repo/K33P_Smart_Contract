export function getScriptAddress(): Promise<string>;
export function signupTxBuilder(userAddress: any, userData: any): Promise<string>;
export function refundTx(ownerAddress: any, utxo: any): Promise<string>;
export function fetchUtxos(phoneHashHex: any): Promise<import("lucid-cardano").UTxO[]>;
export function initLucid(): Promise<Lucid>;
import { Lucid } from "lucid-cardano";
//# sourceMappingURL=lucid.d.ts.map