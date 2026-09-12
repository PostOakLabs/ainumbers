#!/usr/bin/env node
/**
 * scripts/gen-wave22-tools.mjs — WAVE22-SCAFFOLD-MIRROR-FIX-1
 *
 * Gated registration writer for the wave-22 tool pages (art-112..122).
 *
 * History: this file was the ungated generator that rendered art-112..122
 * wholesale. That writer shipped 8 of the 11 pages WITHOUT the WebMCP
 * `registerTool` registration block the rest of the generated estate carries
 * (art-116/118/119 have it), and nothing in preflight could notice the drift —
 * the defect WAVE22-SCAFFOLD-MIRROR-FIX-1 closes. The checked-in pages have
 * since accumulated chrome owned by LATER registered writers (canonical
 * OCG chrome CSS/nav, the `.md` alternate link, ASK-AGENT, proof binding,
 * the §16 UI shim), so wholesale re-rendering is forbidden here: it reverts
 * bytes this writer does not own.
 *
 * The writer now owns exactly one thing — bringing each wave-22 page into the
 * estate's registered state, through the estate's registered writers only:
 *
 *   1. ALIGN (generator-derivable page prep): some wave-22 controls use short
 *      element-id aliases (`id="contam_tlc"`) while the manifest property they
 *      already feed is the full name (`contaminated_tlc`). The estate
 *      registration writer's mapping control (G2) requires a literal
 *      `id="<prop>"` per inputSchema property, so this writer derives each
 *      aliased pair FROM THE PAGE'S OWN getParams code (prop ← element id;
 *      pp keys are unchanged, so policy_parameters and execution_hash are
 *      untouched) and renames the element ids in exactly two contexts:
 *      `id="<old>"` and `getElementById('<old>')`.
 *   2. REGISTER: invoke the estate registration writer
 *      (scripts/gen-webmcp-registrations.mjs, WEBMCP-GEN-FROM-MANIFEST-1)
 *      per tool. THAT writer verifies every guard (manifest shape, page
 *      mapping, wrapper, sweep gate) and owns the emitted bytes (marker-
 *      delimited registration region + origin-trial meta). No snippet block
 *      is ever written by this file.
 *   3. REPORT refusals honestly: a tool the estate writer refuses (some
 *      manifest property has no faithful control on the page — the
 *      kernel-derived schema is wider than the page's form) is restored
 *      untouched and reported with the writer's verbatim reason. The
 *      deliverable is every page the emitter accepts; the rest stay
 *      excluded-with-reasons until their schema row lands.
 *
 * Modes (mirrors the registered `gen-credits.mjs <repo-id> [--check]` shape):
 *   node scripts/gen-wave22-tools.mjs repo          write: align + register
 *   node scripts/gen-wave22-tools.mjs repo --check  freshness gate (no writes)
 *
 * --check is RED unless every wave-22 page is in one of two honest states:
 *   a) the page carries the estate writer's generated region (byte freshness
 *      is then owned by `gen-webmcp-registrations.mjs --check`, preflight);
 *   b) the page carries no registration AND the estate writer, probed live,
 *      still refuses it (preflight says the page is not WebMCP-addressable).
 * A page the estate writer WOULD emit but that carries no region is the
 * silent-stale drift class this gate exists to catch, and is RED.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = __dirname;

// The 11 wave-22 tool pages, by tool_id (= chaingraph/<slug>.html).
const WAVE22_TOOLS = [
  'art-112-dscsa-transaction-statement-verifier',
  'art-113-saleable-returns-verifier',
  'art-114-suspect-product-quarantine',
  'art-115-dpp-data-carrier-validator',
  'art-116-product-lineage-builder',
  'art-117-product-authenticity-verifier',
  'art-118-fsma204-cte-validator',
  'art-119-traceability-lot-code-linker',
  'art-120-recall-trace-resolver',
  'art-121-document-integrity-anchor',
  'art-122-timestamp-attestation-verifier',
];

// The estate registration writer's region markers (kept in sync with its
// exported BEGIN/END; this file deliberately spawns it as a CLI and shares
// no code with it).
const REGION_BEGIN = '<!-- WEBMCP:GEN-BEGIN ';
const ESTATE_WRITER = 'gen-webmcp-registrations.mjs';

function pagePath(repoRoot, slug) {
  return path.join(repoRoot, 'chaingraph', slug + '.html');
}

function manifestProps(repoRoot, slug) {
  const mPath = path.join(repoRoot, 'manifests', slug + '.manifest.json');
  const m = JSON.parse(readFileSync(mPath, 'utf8'));
  const props = m.mcp_tool_definition && m.mcp_tool_definition.inputSchema && m.mcp_tool_definition.inputSchema.properties;
  if (!props) throw new Error(`${mPath}: no mcp_tool_definition.inputSchema.properties`);
  return Object.keys(props);
}

/**
 * Derive the element-id alignment for one page FROM the page's own code plus
 * its registered manifest. A pair (oldId -> prop) is derived only when:
 *   - `prop` is a manifest inputSchema property with no literal id="<prop>"
 *     on the page, and
 *   - the page's own getParams binds that prop from `getElementById('oldId')`
 *     (directly, or via a local variable it JSON-parses into), and
 *   - oldId is not itself a manifest property name.
 * Nothing else is renamed; if the page's code does not link an unmapped prop
 * to a control, that prop simply stays unmapped and the estate writer's
 * mapping control keeps the tool excluded (honest refusal, never a guess).
 */
