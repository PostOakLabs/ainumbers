#!/usr/bin/env node
/**
 * gen-input-schemas.mjs — MANIFEST-SCHEMA-BACKFILL-1.
 *
 * Backfills `input_schema` for every kernel whose declared input schema does not
 * exist (sweep triage class NO-DECLARED-SCHEMA), DERIVED FROM MEASURED KERNEL
 * READS — the same static extraction `check-schema-read-divergence.mjs` performs
 * (that checker is the acceptance gate: every backfilled kernel must re-verify
 * CLEARED, i.e. declared == reads exactly, both directions).
 *
 * Honesty rules (row-fenced, never guessed):
 *   - property SET is the extractor's read set, verbatim — never widened, never narrowed;
 *   - types only where the code evidences them: safeNum(..)/Number(..)/numeric
 *     comparison -> number · boolean tests -> boolean · array iteration -> array ·
 *     >=2 distinct string literals in ===/case/includes -> enum(literals) ·
 *     string methods -> string · anything else -> honest `"type": "unknown"`;
 *     conflicting evidence -> unknown (never pick a winner);
 *   - defaults captured ONLY where `?? <literal>`, destructuring `f = <literal>`,
 *     or `safeNum(pp.f, <literal>)` states one;
 *   - `required` is mechanical: a field is required iff it has NO evidenced default
 *     AND every one of its reads is a bare (non-`?.`) dereference — any optional-
 *     chained read means the kernel contemplates absence, so the field is optional;
 *   - descriptions ONLY where mechanical from the field name's unit suffix
 *     (_pct, _bn, _usd, _bps, _yrs, _days, ...); otherwise omitted, never invented.
 *
 * Provenance: every backfilled schema block carries
 *   "x_schema_provenance": "derived-from-kernel-reads 2026-09-01"
 * (machine-derived, honest, upgradeable). This mark is also the OWNERSHIP mark for
 * --check: manifests without it are hand-curated and never touched by this tool.
 *
 * The backfill writes BOTH declared-schema slots so the two writers agree
 * (gen-webmcp-registrations.mjs checkManifestSchemaParity): `input_schema`
 * (the sweep-cleared surface) and `mcp_tool_definition.inputSchema` (the WebMCP
 * emission surface). Manifest scaffolding for kernels with no manifest file is
 * drafted by the EXISTING MFSTGEN-1 generator (scripts/generate-node-manifest.mjs,
 * run as a subprocess — one writer for field derivation: TODO_*_REVIEW markers,
 * category from hub-categories.json, title/description from chaingraph.json).
 *
 * WebMCP flip guard: a backfilled manifest must never flip a tool into the
 * gen-webmcp-registrations emittable set (that would red the WebMCP freshness
 * gate until its page region is emitted — a WEBMCP-GEN-FROM-MANIFEST-1 deliverable,
 * fenced away from this row). Kernels whose DRAFT manifest would flip are SKIPPED
 * with reason and named for the tranche-2 handoff. The flip probe mirrors
 * gen-webmcp-registrations.mjs adjudicateTool G2/G3/G4/G5 (credited; its own
 * preflight gate remains the authority).
 *
 * Modes:
 *   node scripts/gen-input-schemas.mjs                  (report only — no writes)
 *   node scripts/gen-input-schemas.mjs --write [--only id1,id2,...]
 *   node scripts/gen-input-schemas.mjs --check          (drift gate: hand-edits to
 *                    provenance-marked schema blocks go red; exit 1 on any drift)
 *   node scripts/gen-input-schemas.mjs --self-test      (controls incl. enum
 *                    inference + unknown-type honesty + default capture + a
 *                    tamper-red mutation control; exit 1 on any failed control)
 *
 * ⛔ Zero kernel bytes edited · chaingraph.json is READ (indexing) and NEVER written ·
 *   no tool-page edits. Fence: manifests' input-schema blocks + this generator + wiring.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  stripJS, findCompute, findLocalHelper, extractReads, parseDestructureKeys,
  sweepKernel, loadManifestIndex, loadMcpNameIndex, listKernelFiles,
} from './check-schema-read-divergence.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const REPO = path.resolve(HERE, '..');

export const PROVENANCE = 'derived-from-kernel-reads 2026-09-01';
const PROVENANCE_RE = /^derived-from-kernel-reads \d{4}-\d{2}-\d{2}$/;
const FLIP_STEM = 'TODO_FUNCTION_NAME_REVIEW'; // gen-webmcp G3 cannot pass on a TODO name

// ── mechanical unit-suffix descriptions (row: unit suffixes ONLY) ────────────
const UNIT_SUFFIX_DESCRIPTIONS = [
  ['_usd_bn', 'Amount in billions of US dollars'],
  ['_usd_mn', 'Amount in millions of US dollars'],
  ['_usd_mm', 'Amount in millions of US dollars'],
  ['_usd', 'Amount in US dollars'],
  ['_pctile', 'Percentile value'],
  ['_pct', 'Percentage value'],
  ['_bps', 'Amount in basis points'],
  ['_bn', 'Amount in billions'],
  ['_mn', 'Amount in millions'],
  ['_mm', 'Amount in millions'],
  ['_yrs', 'Duration in years'],
  ['_yr', 'Duration in years'],
  ['_mos', 'Duration in months'],
  ['_days', 'Duration in days'],
  ['_hrs', 'Duration in hours'],
  ['_mins', 'Duration in minutes'],
  ['_secs', 'Duration in seconds'],
  ['_count', 'Count'],
  ['_cnt', 'Count'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Body collection — mirrors check-schema-read-divergence sweepKernel's scope
// exactly (compute() + exported params-shaped consumers + one level of same-file
// helper resolution) so evidence search sees precisely the reads the checker sees.
// ─────────────────────────────────────────────────────────────────────────────
function collectBodies(stripped) {
  const comp = findCompute(stripped);
  if (!comp) return null;
  const bodies = [{ text: stripped.slice(comp.start, comp.end), param: comp.param }];
  const exportRe = /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)/g;
  let ex;
  while ((ex = exportRe.exec(stripped))) {
    const [, name, param] = ex;
    if (name === 'compute' || name === 'buildArtifact') continue;
    if (!/^(pp|params|policy_parameters|input|inputs|raw)$/.test(param)) continue;
    const open = stripped.indexOf('{', ex.index + ex[0].length - 1);
    if (open === -1) continue;
    const close = matchBracket(stripped, open, '{', '}');
    if (close === -1) continue;
    bodies.push({ text: stripped.slice(open + 1, close), param });
  }
  // helper resolution (same bounded loop shape as the checker)
  const firstPass = bodies.map((b) => extractReads(b.text, b.param));
  const pending = firstPass.flatMap((r) => r.helpers);
  const resolved = new Set();
  let guard = 0;
  while (pending.length && guard < 24) {
    guard++;
    const name = pending.shift();
    if (resolved.has(name)) continue;
    resolved.add(name);
    const h = findLocalHelper(stripped, name);
    if (!h) continue;
    const hr = extractReads(h.body, h.param);
    bodies.push({ text: h.body, param: h.param });
    for (const h2 of hr.helpers) if (!resolved.has(h2)) pending.push(h2);
  }
  // per-body alias sets, for access-pattern building
  return bodies.map((b, i) => ({ ...b, aliases: new Set(i < firstPass.length ? firstPass[i].aliases.keys() : []) }));
}

function matchBracket(text, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let k = openIdx; k < text.length; k++) {
    if (text[k] === openCh) depth++;
    else if (text[k] === closeCh) { depth--; if (depth === 0) return k; }
  }
  return -1;
}

/** Access-matching source for `base` (param or alias) reaching field `f`. */
function accessPattern(base, f, aliasNames) {
  const esc = (s) => s.replace(/\$/g, '\\$');
  const bases = [base, ...aliasNames].map(esc);
  const B = `(?:${bases.join('|')})`;
  const F = esc(f);
  // pp.f | pp?.f | pp?.['f'] | pp['f'] | pp["f"]
  return new RegExp(
    `\\b${B}\\s*\\?\\.\\s*${F}\\b` +
    `|\\b${B}\\s*\\.\\s*${F}\\b` +
    `|\\b${B}\\s*\\?\\.?\\[\\s*['"]${F}['"]\\s*\\]` +
    `|\\b${B}\\s*\\[\\s*['"]${F}['"]\\s*\\]`,
    'g');
}

