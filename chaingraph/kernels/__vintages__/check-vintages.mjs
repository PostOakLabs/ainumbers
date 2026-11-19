#!/usr/bin/env node
// @ts-nocheck — plain CLI gate script, never meant to be type-checked; only swept into
// tsc --checkJs's program because it lives under chaingraph/kernels/ (no @types/node there).
/**
 * check-vintages.mjs: gates V1, V2, V3, V4 and V6 of the vintage table.
 *
 *   V1  a `computes` declaration's literal equals the table value for its fact and vintage.
 *   V2  two kernels declaring the same fact and vintage hold equal values (names both).
 *   V3  a kernel with a year literal on a numeric assignment line and no declaration.
 *       Advisory through v3-baseline.json (a list that only shrinks); hard red for a
 *       kernel the baseline does not list, and for a baseline entry that no longer
 *       qualifies. (VINTAGE-COVERAGE-1-RESUME-1)
 *   V4  every vintage's source digest resolves in clause-snapshot-registry.json.
 *   V6  a `mentions` declaration whose anchored value differs from the table is listed
 *       on stdout. Advisory: never affects the exit code. (VINTAGE-COVERAGE-1-RESUME-1)
 *
 * Kernels are read only: the text is read, or the module is imported for an exported anchor.
 * No kernel byte changes, no network. `--self-test` runs planted red and green controls.
 *
 * Anchor shapes (see data/vintages.schema.json and the README of the declarations):
 *   { "regex": "<one capture group>" }          text anchor, multiline; `computes` must match once
 *   { "export": "NAME", "pointer": "/a/0" }     exported constant, optional JSON pointer into it
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const KERNELS = resolve(HERE, '..');
const REPO = resolve(HERE, '../../..');

const num = (s) => Number(String(s).replace(/[,_]/g, ''));

function pointer(obj, ptr) {
  if (!ptr) return obj;
  return ptr.split('/').slice(1).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Resolve one declaration's literal. Returns { ok, value?, why? }. */
export async function resolveAnchor(decl, io) {
  const a = decl.anchor || {};
  if (a.export) {
    const mod = await io.loadExports(decl.kernel);
    if (!mod || !(a.export in mod)) return { ok: false, why: `export ${a.export} not found in ${decl.kernel}` };
    const v = pointer(mod[a.export], a.pointer);
    if (v === undefined) return { ok: false, why: `pointer ${a.pointer} not found under ${a.export}` };
    return { ok: true, value: v };
  }
  if (a.regex) {
    const text = io.readKernel(decl.kernel);
    const re = new RegExp(a.regex, 'gm');
    const hits = [...text.matchAll(re)];
    if (hits.length === 0) return { ok: false, why: `regex ${a.regex} matched nothing in ${decl.kernel}` };
    if (decl.role === 'computes' && hits.length !== 1) {
      return { ok: false, why: `regex ${a.regex} matched ${hits.length} times in ${decl.kernel}; a computes anchor must match once` };
    }
    return { ok: true, value: num(hits[0][1]) };
  }
  return { ok: false, why: 'anchor has neither export nor regex' };
}

/** Run V1, V2, V4. Returns an array of { gate, msg } reds. */
export async function check({ table, uses, registry, io }) {
  const reds = [];
  const byKey = new Map(table.vintages.map((v) => [`${v.fact}@${v.vintage}`, v]));

  // V4: sources resolve.
  const reg = new Map(registry.map((e) => [e.digest, e]));
  for (const v of table.vintages) {
    const e = reg.get(v.source.clause_digest);
    if (!e) reds.push({ gate: 'V4', msg: `${v.fact}@${v.vintage}: clause_digest ${v.source.clause_digest} is not in clause-snapshot-registry.json` });
    else if (e.scheme !== v.source.scheme || e.id !== v.source.id) {
      reds.push({ gate: 'V4', msg: `${v.fact}@${v.vintage}: source scheme/id differ from the registry entry (${e.scheme} / ${e.id})` });
    }
  }

  // V1: declared literal equals the table; collect values for V2.
  const seen = new Map();
  for (const d of uses) {
    const key = `${d.fact}@${d.vintage}`;
    const entry = byKey.get(key);
    if (!entry) { reds.push({ gate: 'V1', msg: `${d.kernel}: no table entry for ${key}` }); continue; }
    const r = await resolveAnchor(d, io);
    if (!r.ok) { reds.push({ gate: 'V1', msg: `${d.kernel} ${key}: ${r.why}` }); continue; }
    if (d.role !== 'computes') continue;
    if (JSON.stringify(r.value) !== JSON.stringify(entry.value)) {
      reds.push({ gate: 'V1', msg: `${d.kernel} ${key}: kernel holds ${JSON.stringify(r.value)}, table says ${JSON.stringify(entry.value)}` });
    }
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push({ kernel: d.kernel, value: r.value });
  }

  // V2: shared facts agree, naming both kernels.
  for (const [key, list] of seen) {
    for (let i = 1; i < list.length; i++) {
      if (JSON.stringify(list[i].value) !== JSON.stringify(list[0].value)) {
        reds.push({ gate: 'V2', msg: `${key}: ${list[0].kernel} holds ${JSON.stringify(list[0].value)} but ${list[i].kernel} holds ${JSON.stringify(list[i].value)}` });
      }
    }
  }
  return reds;
}

