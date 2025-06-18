declare const _default: {
    type: string;
    items: {
        type: string;
        properties: {
            address: {
                type: string;
                description: string;
            };
            tx_hash: {
                type: string;
                description: string;
            };
            block_height: {
                type: string;
                description: string;
            };
            tx_index: {
                type: string;
                description: string;
            };
            payload: {};
        };
        required: string[];
    };
};
export default _default;