const isNumericLiteral = (s) => /^-?\d+(?:\.\d+)?$/.test(s);
const isStringLiteral = (s) => /^'[^']*'$|^"[^"]*"$/.test(s);
const unquote = (s) => (isStringLiteral(s) ? s.slice(1, -1) : s);

// ─────────────────────────────────────────────────────────────────────────────
// Type evidence per field, gathered from RAW kernel source (offsets from the
// stripped scan apply to the raw text 1:1 — stripJS only blanks).
// ─────────────────────────────────────────────────────────────────────────────
export function inferFieldEvidence(repoRoot, kernelFile, reads) {
  const src = fs.readFileSync(path.join(repoRoot, kernelFile), 'utf8');
  const stripped = stripJS(src);
  const bodies = collectBodies(stripped);
  const ev = {};
  for (const f of reads) ev[f] = { numbers: [], strings: [], enums: new Set(), boolean: false, array: false, default: undefined, hasDefault: false, bare: 0, optional: 0 };
  if (!bodies) return ev;

  for (const body of bodies) {
    for (const f of reads) {
      const e = ev[f];
      if (!e) continue;
      const accRe = accessPattern(body.param, f, body.aliases);
      let m;
      while ((m = accRe.exec(body.text))) {
        const at = m.index;
        const after = body.text.slice(accRe.lastIndex, accRe.lastIndex + 120);
        const before = body.text.slice(Math.max(0, at - 40), at);
        if (/^\s*\(/.test(after)) continue; // method-looking invocation on the field token
        // bare vs optional-chained (the matched operator tells us which)
        const matched = m[0];
        if (/\?\./.test(matched) || /\?\.\?\[/.test(matched)) e.optional++;
        else if (/\[\s*['"]/.test(matched)) e.bare++;
        else e.bare++;

        // `?? <literal>` default immediately after the access
        const dd = after.match(/^\s*\?\?\s*(-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|true|false|null)/);
        if (dd && !e.hasDefault) {
          const lit = dd[1];
          e.hasDefault = true;
          e.default = lit === 'null' ? null : isNumericLiteral(lit) ? Number(lit) : unquote(lit) === lit && (lit === 'true' || lit === 'false') ? lit === 'true' : unquote(lit);
        }
        // numeric comparison vs literal:  f > 0.5   |   0.5 < f
        if (/^\s*[<>]=?\s*-?\d/.test(after) || /-?\d(?:\.\d+)?\s*[<>]=?\s*$/.test(before)) e.numbers.push('cmp');
        // numeric-only arithmetic: f - 1 / f * 2 / f / 3 / f -= 4  (`+` is CONCAT-AMBIGUOUS in JS, never evidence)
        if (/^\s*[-*/]\s*=?\s*-?[\d.]/.test(after) || /[\d.)\]]\s*[-*/]\s*$/.test(before)) e.numbers.push('arith');
        // array evidence before the access: for..of / spread
        if (/\bfor\s*\(\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s+of\s+$/.test(before)) e.array = true;
        if (/\.\.\.\s*$/.test(before)) e.array = true;
        // boolean shapes
        if (/^\s*===?\s*(true|false)/.test(after) || /^\s*!==?\s*(true|false)/.test(after)) e.boolean = true;
        if (/!\s*$/.test(before)) e.boolean = true;
        if (new RegExp(`\\bBoolean\\s*\\(\\s*$`).test(before)) e.boolean = true;
        // enum literals via === / ==
        const eq = after.match(/^\s*===?\s*'([^']*)'|^\s*===?\s*"([^"]*)"/);
        if (eq) e.enums.add(eq[1] ?? eq[2]);
        // wrapping coercions
        if (new RegExp(`\\b(?:safeNum|Number|parseFloat|parseInt|Math\\.(?:min|max|abs|round|floor|ceil))\\s*\\(\\s*$`).test(before)) e.numbers.push('wrap');
        if (new RegExp(`\\bArray\\.isArray\\s*\\(\\s*$`).test(before)) e.array = true;

        // member method evidence ON the field value — unambiguous array iterators only
        // (join/slice/indexOf exist on strings too, so they are NOT array evidence)
        const meth = after.match(/^\s*\.\s*(map|forEach|filter|reduce|reduceRight|some|every|find|findIndex|flatMap)\s*\(/);
        if (meth) e.array = true;
        const smeth = after.match(/^\s*\.\s*(trim|trimStart|trimEnd|toLowerCase|toUpperCase|startsWith|endsWith|charAt|charCodeAt|codePointAt|padStart|padEnd|repeat|replace|replaceAll|split|match|normalize|localeCompare)\s*\(/);
        if (smeth) e.strings.push(smeth[1]);
      }
      // dedicated switch scan: switch ( <access> ) { case 'lit': ... }
      const switchRe = new RegExp(`switch\\s*\\(\\s*${accessPattern(body.param, f, body.aliases).source.replace(/^\\\\b/, '')}\\s*\\)`, 'g');
      let wm;
      while ((wm = switchRe.exec(body.text))) {
        const caseBlock = body.text.slice(wm.index, Math.min(body.text.length, wm.index + 1200));
        const caseRe = /\bcase\s+'([^']*)'|\bcase\s+"([^"]*)"/g;
        let cm;
        while ((cm = caseRe.exec(caseBlock))) e.enums.add(cm[1] ?? cm[2]);
      }
      // ['a','b'].includes( <access> ) / includes via variable arrays are NOT enumerated — literal arrays only
      const incRe = new RegExp(`\\[\\s*(?:'([^']*)'\\s*|"([^"]*)"\\s*)(?:,\\s*(?:'([^']*)'\\s*|"([^"]*)"\\s*))*\\]\\s*\\.\\s*includes\\s*\\(\\s*${accessPattern(body.param, f, body.aliases).source}`, 'g');
      let im;
      while ((im = incRe.exec(body.text))) {
        const chunk = im[0];
        const litRe = /'([^']*)'|"([^"]*)"/g;
        let lm;
        while ((lm = litRe.exec(chunk))) e.enums.add(lm[1] ?? lm[2]);
      }
    }
    // destructuring defaults: const { f = <lit> , ... } = <param|alias>
    const declKw = /\b(?:const|let|var)\s*/g;
    let dm;
    while ((dm = declKw.exec(body.text))) {
      let k = dm.index + dm[0].length;
      if (body.text[k] !== '{') continue;
      const close = matchBracket(body.text, k, '{', '}');
      if (close === -1) continue;
      const after = body.text.slice(close + 1, close + 120);
      const eqM = after.match(/^\s*=\s*([A-Za-z_$][\w$]*)/);
      if (!eqM) continue;
      const srcName = eqM[1];
      if (srcName !== body.param && !body.aliases.has(srcName)) continue;
      const pattern = body.text.slice(k + 1, close);
      for (const f of reads) {
        const e = ev[f];
        if (!e || e.hasDefault) continue;
        const dflt = new RegExp(`(?:^\\s*|[,\\{]\\s*)${f.replace(/\$/g, '\\$')}\\s*=\\s*(-?\\d+(?:\\.\\d+)?|'[^']*'|"[^"]*"|true|false|null)\\s*(?:[,}]|$)`).exec(pattern);
        if (dflt) {
          const lit = dflt[1];
          e.hasDefault = true;
          e.default = lit === 'null' ? null : isNumericLiteral(lit) ? Number(lit) : lit === 'true' ? true : lit === 'false' ? false : unquote(lit);
        }
      }
    }
    // safeNum(<access>, <literal>) second-arg default + number evidence
    for (const f of reads) {
      const e = ev[f];
      if (!e) continue;
      const snRe = new RegExp(`\\bsafeNum\\s*\\(\\s*(${accessPattern(body.param, f, body.aliases).source})\\s*,\\s*(-?\\d+(?:\\.\\d+)?|'[^']*'|"[^"]*"|true|false|null)\\s*\\)`, 'g');
      let sn;
      while ((sn = snRe.exec(body.text))) {
        e.numbers.push('safeNum');
        if (!e.hasDefault) {
          const lit = sn[2];
          e.hasDefault = true;
          e.default = lit === 'null' ? null : isNumericLiteral(lit) ? Number(lit) : lit === 'true' ? true : lit === 'false' ? false : unquote(lit);
        }
      }
      const snBare = new RegExp(`\\bsafeNum\\s*\\(\\s*(${accessPattern(body.param, f, body.aliases).source})\\s*[,)]`, 'g');
      while ((sn = snBare.exec(body.text))) e.numbers.push('safeNum');
    }
  }
  return ev;
}

/** Mechanical unit-suffix description, or undefined. */
export function mechanicalDescription(fieldName) {
  const lower = fieldName.toLowerCase();
  for (const [suffix, desc] of UNIT_SUFFIX_DESCRIPTIONS) {
    if (lower.endsWith(suffix)) return desc;
  }
  return undefined;
}

/**
 * Derive the input-schema property map for one kernel. The property SET is the
 * sweep extractor's read set, verbatim. Types only where evidenced.
 * `indexes` ({manifestIndex, mcpNameByTool}) may be preloaded by batch callers.
 */
export function deriveInputSchema(repoRoot, kernelFile, indexes) {
  const mi = indexes?.manifestIndex || loadManifestIndex(repoRoot);
  const mn = indexes?.mcpNameByTool || loadMcpNameIndex(repoRoot);
  const rec = sweepKernel(repoRoot, kernelFile, mi, mn);
  const reads = rec.reads;
  const ev = inferFieldEvidence(repoRoot, kernelFile, reads);
  const properties = {};
  const required = [];
  for (const f of reads) {
    const e = ev[f];
    const prop = {};
    let type = 'unknown';
    const literals = [...e.enums].filter((x) => !x.startsWith('__method_'));
    const wantsNumber = e.numbers.length > 0;
    const wantsString = e.strings.length > 0;
    const wantsBoolean = e.boolean;
    const wantsArray = e.array;
    if (literals.length >= 2 && !wantsNumber && !wantsBoolean && !wantsArray) {
      prop.type = 'string';
      prop.enum = literals.sort();
    } else {
      const votes = [wantsNumber, wantsString, wantsBoolean, wantsArray].filter(Boolean).length;
      if (votes === 1) {
        if (wantsNumber) type = 'number';
        else if (wantsArray) type = 'array';
        else if (wantsBoolean) type = 'boolean';
        else if (wantsString) type = 'string';
        prop.type = type;
      } else {
        prop.type = 'unknown'; // no evidence OR conflicting evidence — honest unknown
      }
    }
    if (e.hasDefault) prop.default = e.default;
    const desc = mechanicalDescription(f);
    if (desc) prop.description = desc;
    if (!e.hasDefault && e.optional === 0 && e.bare > 0) required.push(f);
    properties[f] = prop;
  }
  const inputSchema = {
    type: 'object',
    required: required.sort(),
    properties,
    x_schema_provenance: PROVENANCE,
  };
  return { inputSchema, rec };
}

// ── WebMCP flip probe (mirrors gen-webmcp-registrations.mjs adjudicateTool
//    G2/G3/G4/G5; G1/G1b/G6 hold by construction for backfilled manifests) ────
export function wouldFlipToEmittable(manifest, repoRoot) {
  const toolId = manifest.tool_id;
  const pageRel = path.join('chaingraph', `${toolId}.html`);
  let pageSrc;
  try { pageSrc = fs.readFileSync(path.join(repoRoot, pageRel), 'utf8'); } catch { return false; } // no page → kernel-only → never emittable
  const entry = manifest.execution?.entry || '';
  if (entry && path.basename(entry) !== `${toolId}.html`) return false;
  const fn = manifest.execution?.function_name || '';
  if (!fn || fn === FLIP_STEM) return false; // TODO name can never satisfy G3
  const def = manifest.mcp_tool_definition;
  const props = Object.keys(def?.inputSchema?.properties || {});
  for (const p of props) {
    if (!new RegExp(`id=["']${p.replace(/\$/g, '\\$')}["']`).test(pageSrc)) return false;
  }
  if (!new RegExp(`function\\s+${fn.replace(/\$/g, '\\$')}\\s*\\(`).test(pageSrc)) return false;
  if (!/_lastResult\s*=|_lastArtifact\s*=/.test(pageSrc)) return false;
  const withoutOwn = stripMarkedRegions(pageSrc);
  if (/\.registerTool\s*\(/.test(withoutOwn)) return false; // G4: owned elsewhere → not a flip we cause
  return true;
}

function stripMarkedRegions(src) {
  const BEGIN = '<!-- WEBMCP:GEN-BEGIN ';
  const END = '<!-- WEBMCP:GEN-END -->';
  let out = src;
  let b;
  while ((b = out.indexOf(BEGIN)) !== -1) {
    const e = out.indexOf(END, b);
    if (e === -1) break;
    out = out.slice(0, b) + out.slice(e + END.length);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill planning
// ─────────────────────────────────────────────────────────────────────────────
export function planBackfill(repoRoot) {
  const kernels = listKernelFiles(repoRoot);
  const manifestIndex = loadManifestIndex(repoRoot);
  const mcpNameByTool = loadMcpNameIndex(repoRoot);
  const indexes = { manifestIndex, mcpNameByTool };
  const plan = [];
  for (const kernelFile of kernels) {
    const toolId = path.basename(kernelFile, '.kernel.mjs');
    const rec = sweepKernel(repoRoot, kernelFile, manifestIndex, mcpNameByTool);
    const cls = rec.triage?.class || null;
    if (rec.verdict === 'UNPARSEABLE') {
      plan.push({ toolId, kernelFile, action: 'SKIP-UNPARSEABLE', reason: rec.unparseable_reason });
      continue;
    }
    if (rec.verdict === 'CLEARED') {
      plan.push({ toolId, kernelFile, action: 'SKIP-CLEARED', reason: 'reads already == declared — nothing to backfill' });
      continue;
    }
    if (rec.verdict !== 'DIVERGES' || cls !== 'NO-DECLARED-SCHEMA') {
      plan.push({ toolId, kernelFile, action: cls ? `SKIP-${cls}` : 'SKIP-DIVERGES', reason: `sweep verdict ${rec.verdict}${cls ? ` [${cls}]` : ''} — not a NO-DECLARED-SCHEMA backfill target` });
      continue;
    }
    // pairing manifest? (same pairing order as the checker: by tool_id, else by mcp_name)
    const mf = manifestIndex.byTool.get(toolId) || (mcpNameByTool.get(toolId) ? manifestIndex.byMcp.get(mcpNameByTool.get(toolId)) : null);
    let onDisk = null;
    if (mf) {
      try { onDisk = JSON.parse(fs.readFileSync(path.join(repoRoot, mf.file), 'utf8')); } catch { /* rewritten fresh below */ }
    }
    if (onDisk && onDisk.input_schema?.properties && PROVENANCE_RE.test(onDisk.input_schema?.x_schema_provenance || '')) {
      plan.push({ toolId, kernelFile, action: 'ALREADY-DERIVED', manifest: mf.file });
      continue;
    }
    if (onDisk && onDisk.input_schema?.properties) {
      plan.push({ toolId, kernelFile, action: 'SKIP-HAND-SCHEMA', manifest: mf.file, reason: 'existing declared schema carries no derived-from-kernel-reads provenance — hand-curated surface, never overwritten by this tool' });
      continue;
    }
    plan.push({ toolId, kernelFile, action: mf ? 'BACKFILL-INJECT' : 'BACKFILL-CREATE', manifest: mf ? mf.file : `manifests/${toolId}.manifest.json` });
  }
  plan.sort((a, b) => a.toolId.localeCompare(b.toolId));
  return plan;
}

// ── manifest scaffolding for kernels without a manifest file: the EXISTING
//    MFSTGEN-1 generator is the single field-derivation writer (subprocess). ──
function draftViaMfstgen(repoRoot, toolId) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'msb-'));
  try {
    execFileSync(process.execPath, ['scripts/generate-node-manifest.mjs', '--tool-id', toolId, '--out', tmp], { cwd: repoRoot, env: gitEnv(), encoding: 'utf8' });
    const f = path.join(tmp, `${toolId}.manifest.json`);
    if (!fs.existsSync(f)) return { error: 'generate-node-manifest.mjs produced no draft (node absent from chaingraph.json?)' };
    return { manifest: JSON.parse(fs.readFileSync(f, 'utf8')) };
  } catch (e) {
    return { error: `MFSTGEN draft failed: ${e.message}` };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Build the enriched manifest for one planned kernel (no I/O side effects on repo). */
export async function buildBackfillManifest(repoRoot, item, indexes) {
  const { inputSchema } = deriveInputSchema(repoRoot, item.kernelFile, indexes);
  const mi = indexes?.manifestIndex || loadManifestIndex(repoRoot);
  const mn = indexes?.mcpNameByTool || loadMcpNameIndex(repoRoot);
  const mf = mi.byTool.get(item.toolId) || (mn.get(item.toolId) ? mi.byMcp.get(mn.get(item.toolId)) : null);
  let manifest;
  if (mf) {
    manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, mf.file), 'utf8'));
    if (!manifest.mcp_tool_definition) return { error: `paired manifest ${mf.file} lacks mcp_tool_definition — cannot keep the two schema writers in parity` };
  } else {
    const draft = draftViaMfstgen(repoRoot, item.toolId);
    if (draft.error) return { error: draft.error };
    manifest = draft.manifest;
    if (!manifest.mcp_tool_definition) return { error: 'MFSTGEN draft lacks mcp_tool_definition' };
  }
  manifest.input_schema = JSON.parse(JSON.stringify(inputSchema));
  manifest.mcp_tool_definition.inputSchema = JSON.parse(JSON.stringify(inputSchema));
  if (wouldFlipToEmittable(manifest, repoRoot)) {
    return { flip: true, reason: 'completed manifest would flip this tool into the gen-webmcp-registrations emittable set (real execution.function_name + page mapping complete) — handed to WEBMCP-GEN-FROM-MANIFEST-1 tranche-2, which owns page emission; skipping keeps the WebMCP freshness gate green' };
  }
  return { manifest };
}

