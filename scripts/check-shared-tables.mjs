#!/usr/bin/env node
/**
 * scripts/check-shared-tables.mjs — DUP-TABLE-HASH-GATE-1
 *
 * ── WHY THIS GATE EXISTS ─────────────────────────────────────────────────────
 * `0xAlpha/audits/2026-08-21-time-decaying-constants-audit.md` (§Meta gate-
 * candidate 3 + F3) found the same regulatory schedule vendored into more than
 * one kernel and diverging: a phantom 2025 QM/HOEPA row shipped identically
 * fabricated into art-218/art-220/art-234, and art-234's own header says
 * "consume art-220, do not duplicate" and then duplicates anyway. A per-kernel
 * SIDEBYSIDE check against a pinned source text cannot see this class: each
 * copy can individually pass against a different snapshot of the same rule,
 * because the check never puts the two copies side by side with EACH OTHER.
 *
 * This gate is that missing cross-copy check. It does not verify a table
 * against the Federal Register (that is REGZ-PHANTOM-ROW-FIX-1 / SIDEBYSIDE
 * territory) — it verifies that every kernel vendoring the SAME declared
 * schedule reports the SAME cell values, so a future fix to one copy cannot
 * silently leave a sibling copy behind.
 *
 * ── WHAT IT CHECKS ───────────────────────────────────────────────────────────
 * `scripts/shared-tables.json` declares closed sets of "this schedule lives in
 * these kernels' named consts, compare these cells across these years." For
 * each declared set (not marked EXEMPT-BY-DESIGN), this gate:
 *   1. Statically extracts each kernel's named `const TABLE = {...}` object
 *      literal from source text — no `import()`, no `eval`, no `Function()`
 *      (SO #34's security rider: never execute the kernel to validate a claim
 *      about itself; also these consts are module-private, not exported, so
 *      there is nothing to import). A hand-rolled JS-object-literal parser
 *      (`parseValue`) reads the closed grammar these tables actually use:
 *      objects, arrays, strings, numbers, booleans, null.
 *   2. Resolves each declared cell's dotted/bracket path (with `$YEAR`
 *      substituted per declared year) against each kernel's extracted table.
 *   3. Canonicalizes each resolved value (`JSON.stringify`) and compares
 *      across every kernel in the set. Any pairwise mismatch is a RED finding
 *      naming the schedule id, the cell, the year, and each kernel's value.
 *   4. A path that resolves to `undefined` is its own RED finding
 *      (UNRESOLVED_PATH) — a registry cell that cannot be read is a registry
 *      defect, never treated as a silent pass (SO #34c: absence is not a
 *      pass).
 *
 * Scope is intentionally narrow: DECLARED sets only. Auto-discovery of
 * undeclared vendored duplicates is a future extension, not this row.
 *
 * Usage:
 *   node scripts/check-shared-tables.mjs           # human output
 *   node scripts/check-shared-tables.mjs --check   # exit 0/1, wired into preflight
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');
const REGISTRY_PATH = resolve(REPO, 'scripts', 'shared-tables.json');

// ── tiny JS-object-literal parser (no eval, no Function, no import) ─────────

// Skips whitespace AND line/block comments between tokens. Safe to call only
// where a value/key/comma is expected (never mid-string) — parseString never
// calls this, so a "//" inside a citation string is never touched.
function skipWs(src, posRef) {
  for (;;) {
    const before = posRef.pos;
    while (posRef.pos < src.length && /\s/.test(src[posRef.pos])) posRef.pos++;
    if (src.startsWith('//', posRef.pos)) {
      const nl = src.indexOf('\n', posRef.pos);
      posRef.pos = nl === -1 ? src.length : nl + 1;
    } else if (src.startsWith('/*', posRef.pos)) {
      const close = src.indexOf('*/', posRef.pos + 2);
      posRef.pos = close === -1 ? src.length : close + 2;
    }
    if (posRef.pos === before) break;
  }
}

function parseString(src, posRef) {
  const quote = src[posRef.pos];
  posRef.pos++;
  let out = '';
  while (posRef.pos < src.length && src[posRef.pos] !== quote) {
    if (src[posRef.pos] === '\\') {
      out += src[posRef.pos + 1];
      posRef.pos += 2;
      continue;
    }
    out += src[posRef.pos];
    posRef.pos++;
  }
  posRef.pos++; // closing quote
  return out;
}

