import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/components/HeroMobileScene.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
});

// Run the real component's effects with a deterministic clock and a minimal hook host.
// No browser, customer data, network calls or additional test dependencies are needed.
async function carousel({ entranceMs = 2150, reduced = false, mobile = true } = {}) {
  let now = 0, nextTimer = 0, cursor = 0, dirty = true, tree;
  const timers = new Map(), hooks = [], effects = [], listeners = new Map(), queries = new Map();
  const schedule = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const cancel = id => timers.delete(id);
  let finishEntrance;
  const entrance = entranceMs === null ? null : {
    animationName: "hero-service-enter",
    playState: entranceMs > 0 ? "running" : "finished",
    finished: entranceMs > 0 ? new Promise(resolve => { finishEntrance = resolve; }) : Promise.resolve(),
  };
  if (finishEntrance) schedule(() => { entrance.playState = "finished"; finishEntrance(); }, entranceMs);
  const showcase = { getAnimations: () => entrance ? [entrance] : [], contains: () => false };
  const document = {
    hidden: false,
    documentElement: { toggleAttribute() {}, removeAttribute() {} },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, value => {
        const next = typeof value === "function" ? value(hooks[index].value) : value;
        if (!Object.is(next, hooks[index].value)) { hooks[index].value = next; dirty = true; }
      }];
    },
    useRef(value) {
      const index = cursor++;
      hooks[index] ??= { current: value };
      return hooks[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) {
        hooks[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { hooks[index].cleanup?.(); hooks[index].cleanup = callback(); });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: id => ({ react, "next/image": "image", "next/link": "link", "../lib/analytics": { trackEvent() {} }, "./HeroDogDash": { HeroDogDash: "dogs" } })[id] ?? require(id),
    window: { matchMedia(query) {
      if (!queries.has(query)) queries.set(query, {
        matches: query.includes("reduced-motion") ? reduced : mobile,
        addEventListener(_name, callback) { this.listener = callback; },
        removeEventListener() {},
      });
      return queries.get(query);
    } },
    document,
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} },
    setTimeout: schedule, clearTimeout: cancel, requestAnimationFrame: callback => schedule(callback), cancelAnimationFrame: cancel,
  });
  const find = (predicate, node = tree) => {
    if (Array.isArray(node)) return node.flatMap(child => find(predicate, child));
    if (!node || typeof node !== "object") return [];
    return [...(predicate(node) ? [node] : []), ...find(predicate, node.props?.children ?? null)];
  };
  const flush = async () => {
    // Drain React updates and the readiness promise's microtasks.
    for (let round = 0; round < 8; round++) {
      if (dirty) {
        dirty = false; cursor = 0; tree = exports.HeroMobileScene();
        find(node => node.props?.className === "hero-service-showcase")[0].props.ref.current = showcase;
        while (effects.length) effects.shift()();
      }
      await Promise.resolve();
    }
  };
  const advance = async milliseconds => {
    const end = now + milliseconds;
    await flush();
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
    }
    now = end; await flush();
  };
  await advance(0);
  return {
    advance, flush, find,
    active: () => find(node => node.props?.className === "hero-service-slide is-active")[0].props["aria-label"],
    async visibility(hidden) { document.hidden = hidden; listeners.get("visibilitychange")(); await flush(); },
    async motion(matches) { const query = queries.get("(prefers-reduced-motion: reduce)"); query.matches = matches; query.listener(); await flush(); },
  };
}

test("first slide gets four seconds after its entrance, then advances every four seconds", async () => {
  const hero = await carousel();
  assert.match(hero.active(), /^1 \/ 3/);
  assert.equal(hero.find(node => node.type === "dogs")[0].props.onComplete, undefined, "dog completion must not gate the slides");
  await hero.advance(3349);
  assert.equal(hero.find(node => node.props?.className === "hero-art-image is-revealed").length, 0);
  await hero.advance(1);
  assert.equal(hero.find(node => node.props?.className === "hero-art-image is-revealed").length, 1);
  await hero.advance(2799);
  assert.match(hero.active(), /^1 \/ 3/);
  await hero.advance(1);
  assert.match(hero.active(), /^2 \/ 3/);
  await hero.advance(4000);
  assert.match(hero.active(), /^3 \/ 3/);
  await hero.advance(4000);
  assert.match(hero.active(), /^1 \/ 3/);
});

test("late hydration and missing CSS animation cannot leave the first slide stuck", async () => {
  for (const entranceMs of [0, null]) {
    const hero = await carousel({ entranceMs });
    await hero.advance(3999);
    assert.match(hero.active(), /^1 \/ 3/);
    await hero.advance(1);
    assert.match(hero.active(), /^2 \/ 3/);
  }
});

test("hidden pages and explicit full-film playback still pause automatic changes", async () => {
  const hero = await carousel({ entranceMs: 0 });
  await hero.visibility(true);
  await hero.advance(10000);
  assert.match(hero.active(), /^1 \/ 3/);
  await hero.visibility(false);
  await hero.advance(4000);
  assert.match(hero.active(), /^2 \/ 3/);
  hero.find(node => node.props?.className === "hero-film-play")[0].props.onClick();
  hero.find(node => node.type === "video")[0].props.onPlay();
  await hero.flush();
  await hero.advance(10000);
  assert.match(hero.active(), /^2 \/ 3/);
});

test("manual selection retains its reading pause and reduced-motion/desktop never auto-advance", async () => {
  const hero = await carousel({ entranceMs: 0 });
  hero.find(node => node.props?.["aria-label"] === "次のサービスを見る")[0].props.onClick();
  await hero.flush();
  await hero.advance(11999);
  assert.match(hero.active(), /^2 \/ 3/);
  await hero.advance(1);
  assert.match(hero.active(), /^3 \/ 3/);
  for (const options of [{ reduced: true }, { mobile: false }]) {
    const still = await carousel(options);
    await still.advance(20000);
    assert.match(still.active(), /^1 \/ 3/);
  }
});
