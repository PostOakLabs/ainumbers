#!/usr/bin/env node
/**
 * check-vintages.mjs: gates V1, V2 and V4 of the vintage table.
 *
 *   V1  a `computes` declaration's literal equals the table value for its fact and vintage.
 *   V2  two kernels declaring the same fact and vintage hold equal values (names both).
 *   V4  every vintage's source digest resolves in clause-snapshot-registry.json.
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
  if (bad) { console.error(`check-vintages self-test: ${bad} control(s) failed`); process.exit(1); }
  console.log('check-vintages self-test: all red and green controls behave');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const table = JSON.parse(readFileSync(resolve(REPO, 'data/vintages.json'), 'utf8'));
  const registry = JSON.parse(readFileSync(resolve(REPO, 'chaingraph/standard/clause-snapshot-registry.json'), 'utf8'));
  const uses = loadUses();
  const reds = await check({ table, uses, registry, io: realIo() });
  for (const r of reds) console.error(`${r.gate} RED: ${r.msg}`);
  if (reds.length) process.exit(1);
  console.log(`check-vintages: ${table.vintages.length} vintages, ${uses.length} declarations; V1 V2 V4 green`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