function realIo() {
  const file = (k) => resolve(KERNELS, `${k}.kernel.mjs`);
  return {
    readKernel: (k) => readFileSync(file(k), 'utf8'),
    loadExports: (k) => import(pathToFileURL(file(k)).href),
  };
}

// ── V3: undeclared year literal (advisory baseline, shrink-only) ──────────
const YEAR_TOKEN = /\b20(2[4-9]|3[0-5])\b/;
const NUM_ASSIGN = /[:=]\s*-?\d/;
const YEAR_KEY_ASSIGN = /\b20(2[4-9]|3[0-5])\s*:/;

/**
 * Kernels whose text has a year literal (2024-2035) on a numeric assignment line
 * outside comments. `files` is [fileName, text] pairs; `declared` is the set of
 * kernel ids that carry a declaration in __vintages__.
 */
export function findYearLiteralKernels(files, declared) {
  const out = [];
  for (const [name, text] of files) {
    const kernel = name.replace(/\.kernel\.mjs$/, '');
    if (declared.has(kernel)) continue;
    const hit = text.split('\n').some((line) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
      if (!YEAR_TOKEN.test(line)) return false;
      return NUM_ASSIGN.test(line) || YEAR_KEY_ASSIGN.test(line);
    });
    if (hit) out.push(kernel);
  }
  return out.sort();
}

/** V3 reds: a qualifier missing from the baseline, or a stale baseline entry. */
export function v3Check(undeclared, baseline) {
  const reds = [];
  for (const k of undeclared) {
    if (!baseline.has(k)) reds.push({ gate: 'V3', msg: `${k} carries a year literal on a numeric assignment line and has no vintage declaration (not in v3-baseline.json); a coverage row must declare it` });
  }
  for (const k of baseline) {
    if (!undeclared.includes(k)) reds.push({ gate: 'V3', msg: `v3-baseline.json entry ${k} no longer qualifies (declared, or no year literal on an assignment line); remove it: the baseline only shrinks` });
  }
  return reds;
}

function loadV3Baseline() {
  try {
    const j = JSON.parse(readFileSync(resolve(HERE, 'v3-baseline.json'), 'utf8'));
    return new Set(j.kernels || []);
  } catch {
    return new Set();
  }
}

// ── V6: prose follows the table (advisory listing) ────────────────────────
/** `mentions` declarations whose anchored value differs from the table. */
export async function v6List(uses, byKey, io) {
  const listed = [];
  for (const d of uses) {
    if (d.role !== 'mentions') continue;
    const entry = byKey.get(`${d.fact}@${d.vintage}`);
    if (!entry) continue; // V1 already reports the missing table entry
    const r = await resolveAnchor(d, io);
    if (!r.ok) continue; // V1 already reports the unresolvable anchor
    if (JSON.stringify(r.value) !== JSON.stringify(entry.value)) {
      listed.push({ gate: 'V6', msg: `${d.kernel} ${d.fact}@${d.vintage}: prose names ${JSON.stringify(r.value)} but the table says ${JSON.stringify(entry.value)}` });
    }
  }
  return listed;
}

function loadUses() {
  const uses = [];
  for (const f of readdirSync(HERE).filter((n) => n.endsWith('.uses.json')).sort()) {
    const j = JSON.parse(readFileSync(resolve(HERE, f), 'utf8'));
    for (const u of j.uses) uses.push({ kernel: j.kernel, ...u });
  }
  return uses;
}

