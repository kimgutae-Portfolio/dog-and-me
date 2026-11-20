import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function publicMemoryModule(payload, error = null) {
  const source = readFileSync(new URL("../app/lib/supabase/public-memory.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: payload, error };
    },
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key" } },
    require: (id) => {
      if (id === "@supabase/supabase-js") return { createClient: () => client };
      if (id === "../memory-address") return { isMemoryAddress: (value) => value === "moka" };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return { ...exports, calls };
}

const shareCode = "a".repeat(64);
const lookups = [
  ["share code", (memory) => memory.getPublicSharedMemory(shareCode)],
  ["custom address", (memory) => memory.getPublicSharedMemory("moka")],
  ["legacy personal slug", (memory) => memory.getPublicSharedMemoryBySlug("family", "moka")],
];

test("public website lookups reject video-only orders even if an RPC returns a payload", async () => {
  for (const [label, lookup] of lookups) {
    const memory = publicMemoryModule({ order: { id: "test-order", plan_id: "video-only" } });
    assert.equal(await lookup(memory), null, label);
    assert.equal(memory.calls.length, 1);
  }
});

test("full plans and historical payloads retain public website access", async () => {
  for (const plan of [{ plan_id: "memory-film" }, {}]) {
    for (const [label, lookup] of lookups) {
      const payload = { order: { id: "test-order", ...plan } };
      const memory = publicMemoryModule(payload);
      assert.equal(await lookup(memory), payload, label);
    }
  }
});

test("RPC denials remain private for all public website lookup routes", async () => {
  for (const [label, lookup] of lookups) {
    const memory = publicMemoryModule(null, { message: "not available" });
    assert.equal(await lookup(memory), null, label);
  }
});