function deriveAlignment(repoRoot, slug, pageSrc) {
  const props = manifestProps(repoRoot, slug);
  const alignment = {};
  const conflicts = [];
  for (const prop of props) {
    if (new RegExp(`id=["']${prop}["']`).test(pageSrc)) continue; // already mapped
    // Direct binding: `prop:document.getElementById('oldId')`
    let oldId = null;
    let m = new RegExp(`${prop}\\s*:\\s*document\\.getElementById\\('([A-Za-z0-9_-]+)'\\)`).exec(pageSrc);
    if (m) {
      oldId = m[1];
    } else {
      // Two-hop binding: `local = JSON.parse(document.getElementById('oldId'))`
      // plus a return-shape alias `prop:local` in getParams.
      const locals = new Map(); // local var -> element id
      const reLocal = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:JSON\.parse\(\s*)?document\.getElementById\('([A-Za-z0-9_-]+)'\)/g;
      let lm;
      while ((lm = reLocal.exec(pageSrc))) locals.set(lm[1], lm[2]);
      m = new RegExp(`${prop}\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)\\b`).exec(pageSrc);
      if (m && locals.has(m[1])) oldId = locals.get(m[1]);
    }
    if (!oldId || oldId === prop) continue;
    if (props.includes(oldId)) continue; // old id is itself a schema name — nothing to align
    if (alignment[oldId] && alignment[oldId] !== prop) {
      conflicts.push(`${oldId} -> ${alignment[oldId]} / ${prop}`);
      continue;
    }
    alignment[oldId] = prop;
  }
  return { alignment, conflicts };
}

/**
 * Apply the alignment in exactly two contexts and assert completeness:
 * every old id must disappear from `id="..."` and `getElementById('...')`.
 * Any residue means the page's code references the control somewhere this
 * writer does not understand — abort rather than half-rename.
 */
function applyAlignment(pageSrc, slug, alignment) {
  let next = pageSrc;
  for (const [oldId, prop] of Object.entries(alignment)) {
    const patterns = [
      [`id="${oldId}"`, `id="${prop}"`],
      [`id='${oldId}'`, `id='${prop}'`],
      [`getElementById('${oldId}')`, `getElementById('${prop}')`],
    ];
    let hits = 0;
    for (const [from, to] of patterns) {
      const parts = next.split(from);
      hits += parts.length - 1;
      next = parts.join(to);
    }
    if (hits === 0) {
      throw new Error(`${slug}: alignment target '${oldId}' not found on the page (page drifted from the writer's derivation) — aborting, page unchanged`);
    }
    if (new RegExp(`id=["']${oldId}["']`).test(next) || next.includes(`getElementById('${oldId}')`)) {
      throw new Error(`${slug}: residue references to '${oldId}' remain after alignment — aborting, page unchanged`);
    }
  }
  return next;
}

function runEstateWriter(repoRoot, toolId, write) {
  const args = [path.join(SCRIPTS, ESTATE_WRITER), '--tool', toolId];
  if (write) args.push('--write');
  const r = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8' });
  return { status: r.status, output: String(r.stdout || '') + String(r.stderr || '') };
}

/**
 * Probe the estate writer's verdict against the page's POST-ALIGNMENT bytes:
 * apply the derived alignment on disk (if any), run the estate writer, and
 * restore the original bytes no matter what the probe returned. The verdict
 * is therefore the deepest one available — a tool refused only by the raw
 * page's id aliases reports its true residual blocker, and a tool whose
 * manifest has been reconciled by a later row reports WOULD EMIT, which is
 * the continuation signal this gate turns RED on.
 */
function probeAligned(repoRoot, slug, write) {
  const pPath = pagePath(repoRoot, slug);
  const src = readFileSync(pPath, 'utf8');
  const { alignment, conflicts } = deriveAlignment(repoRoot, slug, src);
  if (conflicts.length) return { verdict: 'ambiguous', reason: conflicts.join('; '), alignment };
  const aligned = Object.keys(alignment).length ? applyAlignment(src, slug, alignment) : src;
  const changed = aligned !== src;
  try {
    if (changed) writeFileSync(pPath, aligned, 'utf8');
    const r = runEstateWriter(repoRoot, slug, write);
    const reason = refusalReason(slug, r.output);
    if (r.status !== 0 || reason) return { verdict: 'refused', reason: reason || `${ESTATE_WRITER} exited ${r.status}`, alignment, output: r.output };
    if (/WOULD EMIT/.test(r.output)) return { verdict: 'would-emit', reason: null, alignment, output: r.output };
    return { verdict: 'ok', reason: null, alignment, output: r.output };
  } finally {
    // A pure probe (write=false) must leave the page byte-untouched. In write
    // mode the estate writer may have persisted its region — the CALLER restores
    // on refusal, never here.
    if (changed && !write) writeFileSync(pPath, src, 'utf8');
  }
}

