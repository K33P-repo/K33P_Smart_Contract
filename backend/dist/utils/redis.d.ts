declare class UpstashRedis {
    private baseUrl;
    private token;
    constructor();
    private request;
    set(key: string, value: string, options?: {
        EX?: number;
    }): Promise<any>;
    get(key: string): Promise<any>;
    del(key: string): Promise<any>;
    incr(key: string): Promise<any>;
    expire(key: string, seconds: number): Promise<any>;
    ttl(key: string): Promise<any>;
}
export declare const redisClient: UpstashRedis;
export {};
//# sourceMappingURL=redis.d.ts.map