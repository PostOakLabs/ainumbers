// census-headroom.mjs: mechanical candidate census for headroom declarations.
//
//   node chaingraph/kernels/__headroom__/census-headroom.mjs
//       Print the first N candidates (default 25) that still have no declaration.
//   node chaingraph/kernels/__headroom__/census-headroom.mjs --count 25 --json
//       Same, as JSON.
//   node chaingraph/kernels/__headroom__/census-headroom.mjs --write
//       Write one <tool_id>.headroom.json per selected candidate (existing files are never touched).
//   node chaingraph/kernels/__headroom__/census-headroom.mjs --check
//       Exit 1 if a selected candidate has no declaration (the selftest form).
//
// A candidate is a node whose fixtures hold at least one positive and one negative verdict (the
// shared reader in scripts/lib/verdict-read.mjs) and whose base fixture has at least one numeric
// input that is not a year, date or identifier and that the missing-input sweep does not list.
// Candidates are taken in ascending tool_id order. Declarations are derived from the base
// fixture, then every probe is run once by the headroom runner (H1 to H3 gates), which is where
// a wrong monotone claim is downgraded to bracketed and listed.

/** @type {(name: string) => Promise<any>} */
const nodeBuiltin = (name) => import('node:' + name);
const { readdirSync, readFileSync, writeFileSync, existsSync } = await nodeBuiltin('fs');
const { resolve, dirname } = await nodeBuiltin('path');
const { fileURLToPath, pathToFileURL } = await nodeBuiltin('url');
import { readVerdict } from '../../../scripts/lib/verdict-read.mjs';
import { runClass, getPointer, setPointer, gridValue, stepsBetween } from '../_headroom.mjs';

/** @type {any} */
const proc = globalThis.process;
const HERE = dirname(fileURLToPath(import.meta.url));
const KERNELS = resolve(HERE, '..');
const ROOT = resolve(KERNELS, '..', '..');
const FIXTURES = resolve(KERNELS, 'fixtures');

const argv = proc.argv.slice(2);
const flagVal = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : dflt; };
const COUNT = flagVal('--count', 25);

// Pointers never probed: dates, years, identifiers and counters that are not distances.
const NAME_SKIP = /(^|_)(year|years|date|dates|day|days|month|months|time|timestamp|epoch|version|nonce|id|index|seed|block|height|chain|count|unix|payload|input|digest|hash)($|_)|_at$|_ts$|_id$|^(isa|iea|gs|ge|st|se)\d+$|^field_|^account_(type|status)$|^0x/i;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const classOf = (payload) => { const r = readVerdict(payload); return r ? r.cls : 'unclassified'; };

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

/**
 * Numeric leaves of an object down to depth 3, object members only (no arrays). A decimal string
 * counts as numeric and keeps its string type when probed.
 */
export function numericPointers(obj, prefix = '', depth = 1) {
  const out = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const pointer = `${prefix}/${k}`;
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ pointer, value: v, name: k });
    else if (typeof v === 'string' && DECIMAL_TEXT.test(v)) out.push({ pointer, value: v, name: k });
    else if (v && typeof v === 'object' && !Array.isArray(v) && depth < 3) out.push(...numericPointers(v, pointer, depth + 1));
  }
  return out;
}

const declaredIds = () => new Set(readdirSync(HERE).filter((f) => f.endsWith('.headroom.json')).map((f) => f.replace(/\.headroom\.json$/, '')));

/** Stage 1: cheap census from stored fixture payloads. */
export function census() {
  const failOpen = readJson(resolve(ROOT, 'scripts', 'kernel-missing-input-failclosed.baseline.json'));
  const out = [];
  for (const f of readdirSync(FIXTURES).filter((x) => x.endsWith('.fixtures.json')).sort()) {
    const id = f.replace(/\.fixtures\.json$/, '');
    if (!existsSync(resolve(KERNELS, `${id}.kernel.mjs`))) continue;
    let fx;
    try { fx = readJson(resolve(FIXTURES, f)); } catch { continue; }
    const vectors = Array.isArray(fx.vectors) ? fx.vectors : [];
    const classes = vectors.map((v) => classOf(v.output_payload));
    if (!classes.includes('positive') || !classes.includes('negative')) continue;
    const unsound = new Set((failOpen.nodes && failOpen.nodes[id] && failOpen.nodes[id].fields) || []);
    const cands = [];
    vectors.forEach((v, i) => {
      if (classes[i] !== 'positive' && classes[i] !== 'negative') return;
      const probes = numericPointers(v.policy_parameters).filter((p) => !NAME_SKIP.test(p.name) && !unsound.has(p.pointer.split('/')[1]));
      if (probes.length) cands.push({ name: v.name, cls: classes[i], probes });
    });
    if (!cands.length) continue;
    out.push({ tool_id: id, fixture: `fixtures/${f}`, kernel: `${id}.kernel.mjs`, bases: cands });
  }
  return out;
}

