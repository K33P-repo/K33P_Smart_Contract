// Create private state helper
export function createNOKAccessPrivateState(secretKey) {
    return { secretKey };
}
// Implement witness functions matching the Witnesses<T> type
export const witnesses = {
    secretKey: ({ privateState }) => {
        return [privateState, privateState.secretKey];
    },
};
