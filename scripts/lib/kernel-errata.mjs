/**
 * scripts/lib/kernel-errata.mjs: shared core of the kernel erratum writer and its gates.
 *
 * A kernel erratum is one append-only record: old kernel digest, new kernel digest, one
 * sentence, and a pure predicate over policy_parameters that is true when a receipt's
 * inputs fall in the region the fix changed. The witness is a pair of vectors (one
 * affected, one unaffected) with the policy_parameters hash and the old and new
 * execution hashes, so a reader can check the predicate against the two kernels.
 *
 * Hashing goes only through chaingraph/kernels/_hash.mjs (one canonicalizer) and
 * chaingraph/kernels/_buildid.mjs (one source digest). Node built-ins otherwise.
 * No network, no clock, no randomness.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitEnv } from '../_git-env-lib.mjs';
import { executionHash, policyParametersHash, jcsStringify } from '../../chaingraph/kernels/_hash.mjs';
import { sourceDigest, normalizeSource } from '../../chaingraph/kernels/_buildid.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SOURCES_DIR = 'chaingraph/errata/sources';
export const PREDICATES_DIR = 'chaingraph/errata/predicates';
export const CLASSES = ['fail-open-missing-input', 'fail-open-wrong-type', 'wrong-threshold', 'missed-clause-branch', 'arithmetic', 'nondeterminism', 'other'];
export const ID_RE = /^KE-\d{4}-\d{4}$/;

export function git(root, args, opts = {}) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv(), ...opts });
}

export const kernelPath = (toolId) => `chaingraph/kernels/${toolId}.kernel.mjs`;
export const fixturePath = (toolId) => `chaingraph/kernels/fixtures/${toolId}.fixtures.json`;

export function resolveCommit(root, ref) {
  return git(root, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
}

export const sha256Text = (text) => createHash('sha256').update(normalizeSource(text), 'utf8').digest('hex');

// ── kernel loading ──────────────────────────────────────────────────────────────────
// A kernel imports only ./_hash.mjs. The blob is written beside the CURRENT _hash.mjs so
// the old and the new version are hashed by the same canonicalizer.
const TMP = [];
let tmpRoot = null;
function scratch() {
  if (!tmpRoot) {
    tmpRoot = mkdtempSync(join(tmpdir(), 'kernel-errata-'));
    process.on('exit', () => { try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best effort */ } });
  }
  return tmpRoot;
}
const loaded = new Map();
export async function loadKernelAt(root, ref, toolId) {
  const key = `${root}|${ref}|${toolId}`;
  if (loaded.has(key)) return loaded.get(key);
  const text = git(root, ['show', `${ref}:${kernelPath(toolId)}`]);
  const dir = join(scratch(), String(TMP.length));
  TMP.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '_hash.mjs'), readFileSync(join(REPO_ROOT, 'chaingraph/kernels/_hash.mjs')));
  writeFileSync(join(dir, 'k.mjs'), text);
  const mod = await import(pathToFileURL(join(dir, 'k.mjs')).href);
  if (typeof mod.compute !== 'function') throw new Error(`${toolId}@${ref}: no compute() export`);
  const rec = { mod, text, digest: await sourceDigest(text) };
  loaded.set(key, rec);
  return rec;
}

// One run: the execution hash of the output, or a named error. Never throws.
export async function outcome(mod, pp) {
  try {
    const r = await mod.compute(structuredClone(pp));
    const out = r && Object.hasOwn(r, 'output_payload') ? r.output_payload : r;
    return { hash: await executionHash(pp, out), out };
  } catch (e) {
    return { hash: null, err: `${e?.name ?? 'Error'}: ${e?.message ?? e}` };
  }
}
// Two refusals by exception are the same outcome whatever their message says.
export const outcomeKey = (o) => o.hash ?? 'ERR';

