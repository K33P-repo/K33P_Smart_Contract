export declare function findUser(query: any): Promise<any>;
export declare function createUser(data: any): Promise<any>;
export declare function findUserById(id: string): Promise<any>;
export declare function createSession(data: any): Promise<any>;
export declare function deleteSessions(query: any): Promise<boolean>;
export declare function findScriptUtxo(query: any): Promise<any>;
export declare function createScriptUtxo(data: any): Promise<any>;
export declare function updateScriptUtxo(id: string, data: any): Promise<any>;
export declare function findScriptUtxos(query: any): Promise<any[]>;
export declare function storeData(key: string, data: string): Promise<any>;
export declare function retrieveData(storageId: string): Promise<any>;
export declare function updateData(storageId: string, data: string): Promise<any>;
export declare function deleteData(storageId: string): Promise<boolean>;
//# sourceMappingURL=iagon.d.ts.map