async function selfTest() {
  const registry = [{ digest: 'sha256:' + 'a'.repeat(64), scheme: 's', id: 'Source A' }];
  const mkTable = (digest = registry[0].digest, value = 100) => ({
    vintages: [{ fact: 'x.limit', vintage: '2026', value, source: { clause_digest: digest, scheme: 's', id: 'Source A' } }],
  });
  const texts = { k1: 'const LIMIT = 100;\n', k2: 'const LIMIT = 100;\n', k3: 'const LIMIT = 999;\n' };
  const io = { readKernel: (k) => texts[k], loadExports: async () => ({ LIMIT: { a: [100] } }) };
  const use = (kernel, anchor = { regex: 'const LIMIT = (\\d+);' }) => ({ kernel, fact: 'x.limit', vintage: '2026', anchor, role: 'computes' });
  const gates = (reds) => [...new Set(reds.map((r) => r.gate))].sort().join(',');
  let bad = 0;
  const expect = (label, got, want) => {
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: got [${got}] want [${want}]`);
  };

  expect('GREEN all gates', gates(await check({ table: mkTable(), uses: [use('k1'), use('k2'), use('k1', { export: 'LIMIT', pointer: '/a/0' })], registry, io })), '');
  expect('RED V1 literal differs from table', gates(await check({ table: mkTable(), uses: [use('k3')], registry, io })), 'V1');
  const v2 = await check({ table: mkTable(), uses: [use('k1'), use('k3')], registry, io });
  expect('RED V2 two kernels disagree', gates(v2), 'V1,V2');
  expect('V2 message names both kernels', String(/k1/.test(v2.find((r) => r.gate === 'V2').msg) && /k3/.test(v2.find((r) => r.gate === 'V2').msg)), 'true');
  expect('RED V4 digest not in registry', gates(await check({ table: mkTable('sha256:' + 'b'.repeat(64)), uses: [], registry, io })), 'V4');
  expect('RED V1 anchor matches nothing', gates(await check({ table: mkTable(), uses: [use('k1', { regex: 'NOPE (\\d+)' })], registry, io })), 'V1');
  expect('GREEN mentions role is not value-compared', gates(await check({ table: mkTable(), uses: [{ ...use('k3'), role: 'mentions' }], registry, io })), '');

  // V3 controls (VINTAGE-COVERAGE-1-RESUME-1)
  expect('V3 detector fires on a dated constant', findYearLiteralKernels([['k5.kernel.mjs', 'const YEAR = 2026;\nconst LIMIT = 5;\n']], new Set()).join(','), 'k5');
  expect('V3 detector fires on a year-keyed table', findYearLiteralKernels([['k7.kernel.mjs', 'const T = {\n  2026: {\n    v: 1,\n  },\n};\n']], new Set()).join(','), 'k7');
  expect('GREEN V3 comment-only year does not fire', findYearLiteralKernels([['k6.kernel.mjs', '// 2026 planning note\nconst X = 1;\n']], new Set()).join(','), '');
  expect('GREEN V3 declared kernel is skipped', findYearLiteralKernels([['k5.kernel.mjs', 'const YEAR = 2026;\n']], new Set(['k5'])).join(','), '');
  expect('RED V3 new undeclared kernel', gates(v3Check(['k5'], new Set())), 'V3');
  expect('GREEN V3 kernel baselined', gates(v3Check(['k5'], new Set(['k5']))), '');
  expect('RED V3 stale baseline entry shrinks', gates(v3Check([], new Set(['k5']))), 'V3');

  // V6 controls (VINTAGE-COVERAGE-1-RESUME-1)
  const v6io = { readKernel: (k) => (k === 'k4' ? 'const LIMIT = 100;\n' : texts[k]), loadExports: async () => ({}) };
  const v6key = new Map(mkTable().vintages.map((v) => [`${v.fact}@${v.vintage}`, v]));
  const mentions = (kernel) => ({ kernel, fact: 'x.limit', vintage: '2026', anchor: { regex: 'const LIMIT = (\\d+);' }, role: 'mentions' });
  const v6red = await v6List([mentions('k3')], v6key, v6io);
  expect('RED V6 prose value differs from table is listed', String(v6red.length === 1 && /k3/.test(v6red[0].msg)), 'true');
  const v6green = await v6List([mentions('k4')], v6key, v6io);
  expect('GREEN V6 prose value agrees is not listed', String(v6green.length), '0');
  if (bad) { console.error(`check-vintages self-test: ${bad} control(s) failed`); process.exit(1); }
  console.log('check-vintages self-test: all red and green controls behave');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const table = JSON.parse(readFileSync(resolve(REPO, 'data/vintages.json'), 'utf8'));
  const registry = JSON.parse(readFileSync(resolve(REPO, 'chaingraph/standard/clause-snapshot-registry.json'), 'utf8'));
  const uses = loadUses();
  const reds = await check({ table, uses, registry, io: realIo() });

  // V3: kernels with an undeclared year literal on a numeric assignment line.
  const declared = new Set(uses.map((u) => u.kernel));
  const files = readdirSync(KERNELS).filter((n) => n.endsWith('.kernel.mjs')).sort()
    .map((n) => [n, readFileSync(resolve(KERNELS, n), 'utf8')]);
  const undeclared = findYearLiteralKernels(files, declared);
  const baseline = loadV3Baseline();
  reds.push(...v3Check(undeclared, baseline));

  for (const r of reds) console.error(`${r.gate} RED: ${r.msg}`);
  if (reds.length) process.exit(1);

  // V6: prose follows the table. Advisory: listed on stdout, never exit-relevant.
  const byKey = new Map(table.vintages.map((v) => [`${v.fact}@${v.vintage}`, v]));
  const v6 = await v6List(uses, byKey, realIo());
  for (const l of v6) console.log(`V6 advisory: ${l.msg}`);

  const v6note = v6.length ? `; V6 listed ${v6.length}` : '';
  console.log(`check-vintages: ${table.vintages.length} vintages, ${uses.length} declarations; V1 V2 V3 V4 V6 green${v6note}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
