import { redisClient } from './src/utils/redis.js';

async function clearLimits() {
  console.log("Clearing limits for 2349161018275...");
  await redisClient.del('otp:2349161018275');
  await redisClient.del('rate:otp:2349161018275');
  console.log("Cleared!");
  process.exit();
}

clearLimits();
