import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/pricing.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pricing = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("video-only pricing provides an MP4 plan without website or LINE benefits", () => {
  const plan = pricing.getMemoryPlan("video-only");
  assert.equal(plan.planId, "video-only");
  assert.equal(plan.price, 7800);
  assert.equal(plan.currency, "JPY");
  assert.equal(plan.taxIncluded, true);
  assert.equal(plan.includesWebsite, false);
  assert.equal(plan.includesLineStickers, false);
  assert.equal(plan.includesIllustrations, false);
});

test("legacy orders retain the original full plan and price", () => {
  const expected = pricing.getMemoryPlan("memory-film");
  assert.equal(expected.price, 12800);
  assert.equal(expected.includesWebsite, true);
  assert.equal(expected.includesLineStickers, true);
  assert.equal(expected.includesIllustrations, true);
  assert.deepEqual(pricing.getMemoryPlan(), expected);
  assert.deepEqual(pricing.getMemoryPlan(null), expected);
});

test("only exact catalog IDs qualify for plan input", () => {
  for (const value of ["memory-film", "video-only"]) {
    assert.equal(pricing.isMemoryPlanId(value), true);
  }
  for (const value of [undefined, null, "", "video-only-extra", "full", 7800, {}]) {
    assert.equal(pricing.isMemoryPlanId(value), false);
  }
});