// ── predicates ──────────────────────────────────────────────────────────────────────
export async function loadPredicate(root, relPath) {
  const abs = join(root, relPath);
  const mod = await import(pathToFileURL(abs).href + `?sha=${sha256Text(readFileSync(abs, 'utf8'))}`);
  if (typeof mod.affected !== 'function') throw new Error(`${relPath}: no exported affected()`);
  return mod.affected;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

// K3. Returns a list of violations (empty = pure).
export function lintPredicate(src) {
  const bad = [];
  const code = stripComments(src);
  const imports = [...code.matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  for (const spec of imports) if (!/(^|\/)_hash\.mjs$/.test(spec)) bad.push(`import of "${spec}" (only the shared canonicalizer _hash.mjs is allowed)`);
  if (/\bimport\s*\(/.test(code)) bad.push('dynamic import()');
  if (/\brequire\s*\(/.test(code)) bad.push('require()');
  for (const [re, name] of [
    [/\bDate\b/, 'Date'], [/\bMath\s*\.\s*random\b/, 'Math.random'], [/\bfetch\b/, 'fetch'], [/\bprocess\b/, 'process'],
    [/\bglobalThis\b/, 'globalThis'], [/\bwindow\b/, 'window'], [/\bperformance\b/, 'performance'], [/\bcrypto\b/, 'crypto'],
    [/\beval\b/, 'eval'], [/\bnew\s+Function\b|\bFunction\s*\(/, 'Function constructor'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\bWebSocket\b/, 'WebSocket'], [/\bsetTimeout\b|\bsetInterval\b/, 'timer'],
  ]) if (re.test(code)) bad.push(`forbidden identifier ${name}`);
  const exportsAffected = [...code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)];
  const fn = exportsAffected.find((m) => m[1] === 'affected');
  if (!fn) bad.push('no `export function affected(policy_parameters)`');
  if (exportsAffected.some((m) => m[1] !== 'affected') || /export\s+(?!function\b)(?!async\b)/.test(code)) bad.push('exports anything other than affected()');
  if (fn && /\basync\b/.test(fn[0])) bad.push('affected() is async');
  if (fn) {
    const param = fn[2].trim().split(/[\s=,]/)[0];
    const dyn = param && new RegExp(`\\b${param}\\s*\\[\\s*(?!['"\`])`).test(code);
    if (dyn && !/Object\s*\.\s*hasOwn\s*\(/.test(code)) bad.push(`dynamic property access on ${param} without Object.hasOwn`);
  }
  return bad;
}

// ── entry verification (K1) ─────────────────────────────────────────────────────────
export async function verifyEntry(root, entry) {
  const errs = [];
  const need = (cond, msg) => { if (!cond) errs.push(msg); };
  const tool = entry.tool_id;
  let oldK, newK;
  try {
    oldK = await loadKernelAt(root, entry.kernel_source.old_ref, tool);
    newK = await loadKernelAt(root, entry.kernel_source.new_ref, tool);
  } catch (e) { return [`cannot load kernel versions from git: ${e.message}`]; }
  need(entry.kernel_digest_affected?.[0] === oldK.digest, `old kernel digest ${oldK.digest} != recorded ${entry.kernel_digest_affected?.[0]}`);
  need(entry.kernel_digest_fixed === newK.digest, `new kernel digest ${newK.digest} != recorded ${entry.kernel_digest_fixed}`);
  need(oldK.digest !== newK.digest, 'old and new kernel digests are equal');
  const predAbs = join(root, entry.affected_predicate.path);
  if (!existsSync(predAbs)) return [...errs, `predicate file missing: ${entry.affected_predicate.path}`];
  need(sha256Text(readFileSync(predAbs, 'utf8')) === entry.affected_predicate.sha256, 'predicate sha256 does not match the file');
  const affected = await loadPredicate(root, entry.affected_predicate.path);
  for (const side of ['affected', 'unaffected']) {
    const w = entry.witness[side];
    const pp = w.policy_parameters;
    need(await policyParametersHash(pp) === w.policy_parameters_hash, `${side}: policy_parameters_hash does not recompute`);
    let p;
    try { p = affected(structuredClone(pp)); } catch (e) { p = `threw ${e.message}`; }
    need(p === (side === 'affected'), `${side}: predicate returned ${JSON.stringify(p)}, expected ${side === 'affected'}`);
    const [o, n] = [await outcome(oldK.mod, pp), await outcome(newK.mod, pp)];
    need(o.hash !== null && n.hash !== null, `${side}: a kernel version errored on the witness vector (${o.err ?? ''} ${n.err ?? ''})`);
    need(o.hash === w.old_execution_hash, `${side}: old execution hash does not recompute`);
    need(n.hash === w.new_execution_hash, `${side}: new execution hash does not recompute`);
    need((w.old_execution_hash !== w.new_execution_hash) === (side === 'affected'), `${side}: old/new execution hashes ${side === 'affected' ? 'must differ' : 'must be equal'}`);
  }
  return errs;
}

// ── probes (writer) ─────────────────────────────────────────────────────────────────
export function probeVariants(vectors) {
  const keys = [...new Set(vectors.flatMap((v) => Object.keys(v)))];
  const out = [];
  vectors.forEach((base, bi) => {
    out.push({ pp: base, mut: null, base: bi });
    for (const k of keys) {
      const d = structuredClone(base); delete d[k]; out.push({ pp: d, mut: { key: k, kind: 'delete' }, base: bi });
      const n = structuredClone(base); n[k] = null; out.push({ pp: n, mut: { key: k, kind: 'null' }, base: bi });
      const s = structuredClone(base); s[k] = 'x'; out.push({ pp: s, mut: { key: k, kind: 'string' }, base: bi });
    }
  });
  return out;
}

// Attribute divergence to a mutated key only where the unmutated fixture does not itself
// diverge (otherwise every mutation of that fixture would blame its own key). A fixture that
// diverges unmutated blames the keys it already lacks (absent or null) among the corpus keys.
// Each lacked key is tested by filling it from a donor fixture that does not diverge:
// the key is blamed only if filling it makes the outputs agree.
export async function attribute(rows, vectors, oldMod, newMod) {
  const keys = [...new Set(vectors.flatMap((v) => Object.keys(v)))];
  const baseDiverges = new Set(rows.filter((r) => !r.mut && r.diverges).map((r) => r.base));
  const out = rows.filter((r) => r.diverges && r.mut && !baseDiverges.has(r.base));
  const donors = vectors.filter((_, i) => !baseDiverges.has(i));
  for (const bi of baseDiverges) {
    const b = vectors[bi];
    for (const k of keys) {
      if (Object.hasOwn(b, k) && b[k] !== null) continue;
      const donor = donors.find((d) => Object.hasOwn(d, k) && d[k] !== null);
      if (!donor) continue;
      const filled = { ...structuredClone(b), [k]: structuredClone(donor[k]) };
      const [o, n] = [await outcome(oldMod, filled), await outcome(newMod, filled)];
      if (outcomeKey(o) === outcomeKey(n)) out.push({ mut: { key: k, kind: 'delete' } });
    }
  }
  return out;
}

export function typeName(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }

// Propose predicate source for the two mechanical classes from the divergent probes.
export function proposePredicate(cls, divergent, vectors, id) {
  if (cls === 'fail-open-missing-input') {
    const keys = [...new Set(divergent.filter((d) => d.mut && (d.mut.kind === 'delete' || d.mut.kind === 'null')).map((d) => d.mut.key))].sort();
    if (!keys.length) return null;
    return `// ${id}: proposed by gen-kernel-erratum.mjs (class fail-open-missing-input).
// True when any listed input is absent or null: the fixed kernel refuses such a receipt.
const FIELDS = ${JSON.stringify(keys)};

export function affected(policy_parameters) {
  const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
  return FIELDS.some((k) => !Object.hasOwn(pp, k) || pp[k] === null || pp[k] === undefined);
}
`;
  }
  if (cls === 'fail-open-wrong-type') {
    const keys = [...new Set(divergent.filter((d) => d.mut && d.mut.kind === 'string').map((d) => d.mut.key))].sort();
    if (!keys.length) return null;
    const types = {};
    for (const k of keys) types[k] = [...new Set(vectors.filter((v) => Object.hasOwn(v, k) && v[k] !== null).map((v) => typeName(v[k])))].sort();
    return `// ${id}: proposed by gen-kernel-erratum.mjs (class fail-open-wrong-type).
// True when a listed input is present but not of a type the fixtures use for it.
const EXPECTED = ${JSON.stringify(types)};

const typeName = (v) => (Array.isArray(v) ? 'array' : typeof v);

export function affected(policy_parameters) {
  const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
  return Object.keys(EXPECTED).some((k) => Object.hasOwn(pp, k) && pp[k] !== null && pp[k] !== undefined && !EXPECTED[k].includes(typeName(pp[k])));
}
`;
  }
  return null;
}

export { jcsStringify };