// ─────────────────────────────────────────────────────────────────────────────
// --check: every provenance-marked schema block must byte-match a fresh
// derivation from its kernel. Hand-edits to derived blocks go red.
// ─────────────────────────────────────────────────────────────────────────────
function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalize(v[k]);
    return out;
  }
  return v;
}

export function checkDerivedSchemas(repoRoot) {
  const kernels = listKernelFiles(repoRoot);
  const kernelByTool = new Map(kernels.map((k) => [path.basename(k, '.kernel.mjs'), k]));
  const mcpNameByTool = loadMcpNameIndex(repoRoot);
  const toolByMcpName = new Map([...mcpNameByTool.entries()].map(([tid, name]) => [name, tid]));
  const manifestIndex = loadManifestIndex(repoRoot);
  const problems = [];
  let owned = 0;
  for (const f of fs.readdirSync(path.join(repoRoot, 'manifests')).filter((x) => x.endsWith('.manifest.json'))) {
    const rel = `manifests/${f}`;
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifests', f), 'utf8')); } catch (e) {
      problems.push(`${rel}: invalid JSON: ${e.message}`);
      continue;
    }
    const prov = m?.input_schema?.x_schema_provenance;
    if (!prov || !PROVENANCE_RE.test(prov)) continue; // not ours — hand-curated surface
    owned++;
    // resolve the pairing kernel the same way the sweep checker pairs
    // (manifest by tool_id, else by the node's mcp_name — legacy-numbered
    // manifest filenames can carry a tool_id that belongs to no kernel)
    const byName = m.mcp_tool_definition?.name ? toolByMcpName.get(m.mcp_tool_definition.name) : null;
    const toolId = (kernelByTool.has(m.tool_id) ? m.tool_id : null) ?? byName ?? m.tool_id;
    const kernelFile = kernelByTool.get(toolId);
    if (!kernelFile) {
      problems.push(`${rel}: provenance-marked schema pairs with no kernel (kernel removed?)`);
      continue;
    }
    let fresh;
    try { fresh = deriveInputSchema(repoRoot, kernelFile, { manifestIndex, mcpNameByTool }).inputSchema; } catch (e) {
      problems.push(`${rel}: re-derivation failed: ${e.message}`);
      continue;
    }
    if (JSON.stringify(canonicalize(m.input_schema)) !== JSON.stringify(canonicalize(fresh))) {
      problems.push(`${rel}: input_schema drifted from the kernel's measured reads — hand-edits to derived schemas are red; regenerate with node scripts/gen-input-schemas.mjs --write --only ${toolId}`);
    }
    const got = m.mcp_tool_definition?.inputSchema;
    if (!got || JSON.stringify(canonicalize(got)) !== JSON.stringify(canonicalize(fresh))) {
      problems.push(`${rel}: mcp_tool_definition.inputSchema drifted from input_schema (the two schema writers must agree)`);
    }
  }
  return { owned, problems };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const { owned, problems } = checkDerivedSchemas(REPO);
    if (problems.length) {
      console.error(`✗ input-schema backfill freshness FAILED (${problems.length} problem(s), ${owned} derived schema(s) checked):`);
      problems.forEach((p) => console.error('  • ' + p));
      process.exit(1);
    }
    console.log(`✓ input-schema backfill freshness clean — ${owned} provenance-marked schema(s) byte-match fresh derivations from kernel reads.`);
    process.exit(0);
  }

  const write = args.includes('--write');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;

  const plan = planBackfill(REPO);
  const targets = only ? plan.filter((p) => only.includes(p.toolId)) : plan;
  if (only) {
    const missing = only.filter((id) => !plan.some((p) => p.toolId === id));
    if (missing.length) {
      console.error(`--only names tool(s) not in the backfill plan: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  const counts = {};
  for (const item of plan) counts[item.action] = (counts[item.action] || 0) + 1;
  console.error(`plan: ${plan.length} kernel(s) — ${JSON.stringify(counts)}`);

  if (!write) {
    for (const item of targets) {
      const extra = item.reason ? ` — ${item.reason}` : '';
      console.log(`${item.action}\t${item.toolId}\t${item.manifest || item.kernelFile}${extra}`);
    }
    process.exit(0);
  }

  (async () => {
    const written = [];
    const flips = [];
    const failures = [];
    for (const item of targets) {
      if (item.action !== 'BACKFILL-INJECT' && item.action !== 'BACKFILL-CREATE') continue;
      const res = await buildBackfillManifest(REPO, item);
      if (res.error) { failures.push(`${item.toolId}: ${res.error}`); continue; }
      if (res.flip) { flips.push(`${item.toolId}: ${res.reason}`); continue; }
      const outPath = path.join(REPO, item.manifest);
      fs.writeFileSync(outPath, JSON.stringify(res.manifest, null, 2) + '\n', 'utf8');
      written.push(item.manifest);
      console.log(`✓ ${item.action === 'BACKFILL-CREATE' ? 'created' : 'injected'} ${item.manifest} (${item.toolId})`);
    }
    if (flips.length) {
      console.error(`\n⚠ ${flips.length} WebMCP-flip skip(s) — handed to WEBMCP-GEN-FROM-MANIFEST-1 tranche-2:`);
      flips.forEach((f) => console.error('  • ' + f));
    }
    if (failures.length) {
      console.error(`\n✗ ${failures.length} failure(s):`);
      failures.forEach((f) => console.error('  • ' + f));
    }
    console.error(`\nwrote ${written.length} manifest(s); ${flips.length} flip-skip(s); ${failures.length} failure(s).`);
    process.exit(failures.length ? 1 : 0);
  })();
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('gen-input-schemas.mjs')) main();
