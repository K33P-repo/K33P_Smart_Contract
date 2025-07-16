export declare class IagonAPI {
    findUser(query: any): Promise<null>;
    createUser(data: any): Promise<any>;
    findUserById(id: string): Promise<null>;
    createSession(data: any): Promise<any>;
    deleteSessions(query: any): Promise<boolean>;
    findScriptUtxo(query: any): Promise<null>;
    createScriptUtxo(data: any): Promise<any>;
    updateScriptUtxo(id: string, data: any): Promise<any>;
    findScriptUtxos(query: any): Promise<never[]>;
    storeData(key: string, data: string): Promise<string>;
    retrieveData(storageId: string): Promise<string>;
    updateData(storageId: string, data: string): Promise<void>;
    deleteData(storageId: string): Promise<void>;
}
export default IagonAPI;
//# sourceMappingURL=iagon.d.ts.map