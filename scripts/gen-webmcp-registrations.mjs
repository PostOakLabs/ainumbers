#!/usr/bin/env node
/**
 * gen-webmcp-registrations.mjs — WEBMCP-GEN-FROM-MANIFEST-1
 *
 * Emits each tool page's inline WebMCP registration block FROM its manifest
 * (`manifests/*.manifest.json`, `mcp_tool_definition`), making the registration
 * a derived artifact: hand-copies drift (generator law), so the block is
 * generated, marker-delimited, and verified by `--check` in preflight.
 *
 * SWEEP GATE FIRST (the row's precondition): a registration generator must never
 * emit from an uncleared schema. The cleared set is NOT read from the sweep's
 * dated TSV — it is recomputed LIVE per candidate by importing the exported
 * sweepKernel/loadManifestIndex/loadMcpNameIndex of
 * scripts/check-schema-read-divergence.mjs (SCHEMA-READ-DIVERGENCE-SWEEP-1) and
 * requiring verdict CLEARED (reads == declared both directions). BENIGN-ALIAS is
 * NOT generable: its resolution is a schema widening, i.e. a manifest edit, which
 * is outside this generator's fence. Divergent tools are EXCLUDED with a
 * per-tool reason line in the generator output; the exclusion list shrinks as
 * fix rows land.
 *
 * Emitted pattern (the 2026-08 spec state; all dated observations):
 *   - `document.modelContext` preferred with `'modelContext' in navigator`
 *     fallback (getter moved to document, observed 2026-08-10, #1546 pattern);
 *     absent API registers nothing (page stays byte-identical without it);
 *   - ONE function per tool, ONE registration per page — namespace uniqueness
 *     is gated by scripts/check-webmcp-name-uniqueness.mjs (the check-tool-names
 *     gate family extended to WebMCP registrations);
 *   - name / description / inputSchema reused VERBATIM from the manifest's
 *     mcp_tool_definition (the generator computes nothing and restates no
 *     computed value; the emitted name equals the node's mcp_name, so page,
 *     manifest and worker agree on one name per tool);
 *   - required-input validation with actionable errors (the type contract comes
 *     from the manifest's own schema — restating it is derivation, not invention);
 *   - annotations: { readOnlyHint: true } — truthful-hint posture (#1616):
 *     our tools are deterministic local compute with no UGC, so
 *     untrustedContentHint is stated n/a per tool in the block comment rather
 *     than emitted as a field; exposedTo is OMITTED entirely (no cross-origin
 *     exposure — decided posture, 2026-09-01); the comment notes the
 *     never-trust-client rule and why it is moot for zero-server tools;
 *   - execute() is async, maps params onto the page's own form element ids,
 *     awaits the manifest-declared execution.function_name and returns the
 *     page's result global (byte-for-byte delegate, shared experience: the
 *     human sees what the agent did); errors return structured text, never
 *     raw exceptions. Async is the canonical form so pages whose compute is
 *     genuinely asynchronous return the real result instead of null.
 *   - Everything inline/self-contained: no external script, no CDN — CONTRACT
 *     constraints bind generated output exactly like hand-authored pages.
 *
 * Guard rails (hard failures — the generator never guesses):
 *   G1 manifest shape: snake_case name, description >= 8 words, typed properties;
 *   G2 page mapping: every inputSchema property must match a form element id
 *      (`id="<prop>"`) on the page — a property with no element cannot be
 *      delegated and is refused;
 *   G3 the page declares `function <execution.function_name>` and sets a
 *      result global (_lastResult, else _lastArtifact);
 *   G4 OWNERSHIP: a page carrying a registerTool call outside this generator's
 *      markers is never touched (pilot pages and index.html are other rows');
 *   G5 the manifest's execution.entry must be the page being written;
 *   G6 SWEEP GATE: the tool's kernel must re-verify CLEARED live.
 *
 * Modes:
 *   node scripts/gen-webmcp-registrations.mjs                 (report only)
 *   node scripts/gen-webmcp-registrations.mjs --all --write   (regen tranche)
 *   node scripts/gen-webmcp-registrations.mjs --tool <id> --write
 *   node scripts/gen-webmcp-registrations.mjs --check         (CI/preflight)
 *   node scripts/gen-webmcp-registrations.mjs --selftest
 *
 * Exit: 0 clean; 1 on any --check drift or hard-guard failure.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadManifestIndex, loadMcpNameIndex, sweepKernel } from './check-schema-read-divergence.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

export const BEGIN = '<!-- WEBMCP:GEN-BEGIN ';
// A full HTML comment: a bare `-- WEBMCP:GEN-END -->` line is not a comment to
// the copy-hallmarks prose stripper, and its `--` bytes read as em-dash
// substitutes in reader-facing text (measured: 16-page preflight red).
export const END = '<!-- WEBMCP:GEN-END -->';

function beginLine(manifestPath) {
  return `<!-- WEBMCP:GEN-BEGIN manifest=${manifestPath} generator=scripts/gen-webmcp-registrations.mjs -->`;
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

function fail(msg) {
  console.error('GEN-ERROR: ' + msg);
  process.exit(1);
}

function loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot) {
  const root = repoRoot || REPO;
  const rec = manifestIndex.byTool.get(toolId)
    || (mcpNameByTool.get(toolId) ? manifestIndex.byMcp.get(mcpNameByTool.get(toolId)) : null)
    || null;
  if (!rec) return { error: `no manifests/*.manifest.json record pairs with tool_id '${toolId}' (generator emits only from manifest records)` };
  let m;
  try { m = JSON.parse(readFileSync(resolve(root, rec.file), 'utf8')); } catch (e) {
    return { error: `manifest ${rec.file} is not valid JSON: ${e.message}` };
  }
  return { file: rec.file, m };
}

// Root indirection so the selftest can run the same code against a fixture tree.
function readRepoFile(rel, repoRoot) {
  return readFileSync(resolve(repoRoot || REPO, rel), 'utf8');
}

/** G1: manifest shape. Returns an error string or null. */
export function checkManifestShape(m) {
  const def = m?.mcp_tool_definition;
  if (!def || typeof def.name !== 'string') return 'missing mcp_tool_definition.name';
  if (!/^[a-z][a-z0-9_]*$/.test(def.name)) return `mcp_tool_definition.name '${def.name}' is not snake_case`;
  const words = (def.description || '').trim().split(/\s+/).filter(Boolean).length;
  if (words < 8) return `mcp_tool_definition.description has ${words} words, need >= 8`;
  const props = def.inputSchema && def.inputSchema.properties ? def.inputSchema.properties : null;
  if (!props || typeof props !== 'object') return 'mcp_tool_definition.inputSchema.properties missing';
  for (const [k, v] of Object.entries(props)) {
    if (!v || typeof v.type !== 'string') return `inputSchema property '${k}' has no type`;
  }
  if (!m.execution || typeof m.execution.function_name !== 'string' || !m.execution.function_name) {
    return 'missing execution.function_name';
  }
  return null;
}

