// src/env.ts parses the environment at import time, so anything that transitively
// imports it needs a valid environment before the module graph loads. These are
// throwaway values; tests that care about configuration call parseEnv() directly
// with their own input.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://simpleinvoice:invoice@localhost:5433/simpleinvoice';
process.env.JWT_SECRET ??= 'unit-test-signing-key-that-is-long-enough';
