import * as readline from "readline/promises";
import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NetworkId, setNetworkId, getZswapNetworkId, getLedgerNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { createBalancedTx } from "@midnight-ntwrk/midnight-js-types";
import { Transaction } from "@midnight-ntwrk/ledger";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import { WebSocket } from "ws";
import * as path from "path";
import * as fs from "fs";
import * as Rx from "rxjs";
// Fix WebSocket for Node.js
// @ts-ignore
globalThis.WebSocket = WebSocket;
// Configure for Midnight Testnet
setNetworkId(NetworkId.TestNet);
const TESTNET_CONFIG = {
    indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
    indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
    node: "https://rpc.testnet-02.midnight.network",
    proofServer: "http://127.0.0.1:6300"
};
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log("NOK Access Admin Interface\n");
    try {
        // Check for deployment file
        if (!fs.existsSync("deployment.json")) {
            console.error("No deployment.json found! Deploy contract first.");
            process.exit(1);
        }
        const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
        console.log(`Contract: ${deployment.contractAddress}\n`);
        // Get admin wallet seed
        const walletSeed = await rl.question("Enter admin wallet seed: ");
        console.log("\nConnecting to Midnight network...");
        // Build wallet
        const wallet = await WalletBuilder.buildFromSeed(TESTNET_CONFIG.indexer, TESTNET_CONFIG.indexerWS, TESTNET_CONFIG.proofServer, TESTNET_CONFIG.node, walletSeed, getZswapNetworkId(), "info");
        wallet.start();
        // Wait for sync
        await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.syncProgress?.synced === true)));
        // Load contract
        const contractPath = path.join(process.cwd(), "contracts");
        const contractModulePath = path.join(contractPath, "managed", "nok-access", "contract", "index.cjs");
        const NOKAccessModule = await import(contractModulePath);
        // Get admin secret key (you'll need to implement this)
        const adminSecretKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf-8");
        const contractInstance = new NOKAccessModule.Contract({
            secretKey: () => adminSecretKey
        });
        // Create wallet provider
        const walletState = await Rx.firstValueFrom(wallet.state());
        const walletProvider = {
            coinPublicKey: walletState.coinPublicKey,
            encryptionPublicKey: walletState.encryptionPublicKey,
            balanceTx(tx, newCoins) {
                return wallet
                    .balanceTransaction(ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()), newCoins)
                    .then((tx) => wallet.proveTransaction(tx))
                    .then((zswapTx) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
                    .then(createBalancedTx);
            },
            submitTx(tx) {
                return wallet.submitTransaction(tx);
            }
        };
        // Configure providers
        const zkConfigPath = path.join(contractPath, "managed", "nok-access");
        const providers = {
            privateStateProvider: levelPrivateStateProvider({
                privateStateStoreName: "nok-access-state"
            }),
            publicDataProvider: indexerPublicDataProvider(TESTNET_CONFIG.indexer, TESTNET_CONFIG.indexerWS),
            zkConfigProvider: new NodeZkConfigProvider(zkConfigPath),
            proofProvider: httpClientProofProvider(TESTNET_CONFIG.proofServer),
            walletProvider: walletProvider,
            midnightProvider: walletProvider
        };
        // Connect to contract
        const deployed = await findDeployedContract(providers, {
            contractAddress: deployment.contractAddress,
            contract: contractInstance,
            privateStateId: "nokAccessState",
            initialPrivateState: { secretKey: adminSecretKey }
        });
        console.log("Connected to contract\n");
        // Main menu loop
        let running = true;
        while (running) {
            console.log("--- Admin Menu ---");
            console.log("1. Register NOK");
            console.log("2. Approve NOK Login");
            console.log("3. Check NOK Registration");
            console.log("4. Exit");
            const choice = await rl.question("\nYour choice: ");
            switch (choice) {
                case "1":
                    // Register NOK implementation
                    console.log("\nRegister NOK...");
                    const ownerIdentifier = await rl.question("Owner identifier (Field): ");
                    const nokHash = await rl.question("NOK hash (Field): ");
                    try {
                        const tx = await deployed.callTx.register_nok(ownerIdentifier, nokHash);
                        console.log("Success!");
                        console.log(`Transaction ID: ${tx.public.txId}`);
                        console.log(`Block height: ${tx.public.blockHeight}\n`);
                    }
                    catch (error) {
                        console.error("Failed to register NOK:", error);
                    }
                    break;
                case "2":
                    // Approve NOK login implementation
                    console.log("\nApprove NOK Login...");
                    const loginOwnerIdentifier = await rl.question("Owner identifier (Field): ");
                    const loginNokHash = await rl.question("NOK hash (Field): ");
                    try {
                        const tx = await deployed.callTx.approve_nok_login(loginOwnerIdentifier, loginNokHash);
                        console.log("Success!");
                        console.log(`Transaction ID: ${tx.public.txId}`);
                        console.log(`Block height: ${tx.public.blockHeight}\n`);
                    }
                    catch (error) {
                        console.error("Failed to approve login:", error);
                    }
                    break;
                case "3":
                    // Check registration
                    console.log("\nCheck NOK Registration...");
                    const checkOwnerIdentifier = await rl.question("Owner identifier (Field): ");
                    try {
                        const result = await deployed.callTx.check_nok_registered(checkOwnerIdentifier);
                        console.log(`Registered: ${result}\n`);
                    }
                    catch (error) {
                        console.error("Failed to check registration:", error);
                    }
                    break;
                case "4":
                    running = false;
                    console.log("\nGoodbye!");
                    break;
                default:
                    console.log("Invalid choice. Please enter 1-4.\n");
            }
        }
        await wallet.close();
    }
    catch (error) {
        console.error("\nError:", error);
    }
    finally {
        rl.close();
    }
}
main().catch(console.error);
