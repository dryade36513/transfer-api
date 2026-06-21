/**
 * Lightweight verification for key-pool parsing logic (mirrors src/worker.js).
 * Run: node scripts/verify-key-pool.mjs
 */

function parseKeyList(value) {
  if (!value || typeof value !== "string") return [];
  return value.split(/[\n,]+/).map((key) => key.trim()).filter(Boolean);
}

function getUpstreamKeys(env) {
  const pool = parseKeyList(env.UNLIMITED_SURF_API_KEYS);
  if (pool.length) return pool;
  const single = env.UNLIMITED_SURF_API_KEY || env.API_KEY || env.AUTH_KEY;
  return single ? [single] : [];
}

function getWorkerKeys(env) {
  const pool = parseKeyList(env.WORKER_API_KEYS);
  if (pool.length) return pool;
  const single = env.WORKER_API_KEY;
  return single ? [single] : [];
}

const tests = [
  {
    name: "parseKeyList newline",
    run: () => {
      const keys = parseKeyList("a\nb\nc");
      if (keys.length !== 3 || keys[0] !== "a") throw new Error(`expected 3 keys, got ${keys}`);
    },
  },
  {
    name: "parseKeyList comma",
    run: () => {
      const keys = parseKeyList("a,b, c");
      if (keys.length !== 3) throw new Error(`expected 3 keys, got ${keys.length}`);
    },
  },
  {
    name: "upstream pool priority",
    run: () => {
      const keys = getUpstreamKeys({
        UNLIMITED_SURF_API_KEYS: "k1\nk2",
        UNLIMITED_SURF_API_KEY: "legacy",
      });
      if (keys.join(",") !== "k1,k2") throw new Error(`pool should win, got ${keys}`);
    },
  },
  {
    name: "upstream single fallback",
    run: () => {
      const keys = getUpstreamKeys({ UNLIMITED_SURF_API_KEY: "only" });
      if (keys.join(",") !== "only") throw new Error(`expected single fallback, got ${keys}`);
    },
  },
  {
    name: "worker pool whitelist",
    run: () => {
      const keys = getWorkerKeys({ WORKER_API_KEYS: "c1\nc2", WORKER_API_KEY: "legacy" });
      if (keys.length !== 2) throw new Error(`expected 2 worker keys, got ${keys.length}`);
    },
  },
  {
    name: "round-robin cursor simulation",
    run: () => {
      let cursor = 0;
      const pool = ["a", "b", "c"];
      const sequence = [];
      for (let i = 0; i < 7; i += 1) {
        const idx = cursor % pool.length;
        sequence.push(pool[idx]);
        cursor = (idx + 1) % pool.length;
      }
      const expected = ["a", "b", "c", "a", "b", "c", "a"];
      if (sequence.join(",") !== expected.join(",")) {
        throw new Error(`RR sequence mismatch: ${sequence}`);
      }
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
  console.log(`ok - ${test.name}`);
}

console.log(`\n${passed}/${tests.length} key-pool checks passed`);
