import "dotenv/config";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.AUTH_SECRET ??= "test-secret-that-is-at-least-thirty-two-characters-long";