/** Number of verdict-class changes over `n` evenly spaced grid points of [min, max]. */
async function coarseChanges(compute, pp, probe, n) {
  const total = Number(stepsBetween(probe.min, probe.max, probe.step));
  const baseValue = getPointer(pp, probe.pointer);
  let prev = null; let changes = 0; let first = null;
  for (let i = 0; i < n; i++) {
    const k = Math.round((i * total) / (n - 1));
    const q = clone(pp);
    setPointer(q, probe.pointer, typeof baseValue === 'string' ? gridValue(probe.min, probe.step, k) : Number(gridValue(probe.min, probe.step, k)));
    const { cls } = await runClass(compute, q, classOf);
    if (first === null) first = cls;
    if (prev !== null && cls !== prev) changes++;
    prev = cls;
  }
  return { changes, first };
}

/** Stage 2: build the declaration for one candidate by running its real kernel. Null when no probe is usable. */
export async function buildDeclaration(c) {
  const compute = (await import(pathToFileURL(resolve(KERNELS, c.kernel)).href)).compute;
  if (typeof compute !== 'function') return null;
  const fx = readJson(resolve(KERNELS, c.fixture));
  for (const b of c.bases) {
    const vec = fx.vectors.find((v) => v.name === b.name);
    const base = await runClass(compute, vec.policy_parameters, classOf);
    if (base.cls !== 'positive' && base.cls !== 'negative') continue;
    const probes = [];
    for (const p of b.probes) {
      const n = Number(p.value);
      const decimal = typeof p.value === 'string' ? p.value.includes('.') : !Number.isInteger(n);
      const step = decimal ? '0.01' : '1';
      const max = String(Math.max(1000000, Math.ceil(Math.abs(n) * 1000)));
      const probe = { pointer: p.pointer, grid: decimal ? 'decimal' : 'integer', step, min: n < 0 ? `-${max}` : '0', max };
      let cc;
      try { cc = await coarseChanges(compute, vec.policy_parameters, probe, 25); } catch { continue; }
      if (cc.changes <= 1) {
        const lowPositive = cc.first === 'positive';
        probe.monotone = lowPositive ? 'non-increasing-pass' : 'non-decreasing-pass';
        if (cc.changes === 0) delete probe.monotone;
      }
      probes.push(probe);
    }
    if (!probes.length) continue;
    return { tool_id: c.tool_id, kernel: c.kernel, fixture: c.fixture, base_fixtures: [b.name], probes };
  }
  return null;
}

/** First `count` candidates in tool_id order that have no declaration and yield a usable one. */
export async function select(count = COUNT) {
  const have = declaredIds();
  const chosen = [];
  for (const c of census()) {
    if (have.has(c.tool_id)) continue;
    const decl = await buildDeclaration(c);
    if (!decl) continue;
    chosen.push(decl);
    if (chosen.length >= count) break;
  }
  return chosen;
}

async function main() {
  const chosen = await select(COUNT);
  if (argv.includes('--write')) {
    for (const d of chosen) {
      const file = resolve(HERE, `${d.tool_id}.headroom.json`);
      if (existsSync(file)) continue;
      writeFileSync(file, `${JSON.stringify(d, null, 2)}\n`);
    }
    console.log(`wrote ${chosen.length} declaration(s)`);
    return 0;
  }
  if (argv.includes('--json')) { console.log(JSON.stringify(chosen, null, 2)); return 0; }
  if (argv.includes('--check')) {
    // After the batch is written the selection moves on, so check what is declared: every
    // declaration file must name an existing kernel and fixture and a base fixture that exists.
    let bad = 0;
    for (const f of readdirSync(HERE).filter((x) => x.endsWith('.headroom.json'))) {
      const d = readJson(resolve(HERE, f));
      const fx = existsSync(resolve(KERNELS, d.fixture)) ? readJson(resolve(KERNELS, d.fixture)) : null;
      const ok = existsSync(resolve(KERNELS, d.kernel)) && fx && d.base_fixtures.every((n) => fx.vectors.some((v) => v.name === n));
      if (!ok) { bad++; console.log(`RED ${f}: kernel, fixture or base fixture missing`); }
    }
    console.log(bad ? `census check: ${bad} bad declaration(s)` : 'census check: every declaration resolves');
    return bad ? 1 : 0;
  }
  for (const d of chosen) console.log(`${d.tool_id}  base ${d.base_fixtures[0]}  probes ${d.probes.map((p) => p.pointer + (p.monotone ? '*' : '')).join(' ')}`);
  console.log(`${chosen.length} candidate(s) (* = monotone claimed)`);
  return 0;
}

if (proc.argv[1] && pathToFileURL(resolve(proc.argv[1])).href === import.meta.url) {
  main().then((code) => proc.exit(code), (e) => { console.error(e && e.stack || e); proc.exit(2); });
}