/** G1b: the manifest's two schema writers must agree — the sweep clears
 *  `input_schema`, emission uses `mcp_tool_definition.inputSchema`; emitting a
 *  schema the sweep did not clear is forbidden. Returns error string or null. */
export function checkManifestSchemaParity(m) {
  const a = m?.input_schema?.properties;
  const b = m?.mcp_tool_definition?.inputSchema?.properties;
  if (!a || !b) return 'manifest lacks input_schema or mcp_tool_definition.inputSchema — the sweep clears the former, emission needs the latter';
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.join(',') !== keysB.join(',')) {
    return `schema writers disagree on property sets: input_schema=[${keysA.join(',')}] vs mcp_tool_definition.inputSchema=[${keysB.join(',')}] — align them before emission`;
  }
  const reqA = (m.input_schema.required || []).slice().sort().join(',');
  const reqB = (m.mcp_tool_definition.inputSchema.required || []).slice().sort().join(',');
  if (reqA !== reqB) return `schema writers disagree on required: [${reqA}] vs [${reqB}]`;
  for (const k of keysA) {
    if (a[k].type !== b[k].type) return `schema writers disagree on type of '${k}': ${a[k].type} vs ${b[k].type}`;
  }
  return null;
}

/** G2/G3/G4: element-id mapping, compute function, result global, ownership. */
export function verifyPageMapping(manifest, pageSrc, pageLabel) {
  const def = manifest.mcp_tool_definition;
  const props = Object.keys(def.inputSchema.properties);
  const missing = props.filter((p) => !new RegExp(`id=["']${p}["']`).test(pageSrc));
  if (missing.length > 0) {
    return { error: `${pageLabel}: form-element mapping incomplete, inputSchema properties with no matching element id: ${missing.join(', ')}` };
  }
  const fn = manifest.execution.function_name;
  if (!new RegExp(`function\\s+${fn}\\s*\\(`).test(pageSrc)) {
    return { error: `${pageLabel}: no 'function ${fn}(' found — execution.function_name does not exist on the page` };
  }
  // G4: registerTool outside this generator's own marked region is another row's.
  const withoutOwn = stripMarkedRegions(pageSrc);
  if (/\.registerTool\s*\(/.test(withoutOwn)) {
    return { error: `${pageLabel}: already contains a registerTool call outside this generator's markers — owned by another row, never rewritten` };
  }
  if (/_lastResult\s*=/.test(pageSrc)) return { resGlobal: '_lastResult' };
  if (/_lastArtifact\s*=/.test(pageSrc)) return { resGlobal: '_lastArtifact' };
  return { error: `${pageLabel}: page sets no _lastResult/_lastArtifact global — the delegate return cannot be verified` };
}

function stripMarkedRegions(src) {
  let out = src;
  let b;
  while ((b = out.indexOf(BEGIN)) !== -1) {
    const e = out.indexOf(END, b);
    if (e === -1) break;
    out = out.slice(0, b) + out.slice(e + END.length);
  }
  return out;
}

// ── Emission ──────────────────────────────────────────────────────────────────

function jsStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function validationLine(prop, type) {
  const r = `JSON.stringify(params.${prop})`;
  switch (type) {
    case 'number': return `if (typeof params.${prop} !== 'number' || !Number.isFinite(params.${prop})) throw new Error('${jsStr(prop)} must be a finite number; received ' + ${r} + '.');`;
    case 'boolean': return `if (typeof params.${prop} !== 'boolean') throw new Error('${jsStr(prop)} must be a boolean; received ' + ${r} + '.');`;
    case 'string': return `if (typeof params.${prop} !== 'string') throw new Error('${jsStr(prop)} must be a string; received ' + ${r} + '.');`;
    case 'array': return `if (!Array.isArray(params.${prop})) throw new Error('${jsStr(prop)} must be an array; received ' + ${r} + '.');`;
    default: return `if (params.${prop} === null || typeof params.${prop} !== 'object' || Array.isArray(params.${prop})) throw new Error('${jsStr(prop)} must be a JSON object; received ' + ${r} + '.');`;
  }
}

function mappingLine(prop, type, optional) {
  let expr;
  if (type === 'boolean') expr = `document.getElementById('${jsStr(prop)}').checked = params.${prop} === true;`;
  else if (type === 'array' || type === 'object') expr = `document.getElementById('${jsStr(prop)}').value = JSON.stringify(params.${prop});`;
  else expr = `document.getElementById('${jsStr(prop)}').value = String(params.${prop});`;
  return optional ? `if (params.${prop} !== undefined) ${expr}` : expr;
}

/**
 * Builds the marker-delimited block for one tool page. Pure: same inputs, same
 * bytes (RESULT_GLOBAL is substituted by buildBlockForPage).
 */
export function buildBlock(manifest, manifestPath) {
  const def = manifest.mcp_tool_definition;
  const props = Object.entries(def.inputSchema.properties);
  const required = Array.isArray(def.inputSchema.required) ? def.inputSchema.required : [];
  const fn = manifest.execution.function_name;
  const lines = [];
  lines.push(beginLine(manifestPath));
  lines.push('<script>');
  lines.push('// WebMCP registration generated by scripts/gen-webmcp-registrations.mjs from');
  lines.push(`// ${manifestPath} (mcp_tool_definition reused verbatim; the generator computes`);
  lines.push('// nothing and restates no computed value). Feature-detected: absent API');
  lines.push('// registers nothing, so this page is byte-identical without the API.');
  lines.push("// Answer-class delegate to this page's existing compute; zero network I/O.");
  lines.push('// Trust annotations, truthful-hint posture: deterministic local compute, no');
  lines.push('// untrusted content, so untrustedContentHint is not applicable per tool (n/a);');
  lines.push('// exposedTo intentionally omitted: no cross-origin exposure. A browser agent');
  lines.push('// is untrusted input like any form submission; the never-trust-client rule is');
  lines.push('// honored by construction because the tool is zero-server and only returns');
  lines.push('// computed JSON derived from declared inputs.');
  lines.push('// Browser support (dated observation): WebMCP origin trial from Chrome 149');
  lines.push('// (May 2026) per developer.chrome.com/docs/ai/webmcp (retrieved 2026-09-01).');
  lines.push("const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);");
  lines.push('if (mc) {');
  lines.push('  mc.registerTool({');
  lines.push(`    name: '${jsStr(def.name)}',`);
  lines.push(`    description: '${jsStr(def.description)}',`);
  lines.push(`    inputSchema: ${JSON.stringify(def.inputSchema, null, 2).replace(/\n/g, '\n    ')},`);
  lines.push('    annotations: { readOnlyHint: true },');
  lines.push('    execute: async function(params) {');
  lines.push('      try {');
  for (const [name, spec] of props) {
    if (required.includes(name)) lines.push(`      ${validationLine(name, spec.type)}`);
  }
  for (const [name, spec] of props) {
    lines.push(`      ${mappingLine(name, spec.type, !required.includes(name))}`);
  }
  lines.push(`      await ${fn}();`);
  lines.push('      return RESULT_GLOBAL;');
  lines.push('      } catch (err) {');
  lines.push("        return { error: 'compute_failed', detail: String((err && err.message) || err) };");
  lines.push('      }');
  lines.push('    }');
  lines.push('  });');
  lines.push('}');
  lines.push('</script>');
  lines.push(END);
  return lines.join('\n');
}

/** buildBlock with the page's verified result global substituted in. */
export function buildBlockForPage(manifest, manifestPath, resGlobal) {
  return buildBlock(manifest, manifestPath).replace('return RESULT_GLOBAL;', `return ${resGlobal};`);
}

function regionOf(pageSrc) {
  const b = pageSrc.indexOf(BEGIN);
  if (b === -1) return null;
  const e = pageSrc.indexOf(END, b);
  if (e === -1) return null;
  return { start: b, end: e + END.length };
}

/** Idempotent write: replace the marked region, or insert before the final </body>. */
export function insertIntoPage(pageSrc, block) {
  const region = regionOf(pageSrc);
  if (region) {
    return pageSrc.slice(0, region.start) + block + pageSrc.slice(region.end);
  }
  if (!pageSrc.includes('</body>')) throw new Error('page has no </body> to insert before');
  return pageSrc.replace('</body>', block + '\n\n</body>');
}

// ── Candidate derivation (sweep gate live) ────────────────────────────────────

function listKernels(root) {
  const out = execFileSync('git', ['ls-files', 'chaingraph/kernels/*.kernel.mjs'], { cwd: root, env: gitEnv(), encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function listPages(root) {
  const out = execFileSync('git', ['ls-files', '*.html'], { cwd: root, env: gitEnv(), encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Full per-tool decision: why a tool is or is not emittable TODAY.
 * Returns { toolId, ok, reason, detail }.
 */
export function adjudicateTool(toolId, repoRoot, manifestIndex, mcpNameByTool) {
  const pageRel = `chaingraph/${toolId}.html`;
  const pageAbs = resolve(repoRoot, pageRel);
  if (!existsSync(pageAbs)) return { toolId, ok: false, reason: `${pageRel} absent — kernel-only tool, no page to carry an inline registration` };

  // G6 — sweep gate, live: only CLEARED schemas generate.
  const kernelFile = `chaingraph/kernels/${toolId}.kernel.mjs`;
  const rec = sweepKernel(repoRoot, kernelFile, manifestIndex, mcpNameByTool);
  if (rec.verdict !== 'CLEARED') {
    const t = rec.triage?.class ? ` [${rec.triage.class}]` : '';
    return { toolId, ok: false, reason: `schema-read sweep verdict ${rec.verdict}${t} — registration may not emit from an uncleared schema` };
  }

  const loaded = loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot);
  if (loaded.error) return { toolId, ok: false, reason: loaded.error };
  const shapeErr = checkManifestShape(loaded.m);
  if (shapeErr) return { toolId, ok: false, reason: `manifest ${loaded.file}: ${shapeErr}` };
  const parityErr = checkManifestSchemaParity(loaded.m);
  if (parityErr) return { toolId, ok: false, reason: `manifest ${loaded.file}: ${parityErr}` };

  // G5 — the manifest's declared entry must be this page.
  const entry = loaded.m.execution?.entry || '';
  if (entry && basename(entry) !== `${toolId}.html`) {
    return { toolId, ok: false, reason: `manifest ${loaded.file} execution.entry (${entry}) is not this page` };
  }

  const pageSrc = readFileSync(pageAbs, 'utf8');
  const mapped = verifyPageMapping(loaded.m, pageSrc, pageRel);
  if (mapped.error) return { toolId, ok: false, reason: mapped.error };

  return {
    toolId, ok: true,
    detail: { manifest: loaded.file, page: pageRel, resGlobal: mapped.resGlobal, name: loaded.m.mcp_tool_definition.name },
  };
}

/** Live sweep over every kernel; returns the CLEARED tool ids plus the indexes. */
export function deriveTargets(repoRoot) {
  const manifestIndex = loadManifestIndex(repoRoot);
  const mcpNameByTool = loadMcpNameIndex(repoRoot);
  const cleared = [];
  for (const kernelFile of listKernels(repoRoot)) {
    const rec = sweepKernel(repoRoot, kernelFile, manifestIndex, mcpNameByTool);
    if (rec.verdict === 'CLEARED') cleared.push(rec.tool_id);
  }
  cleared.sort();
  return { cleared, manifestIndex, mcpNameByTool };
}

// ── Modes ─────────────────────────────────────────────────────────────────────

function expectedBlock(toolId, manifestIndex, mcpNameByTool, repoRoot) {
  const loaded = loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot);
  if (loaded.error) throw new Error(loaded.error);
  const pageSrc = readRepoFile(`chaingraph/${toolId}.html`, repoRoot);
  const mapped = verifyPageMapping(loaded.m, pageSrc, toolId);
  if (mapped.error) throw new Error(mapped.error);
  return buildBlockForPage(loaded.m, loaded.file, mapped.resGlobal);
}

function runCheck() {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const emittable = [];
  const excluded = [];
  for (const id of cleared) {
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (d.ok) emittable.push({ ...d.detail, toolId: id }); else excluded.push({ id, reason: d.reason });
  }

  const problems = [];
  // 1. Every emittable page carries a byte-exact generated region.
  for (const d of emittable) {
    const pageSrc = readRepoFile(d.page, REPO);
    const region = regionOf(pageSrc);
    if (!region) {
      problems.push(`${d.page}: no generated WebMCP registration region (coverage regression — expected for tool '${d.name}')`);
      continue;
    }
    let expected;
    try { expected = expectedBlock(d.toolId, manifestIndex, mcpNameByTool, REPO); } catch (e) {
      problems.push(`${d.page}: expected block could not be rebuilt: ${e.message}`);
      continue;
    }
    const actual = pageSrc.slice(region.start, region.end);
    if (actual !== expected) {
      problems.push(`${d.page}: generated region drifted from ${d.manifest} — hand-edits to generated blocks are red; run node scripts/gen-webmcp-registrations.mjs --all --write`);
      continue;
    }
    // Byte-exact implies parseable today; keep a parse proof so a future emitter
    // bug (or an exact-match escape) is a distinct, diagnosable red.
    const scriptBody = actual.slice(actual.indexOf('<script>') + 8, actual.lastIndexOf('</script>'));
    try { new Function(scriptBody); } catch (e) {
      problems.push(`${d.page}: generated region does not parse as JavaScript: ${e.message}`);
    }
  }
  // 2. Every generated region on disk still corresponds to an emittable tool.
  const emittablePages = new Set(emittable.map((d) => d.page));
  for (const p of listPages(REPO)) {
    let pageSrc;
    try { pageSrc = readRepoFile(p, REPO); } catch { continue; }
    if (!pageSrc.includes(BEGIN)) continue;
    if (!emittablePages.has(p)) {
      problems.push(`${p}: carries a generated WebMCP region but is not in today's emittable set (schema or mapping changed) — regenerate or remove the region`);
    }
  }

  if (problems.length) {
    console.error(`✗ webmcp-registration freshness FAILED (${problems.length}):`);
    problems.forEach((p) => console.error('    ' + p));
    process.exit(1);
  }
  console.log(`✓ webmcp-registration freshness clean — ${emittable.length} generated registration(s) byte-exact vs their manifests; ${excluded.length} sweep-cleared tool(s) excluded with reasons (shrinks as fix rows land).`);
  excluded.forEach((e) => console.log(`  EXCLUDED ${e.id}: ${e.reason}`));
}

function runReportOrWrite(write, onlyTool) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  let emitted = 0;
  let exact = 0;
  const exclusions = [];
  const targets = onlyTool && !cleared.includes(onlyTool)
    ? [onlyTool] // --tool probes ANY tool id, even one the sweep did not clear — the refusal reason is the answer
    : cleared;
  for (const id of targets) {
    if (onlyTool && id !== onlyTool) continue;
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (!d.ok) { exclusions.push({ id, reason: d.reason }); continue; }
    const block = expectedBlock(id, manifestIndex, mcpNameByTool, REPO);
    const pageAbs = resolve(REPO, d.detail.page);
    if (write) {
      const pageSrc = readFileSync(pageAbs, 'utf8');
      const next = insertIntoPage(pageSrc, block);
      if (next !== pageSrc) { writeFileSync(pageAbs, next, 'utf8'); emitted++; console.log(`✓ emitted WebMCP registration into ${d.detail.page} (name: ${d.detail.name})`); }
      else { exact++; }
    } else {
      emitted++;
      console.log(`WOULD EMIT ${d.detail.page} (name: ${d.detail.name}, manifest: ${d.detail.manifest}, result: ${d.detail.resGlobal})`);
    }
  }
  if (write) console.log(`\n${emitted} page(s) written, ${exact} already byte-exact; ${exclusions.length} excluded with per-tool reasons:`);
  else console.log(`\n${emitted} emittable page(s); ${exclusions.length} excluded with per-tool reasons:`);
  exclusions.forEach((e) => console.log(`  EXCLUDED ${e.id}: ${e.reason}`));
}

// ── Selftest (synthetic fixture repo; the real tree is never written) ─────────

function selftest() {
  let failures = 0;
  const check = (label, ok) => {
    console.log((ok ? '  ✓ ' : '  ✗ ') + label);
    if (!ok) failures++;
  };
  const tmp = mkdtempSync(join(tmpdir(), 'gwmr-'));
  try {
    const manifestsDir = join(tmp, 'manifests');
    const kernelsDir = join(tmp, 'chaingraph', 'kernels');
    mkdirSync(manifestsDir, { recursive: true });
    mkdirSync(kernelsDir, { recursive: true });

    const schema = {
      type: 'object',
      required: ['principal', 'label'],
      properties: {
        principal: { type: 'number', description: 'Principal amount' },
        label: { type: 'string', description: 'Display label' },
        flag: { type: 'boolean', description: 'Optional toggle' },
        rows: { type: 'array', description: 'Optional rows' }
      }
    };
    const manifest = {
      tool_id: 'fx-100-selftest',
      input_schema: { properties: schema.properties, required: schema.required },
      mcp_tool_definition: {
        name: 'run_fx_100_selftest',
        description: 'Selftest fixture tool that exercises the registration generator end to end.',
        inputSchema: schema
      },
      execution: { type: 'browser-javascript', entry: 'chaingraph/fx-100-selftest.html', function_name: 'run', timeout_ms: 3000 }
    };
    writeFileSync(join(manifestsDir, '950-fx-100-selftest.manifest.json'), JSON.stringify(manifest, null, 2));
    // CLEARED kernel: compute reads exactly the declared fields.
    writeFileSync(join(kernelsDir, 'fx-100-selftest.kernel.mjs'), [
      "export const meta = { mcp_name: 'run_fx_100_selftest' };",
      'export function compute(pp) {',
      '  const principal = pp.principal; const label = pp.label;',
      '  const flag = pp.flag; const rows = pp.rows;',
      '  return { output_payload: { principal, label, flag, count: (rows || []).length }, compliance_flags: {} };',
      '}'
    ].join('\n'));
    const pageBody = [
      '<html><body>',
      '<input id="principal"><input id="label"><input id="flag"><input id="rows">',
      '<script>',
      'var _lastArtifact = null;',
      'async function run(){ _lastArtifact = { ok: true }; }',
      '</script>',
      '</body></html>'
    ].join('\n');
    writeFileSync(join(tmp, 'chaingraph', 'fx-100-selftest.html'), pageBody);

    const manifestIndex = loadManifestIndex(tmp);
    const mcpNameByTool = loadMcpNameIndex(tmp);

    // 1. Sweep gate: the fixture kernel re-verifies CLEARED live.
    const rec = sweepKernel(tmp, 'chaingraph/kernels/fx-100-selftest.kernel.mjs', manifestIndex, mcpNameByTool);
    check('sweep gate: fixture kernel is CLEARED live', rec.verdict === 'CLEARED');

    // 2. Full adjudication passes and reports the emit inputs.
    const d = adjudicateTool('fx-100-selftest', tmp, manifestIndex, mcpNameByTool);
    check('adjudication emits the fixture tool', d.ok === true);
    check('adjudication picks _lastArtifact as the result global', d.ok && d.detail.resGlobal === '_lastArtifact');

    // 3. Emitted block: verbatim name/schema, async delegate, truthful annotations.
    const block = buildBlockForPage(manifest, 'manifests/950-fx-100-selftest.manifest.json', d.detail.resGlobal);
    check('name emitted verbatim from mcp_tool_definition', block.includes("name: 'run_fx_100_selftest'"));
    check('inputSchema emitted verbatim', block.includes(JSON.stringify(schema, null, 2).replace(/\n/g, '\n    ')));
    check('execute is async and awaits the manifest function', block.includes('execute: async function(params)') && block.includes('await run();'));
    check('returns the page result global', block.includes('return _lastArtifact;'));
    check('annotations carry only readOnlyHint:true', block.includes('annotations: { readOnlyHint: true },') && !block.includes('untrustedContentHint:'));
    check('untrustedContentHint stated n/a in the comment', block.includes('untrustedContentHint is not applicable'));
    check('exposedTo omitted entirely', !block.includes('exposedTo:'));
    check('required-input validation emitted (principal)', block.includes("if (typeof params.principal !== 'number'"));
    check('optional mapping guarded, required unguarded', block.includes("if (params.flag !== undefined) document.getElementById('flag').checked") && block.includes("document.getElementById('principal').value = String(params.principal);"));
    check('feature-detect gates the registration', block.indexOf('document.modelContext') !== -1 && block.indexOf('registerTool') > block.indexOf('modelContext'));
    check('markers delimit the block', block.startsWith(beginLine('manifests/950-fx-100-selftest.manifest.json')) && block.endsWith(END));

    // 4. Insert is idempotent.
    const once = insertIntoPage(pageBody, block);
    const twice = insertIntoPage(once, block);
    check('insert is idempotent (second write replaces, not appends)', once !== pageBody && once === twice);

    // 5. Mutation control: a hand-edit to the emitted block is detectable.
    const mutated = once.replace("name: 'run_fx_100_selftest'", "name: 'hand_renamed_tool'");
    check('hand-edit mutation changes the region (detectable)', mutated !== once);
    check('stripMarkedRegions removes the whole region for G4', !/\.registerTool\s*\(/.test(stripMarkedRegions(once)));

    // 6. G2 refusal: a page missing one element id is refused, with the id named.
    const badPage = pageBody.replace('<input id="rows">', '');
    const refused = verifyPageMapping(manifest, badPage, 'fixture page');
    check('G2 refusal names the missing id (rows)', !!(refused.error && refused.error.includes('rows')));

    // 7. G3 refusal: no result global -> refused.
    const noRes = pageBody
      .replace('var _lastArtifact = null;', 'var _other = null;')
      .replace('_lastArtifact = { ok: true };', '_other = { ok: true };');
    const refusedRes = verifyPageMapping(manifest, noRes, 'fixture page');
    check('G3 refusal: missing result global refused', !!(refusedRes && refusedRes.error));

    // 8. G4 refusal: a page already carrying an unmarked registerTool is never touched.
    const owned = pageBody.replace('</body>', '<script>mc.registerTool({ name: "x" });</script></body>');
    const refusedOwned = verifyPageMapping(manifest, owned, 'fixture page');
    check('G4 refusal: existing unmarked registration refused', !!(refusedOwned && refusedOwned.error && refusedOwned.error.includes('owned by another row')));

    // 9. G1 refusal: manifest description too short.
    const thin = JSON.parse(JSON.stringify(manifest));
    thin.mcp_tool_definition.description = 'too short';
    const thinErr = checkManifestShape(thin);
    check('G1 refusal: short description refused', thinErr !== null);

    // 9b. G1b refusal: the two schema writers disagree -> not emittable.
    const drifted = JSON.parse(JSON.stringify(manifest));
    drifted.input_schema.properties.extra_field = { type: 'string' };
    const parityErr = checkManifestSchemaParity(drifted);
    check('G1b refusal: input_schema vs mcp_tool_definition drift refused', parityErr !== null && parityErr.includes('property sets'));

    // 10. Sweep gate refusal: a kernel reading an undeclared field is not emittable.
    writeFileSync(join(kernelsDir, 'fx-101-drifted.kernel.mjs'), [
      'export function compute(pp) {',
      '  return { output_payload: { surprise: pp.undeclared_field }, compliance_flags: {} };',
      '}'
    ].join('\n'));
    const rec2 = sweepKernel(tmp, 'chaingraph/kernels/fx-101-drifted.kernel.mjs', manifestIndex, mcpNameByTool);
    check('sweep gate: drifted kernel is NOT CLEARED (never emitted)', rec2.verdict !== 'CLEARED');

    // 11. Entry guard: manifest entry pointing elsewhere is refused (G5).
    const d5 = (() => {
      const alt = JSON.parse(JSON.stringify(manifest));
      alt.execution.entry = 'chaingraph/kernels/fx-102-entry.kernel.mjs';
      writeFileSync(join(manifestsDir, '951-fx-102-entry.manifest.json'), JSON.stringify({ ...alt, tool_id: 'fx-102-entry' }, null, 2));
      // Same cleared read shape as fx-100 so the flow reaches G5, not G6.
      writeFileSync(join(kernelsDir, 'fx-102-entry.kernel.mjs'), readFileSync(join(kernelsDir, 'fx-100-selftest.kernel.mjs')));
      writeFileSync(join(tmp, 'chaingraph', 'fx-102-entry.html'), pageBody.replace(/fx-100-selftest/g, 'fx-102-entry'));
      // The manifest index was loaded before this fixture file existed — reload.
      const idx2 = loadManifestIndex(tmp);
      return adjudicateTool('fx-102-entry', tmp, idx2, mcpNameByTool);
    })();
    check('G5 refusal: execution.entry not this page', !d5.ok && d5.reason.includes('execution.entry'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures === 0 ? 'GEN-WEBMCP-REGISTRATIONS SELFTEST: PASS' : 'GEN-WEBMCP-REGISTRATIONS SELFTEST: FAIL');
  process.exit(failures === 0 ? 0 : 1);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selftest();
} else if (args.includes('--check')) {
  runCheck();
} else {
  const write = args.includes('--write');
  const all = args.includes('--all');
  const tIdx = args.indexOf('--tool');
  const onlyTool = tIdx !== -1 ? args[tIdx + 1] : null;
  runReportOrWrite(write, onlyTool);
}