function refusalReason(toolId, output) {
  const m = new RegExp(`^\\s*EXCLUDED ${toolId}: (.*)$`, 'm').exec(output);
  return m ? m[1].trim() : null;
}

function writeMode(repoRoot) {
  let accepted = 0, refused = 0, registered = 0, foreign = 0;
  for (const slug of WAVE22_TOOLS) {
    const pPath = pagePath(repoRoot, slug);
    const src = readFileSync(pPath, 'utf8');
    if (src.includes(REGION_BEGIN)) {
      registered++;
      console.log(`REGISTERED ${slug}: estate-writer region present (byte freshness owned by ${ESTATE_WRITER} --check)`);
      continue;
    }
    if (/\.registerTool\s*\(/.test(src)) {
      foreign++;
      console.log(`SKIP ${slug}: carries a registerTool call outside the estate writer's markers — another row's page, never touched`);
      continue;
    }
    const v = probeAligned(repoRoot, slug, true);
    if (v.verdict === 'refused' || v.verdict === 'ambiguous') {
      if (Object.keys(v.alignment).length) writeFileSync(pPath, src, 'utf8'); // restore: refused pages stay byte-untouched
      refused++;
      console.log(`REFUSED ${slug}: ${v.reason || `${ESTATE_WRITER} exited nonzero`}`);
      if (v.output) {
        const lines = v.output.split('\n').filter((l) => l.includes('EXCLUDED'));
        lines.forEach((l) => console.log('  ' + l.trim()));
      }
      continue;
    }
    accepted++;
    const wrote = /✓ wrote (\S+)/.exec(v.output);
    const exact = /already byte-exact/.test(v.output);
    console.log(`ACCEPTED ${slug}: ${wrote ? `estate writer emitted ${wrote[1]}` : exact ? 'already byte-exact' : 'estate writer reported success'}${Object.keys(v.alignment).length ? ` (aligned: ${Object.entries(v.alignment).map(([o, p]) => `${o}->${p}`).join(', ')})` : ''}`);
  }
  console.log(`\nwave-22 registration: ${accepted} accepted, ${registered} already registered, ${refused} refused (pages untouched), ${foreign} foreign-block skips.`);
  console.log(`Refused tools keep their honest exclusion until their schema row lands — the estate writer's live reason is quoted above.`);
}

function checkMode(repoRoot) {
  const problems = [];
  let registeredCount = 0, excludedCount = 0;
  for (const slug of WAVE22_TOOLS) {
    const pPath = pagePath(repoRoot, slug);
    let src;
    try { src = readFileSync(pPath, 'utf8'); } catch (e) {
      problems.push(`${slug}: page unreadable: ${e.message}`);
      continue;
    }
    if (src.includes(REGION_BEGIN)) {
      registeredCount++;
      console.log(`REGISTERED ${slug}: estate-writer region present`);
      continue; // state (a): region present, freshness = estate --check
    }
    if (/\.registerTool\s*\(/.test(src)) {
      problems.push(`${slug}: carries a registerTool call outside the estate writer's markers (foreign or orphaned block)`);
      continue;
    }
    // Probe the POST-ALIGNMENT verdict (alignment applied to disk, then
    // restored — see probeAligned) so the verdict is the page's true residual
    // state, not an id-alias artifact.
    const v = probeAligned(repoRoot, slug, false);
    if (v.verdict === 'refused') {
      excludedCount++;
      console.log(`EXCLUDED ${slug}: ${v.reason}`);
      continue; // state (b): honestly excluded, live reason on record
    }
    if (v.verdict === 'would-emit') {
      problems.push(`${slug}: registration silently missing — the estate writer would emit the page post-alignment (manifest reconciled) but it carries no generated region; run node scripts/gen-wave22-tools.mjs repo`);
      continue;
    }
    problems.push(`${slug}: unrecognized estate-writer verdict '${v.verdict}' (${v.reason || 'no reason'}) — inspect manually`);
  }
  if (problems.length) {
    console.error(`✗ wave-22 registration freshness FAILED (${problems.length}):`);
    problems.forEach((p) => console.error('    ' + p));
    process.exit(1);
  }
  console.log(`✓ wave-22 registration freshness clean — ${registeredCount} page(s) carry the estate writer's generated region, ${excludedCount} refused live with a reason on record; every one of the ${WAVE22_TOOLS.length} wave-22 pages is WebMCP-addressable or preflight says it is not.`);
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const positional = args.filter((a) => !a.startsWith('--'));
const scope = positional[0] || 'repo';
if (scope !== 'repo') {
  console.error('Usage: node scripts/gen-wave22-tools.mjs repo [--check]  (scope: repo — the site repo is this writer\'s only scope)');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..');
if (check) checkMode(repoRoot);
else writeMode(repoRoot);