function parseNumber(src, posRef) {
  const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(posRef.pos));
  if (!m) throw new Error(`expected number at position ${posRef.pos}: ...${src.slice(posRef.pos, posRef.pos + 30)}`);
  posRef.pos += m[0].length;
  return Number(m[0]);
}

function parseObjectKey(src, posRef) {
  skipWs(src, posRef);
  if (src[posRef.pos] === '"' || src[posRef.pos] === "'") return parseString(src, posRef);
  const m = /^[A-Za-z0-9_$]+/.exec(src.slice(posRef.pos));
  if (!m) throw new Error(`expected object key at position ${posRef.pos}: ...${src.slice(posRef.pos, posRef.pos + 30)}`);
  posRef.pos += m[0].length;
  return m[0];
}

function parseObject(src, posRef) {
  posRef.pos++; // skip '{'
  const obj = {};
  skipWs(src, posRef);
  if (src[posRef.pos] === '}') { posRef.pos++; return obj; }
  for (;;) {
    const key = parseObjectKey(src, posRef);
    skipWs(src, posRef);
    if (src[posRef.pos] !== ':') throw new Error(`expected ':' after key "${key}" at position ${posRef.pos}`);
    posRef.pos++;
    obj[key] = parseValue(src, posRef);
    skipWs(src, posRef);
    if (src[posRef.pos] === ',') {
      posRef.pos++;
      skipWs(src, posRef);
      if (src[posRef.pos] === '}') { posRef.pos++; break; } // trailing comma
      continue;
    }
    if (src[posRef.pos] === '}') { posRef.pos++; break; }
    throw new Error(`expected ',' or '}' at position ${posRef.pos}`);
  }
  return obj;
}

function parseArray(src, posRef) {
  posRef.pos++; // skip '['
  const arr = [];
  skipWs(src, posRef);
  if (src[posRef.pos] === ']') { posRef.pos++; return arr; }
  for (;;) {
    arr.push(parseValue(src, posRef));
    skipWs(src, posRef);
    if (src[posRef.pos] === ',') {
      posRef.pos++;
      skipWs(src, posRef);
      if (src[posRef.pos] === ']') { posRef.pos++; break; } // trailing comma
      continue;
    }
    if (src[posRef.pos] === ']') { posRef.pos++; break; }
    throw new Error(`expected ',' or ']' at position ${posRef.pos}`);
  }
  return arr;
}

function parseValue(src, posRef) {
  skipWs(src, posRef);
  const c = src[posRef.pos];
  if (c === '{') return parseObject(src, posRef);
  if (c === '[') return parseArray(src, posRef);
  if (c === '"' || c === "'") return parseString(src, posRef);
  if (src.startsWith('true', posRef.pos)) { posRef.pos += 4; return true; }
  if (src.startsWith('false', posRef.pos)) { posRef.pos += 5; return false; }
  if (src.startsWith('null', posRef.pos)) { posRef.pos += 4; return null; }
  if (c === '-' || (c >= '0' && c <= '9')) return parseNumber(src, posRef);
  throw new Error(`cannot parse literal at position ${posRef.pos}: ...${src.slice(posRef.pos, posRef.pos + 30)}`);
}

/** Statically extract `const NAME = {...}` (or `[...]`) as a plain JS value. Never eval/Function/import. */
export function extractConst(absPath, constName) {
  if (!existsSync(absPath)) return { value: undefined, error: `file not found: ${absPath}` };
  const src = readFileSync(absPath, 'utf8');
  const re = new RegExp(`\\bconst\\s+${constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*`);
  const m = re.exec(src);
  if (!m) return { value: undefined, error: `const ${constName} not found in ${absPath}` };
  const posRef = { pos: m.index + m[0].length };
  try {
    const value = parseValue(src, posRef);
    return { value, error: null };
  } catch (e) {
    return { value: undefined, error: `parse error extracting ${constName} from ${absPath}: ${e.message}` };
  }
}

/** Resolve a "$YEAR.tiers[0].threshold_min"-style path against an extracted table. */
export function resolvePath(obj, pathTemplate, year) {
  const pathStr = pathTemplate.replace('$YEAR', String(year));
  const tokens = pathStr.match(/[^.[\]]+/g) || [];
  let cur = obj;
  for (const t of tokens) {
    if (cur == null) return undefined;
    cur = cur[t];
  }
  return cur;
}

