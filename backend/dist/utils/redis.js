import { logger } from './logger.js';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
if (!UPSTASH_REDIS_REST_URL)
    logger.error('❌ UPSTASH_REDIS_REST_URL missing in .env');
if (!UPSTASH_REDIS_REST_TOKEN)
    logger.error('❌ UPSTASH_REDIS_REST_TOKEN missing in .env');
class UpstashRedis {
    baseUrl;
    token;
    constructor() {
        this.baseUrl = UPSTASH_REDIS_REST_URL || '';
        this.token = UPSTASH_REDIS_REST_TOKEN || '';
    }
    async request(command, ...args) {
        if (!this.baseUrl || !this.token) {
            throw new Error('Redis not configured');
        }
        // ✅ Post to root with full command + args in body array
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([command, ...args]),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Redis Error ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        return data.result;
    }
    async set(key, value, options) {
        if (options?.EX) {
            return this.request('SET', key, value, 'EX', options.EX);
        }
        return this.request('SET', key, value);
    }
    async get(key) {
        return this.request('GET', key);
    }
    async del(key) {
        return this.request('DEL', key);
    }
    async incr(key) {
        return this.request('INCR', key);
    }
    async expire(key, seconds) {
        return this.request('EXPIRE', key, seconds);
    }
    async ttl(key) {
        return this.request('TTL', key);
    }
}
export const redisClient = new UpstashRedis();
//# sourceMappingURL=redis.js.map