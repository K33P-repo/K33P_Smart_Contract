export declare const getSchemaForEndpoint: (endpointName: string) => any;
export declare const generateSchemas: () => Record<string, unknown>;
export declare const getSchema: (schemaName: string) => any;
export declare const validateSchema: (schemaName: string, input: unknown) => {
    isValid: boolean;
    errors: import("ajv").ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;
};