// ── run ──────────────────────────────────────────────────────────────────────

export function run(registry) {
  const divergenceFindings = [];
  const unresolvedFindings = [];
  const extractionErrors = [];
  const exemptSets = [];
  const checkedSets = [];

  for (const set of registry.sets) {
    if (set.status === 'EXEMPT-BY-DESIGN') {
      exemptSets.push({ id: set.id, reason: set.exemptReason || '(no reason recorded)' });
      continue;
    }

    const extracted = {};
    let hadExtractionError = false;
    for (const kernel of set.kernels) {
      const abs = resolve(REPO, kernel.file);
      const { value, error } = extractConst(abs, kernel.const);
      if (error) {
        extractionErrors.push({ set: set.id, tool_id: kernel.tool_id, error });
        hadExtractionError = true;
        continue;
      }
      extracted[kernel.tool_id] = value;
    }
    if (hadExtractionError) continue;

    checkedSets.push(set.id);
    for (const year of set.years) {
      for (const cell of set.cells) {
        const resolvedValues = {};
        let cellUnresolved = false;
        for (const kernel of set.kernels) {
          const path = cell.paths[kernel.tool_id];
          if (path === undefined) {
            unresolvedFindings.push({
              set: set.id, cell: cell.name, year, tool_id: kernel.tool_id,
              reason: `no path declared for this kernel in cell "${cell.name}"`,
            });
            cellUnresolved = true;
            continue;
          }
          const val = resolvePath(extracted[kernel.tool_id], path, year);
          if (val === undefined) {
            unresolvedFindings.push({
              set: set.id, cell: cell.name, year, tool_id: kernel.tool_id,
              reason: `path "${path.replace('$YEAR', String(year))}" resolved to undefined`,
            });
            cellUnresolved = true;
            continue;
          }
          resolvedValues[kernel.tool_id] = val;
        }
        if (cellUnresolved) continue;

        const uniqueSerialized = new Set(Object.values(resolvedValues).map((v) => JSON.stringify(v)));
        if (uniqueSerialized.size > 1) {
          divergenceFindings.push({ set: set.id, cell: cell.name, year, values: resolvedValues });
        }
      }
    }
  }

  return { divergenceFindings, unresolvedFindings, extractionErrors, exemptSets, checkedSets };
}

function loadRegistry(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function printReport(result) {
  const { divergenceFindings, unresolvedFindings, extractionErrors, exemptSets, checkedSets } = result;

  console.log(`check-shared-tables: ${checkedSets.length} set(s) checked, ${exemptSets.length} exempt`);
  for (const s of exemptSets) console.log(`  ⊘ EXEMPT-BY-DESIGN — ${s.id}: ${s.reason}`);
  console.log('');

  if (extractionErrors.length) {
    console.log(`✗ EXTRACTION ERROR — ${extractionErrors.length} finding(s):`);
    for (const f of extractionErrors) console.log(`  - set "${f.set}", kernel "${f.tool_id}": ${f.error}`);
    console.log('');
  }

  if (unresolvedFindings.length) {
    console.log(`✗ UNRESOLVED PATH — ${unresolvedFindings.length} finding(s) (registry defect, never a silent pass):`);
    for (const f of unresolvedFindings) {
      console.log(`  - set "${f.set}", cell "${f.cell}", year ${f.year}, kernel "${f.tool_id}": ${f.reason}`);
    }
    console.log('');
  }

  if (divergenceFindings.length) {
    console.log(`✗ DIVERGENCE — ${divergenceFindings.length} finding(s):`);
    for (const f of divergenceFindings) {
      const vals = Object.entries(f.values).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      console.log(`  - set "${f.set}", cell "${f.cell}", year ${f.year}: ${vals}`);
    }
    console.log('');
  } else if (checkedSets.length) {
    console.log('✓ every checked set converges: all vendored copies report identical cell values across all declared years');
  }

  const hardFail = divergenceFindings.length > 0 || unresolvedFindings.length > 0 || extractionErrors.length > 0;
  return hardFail;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const registry = loadRegistry(REGISTRY_PATH);
  const result = run(registry);
  const hardFail = printReport(result);
  process.exit(hardFail ? 1 : 0);
}
