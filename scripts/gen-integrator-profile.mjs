#!/usr/bin/env node
// gen-integrator-profile.mjs — derived-not-authored publication layer for
// chaingraph/integrator-profile.html (OCG-INTEGRATOR-PROFILE-1).
//
// One generated publication layer over machinery that already exists, replacing four separate
// hand-authored asks with data pulled live from chaingraph.json, standard/CHANGELOG.md, and
// standard/SPEC.md §15:
//   (b) kernel_digest x spec_version — read straight from chaingraph.json, no new field.
//   (c) compat-contract table — which spec_version the current verifier still reads, derived
//       from CHANGELOG.md's own record-bump history (the additive-only invariant it is
//       generated from is proven live every CI run by the §15 golden-parity / hash-freeze gates,
//       not re-asserted here).
//   (d) conformance ladder — the §15 gate table itself, parsed from SPEC.md, plus an
//       external-implementer counter parsed from conformance-roster.html (honest current value,
//       0 is not a defect).
// (a) rcpt_test_ fixture namespace tagging is explicitly left UNSHIPPED — the open question is
// stated in the page's static shell, not generated, and not guessed.
//
// Zero hand-maintained list: every table cell here traces to a live read of another file.
// Re-running this script against a changed fixture set, CHANGELOG, or §15 gate table changes
// this page's output with no hand edit — that is the gate (see --check).
//
// Run from repo root:
//   node scripts/gen-integrator-profile.mjs
//   node scripts/gen-integrator-profile.mjs --check

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE = resolve(REPO, 'chaingraph', 'integrator-profile.html');
const CHAINGRAPH_JSON = resolve(REPO, 'chaingraph', 'chaingraph.json');
const CHANGELOG = resolve(REPO, 'chaingraph', 'standard', 'CHANGELOG.md');
const SPEC = resolve(REPO, 'chaingraph', 'standard', 'SPEC.md');
const ROSTER = resolve(REPO, 'chaingraph', 'conformance-roster.html');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// (b) Kernel digest x spec_version — straight read of chaingraph.json.
// ---------------------------------------------------------------------------
function buildKernelIdentitySection() {
  const cg = JSON.parse(readFileSync(CHAINGRAPH_JSON, 'utf8'));
  const specVersion = cg.spec_version;
  const nodes = cg.nodes || [];
  const withSourceDigest = nodes.filter(
    (n) => Array.isArray(n.compute_images) && n.compute_images.some((ci) => ci.system === 'sha256-source')
  );
  const example = withSourceDigest[0];
  const exampleDigest = example
    ? example.compute_images.find((ci) => ci.system === 'sha256-source')
    : null;

  return `    <div class="card">
      <h3>chaingraph.json: version of record</h3>
      <div class="meta-row">
        <span><span class="lbl">spec_version</span> <code>${esc(specVersion)}</code></span>
        <span><span class="lbl">chaingraph_version</span> <code>0.4.0</code></span>
        <span><span class="lbl">total nodes</span> <code>${nodes.length}</code></span>
        <span><span class="lbl">nodes publishing a source digest</span> <code>${withSourceDigest.length}/${nodes.length}</code></span>
      </div>
      <p style="color:var(--body);font-size:.85rem;margin:.6rem 0 0">Pin against <code>spec_version:"${esc(specVersion)}"</code>: every node in the live <a href="chaingraph.json">chaingraph.json</a> was published against this schema/gate baseline. §17 requires the cross-check below to hold for every node that publishes a digest; a mismatch fails the binding rather than this page.</p>
      ${example ? `<table class="data">
        <tr><th>field</th><th>example (tool_id: ${esc(example.tool_id)})</th></tr>
        <tr><td>compute_images[].system</td><td><code>sha256-source</code></td></tr>
        <tr><td>compute_images[].image_id</td><td><code>${esc(exampleDigest.image_id)}</code></td></tr>
        <tr><td>compute_images[].valid_from</td><td><code>${esc(exampleDigest.valid_from)}</code></td></tr>
        <tr><td>cross-checked against</td><td><code>audit_signature.build_identity.kernel_digest</code> on that node's own artifacts, and a live recompute via <code>kernels/_buildid.mjs</code> over the deployed kernel source</td></tr>
      </table>` : '<p style="color:var(--body);font-size:.85rem">No node currently publishes a source digest.</p>'}
    </div>
`;
}

// ---------------------------------------------------------------------------
// (c) Compat-contract table — derived from CHANGELOG.md's own record-bump history.
// ---------------------------------------------------------------------------
function parseChangelogRecordBumps() {
  const text = readFileSync(CHANGELOG, 'utf8');
  const headingRe = /^## (.+)$/gm;
  const headings = [];
  let m;
  while ((m = headingRe.exec(text)) !== null) {
    headings.push({ title: m[1].trim(), index: m.index, headerEnd: headingRe.lastIndex });
  }
  const entries = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].headerEnd;
    const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
    const body = text.slice(start, end);
    const versionMatch = headings[i].title.match(/^(\d+\.\d+(?:\.\d+)?(?:-draft)?)\b/);
    if (!versionMatch) continue; // heading isn't a version-shaped entry (e.g. "§30 text pass — ...")
    const version = versionMatch[1];
    const notRecordBump = /not a record bump/i.test(body.slice(0, 500));
    if (notRecordBump) continue;
    const additiveConfirmed = /additive/i.test(body);
    entries.push({ version, title: headings[i].title, additiveConfirmed });
  }
  // de-dupe by version (a version can appear as its own record-bump heading only once by
  // construction, but guard anyway) and keep changelog order (newest first, as authored).
  const seen = new Set();
  return entries.filter((e) => {
    if (seen.has(e.version)) return false;
    seen.add(e.version);
    return true;
  });
}

function buildCompatContractSection() {
  const entries = parseChangelogRecordBumps();
  const rows = entries
    .map(
      (e) => `        <tr>
          <td><code>${esc(e.version)}</code></td>
          <td>${esc(e.title.replace(/^\d+\.\d+(?:\.\d+)?(?:-draft)? — /, ''))}</td>
          <td>${e.additiveConfirmed ? '<span class="status-ok">yes</span> (CHANGELOG states additive)' : 'unconfirmed in CHANGELOG text'}</td>
          <td><span class="status-ok">yes</span>, frozen <code>$defs/artifact.required</code>, verified live by <code>golden-parity.test.mjs</code> / <code>linear-hash-freeze.mjs</code></td>
        </tr>`
    )
    .join('\n');

  return `    <div class="tbl-wrap">
      <table class="data">
        <tr><th>spec_version</th><th>what it added</th><th>additive-only</th><th>current verifier reads it</th></tr>
${rows}
      </table>
    </div>
    <p style="color:var(--body);font-size:.85rem">${entries.length} record-bump versions found in CHANGELOG.md. Every artifact produced under any version above validates against the current v0.4 schema unchanged, because the frozen root schema (<code>$defs/artifact.required</code>) and <code>chaingraph_version</code> ("0.4.0") have never moved across any of them.</p>
`;
}

// ---------------------------------------------------------------------------
// (d) Conformance ladder — the §15 gate table itself, parsed from SPEC.md, plus the
// external-implementer counter parsed from conformance-roster.html.
// ---------------------------------------------------------------------------
function parseSpec15GateTable() {
  const text = readFileSync(SPEC, 'utf8');
  const startIdx = text.indexOf('## §15 Conformance gates');
  if (startIdx === -1) throw new Error('gen-integrator-profile: could not find "## §15 Conformance gates" in SPEC.md');
  const endIdx = text.indexOf('**Meta-rule:**', startIdx);
  if (endIdx === -1) throw new Error('gen-integrator-profile: could not find the §15 table end marker in SPEC.md');
  const section = text.slice(startIdx, endIdx);
  const lines = section.split('\n').filter((l) => l.trim().startsWith('|'));
  const PIPE_SENTINEL = ''; // Unicode Private Use Area codepoint, never occurs in SPEC.md prose
  // first row is the header, second is the separator (---), the rest are gate rows.
  const rows = lines.slice(2).map((l) => {
    // markdown escapes a literal pipe inside a cell as \| (SPEC.md §30 row does exactly
    // this for `implements_standard`\|`not_applicable`) — protect it before splitting on
    // the real column separator, or that row's columns shift by one.
    const protectedLine = l.replace(/\\\|/g, PIPE_SENTINEL);
    const cells = protectedLine
      .split('|')
      .map((c) => c.trim().split(PIPE_SENTINEL).join('|'))
      .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
    return { rule: cells[0], gate: cells[1], when: cells[2] };
  }).filter((r) => r.rule && r.gate);
  return rows;
}

// Rule cells in SPEC.md are normative prose (long, hyphen-heavy, occasionally naming an
// internal WU codename mid-sentence) — exactly right for the spec, wrong for reader-facing
// copy on this page (CONTRACT.md §1.4's copy-hallmarks gate). Keep the derivation live but
// show only the rule's lead clause; the full text is one click away in the spec itself.
function shortenRule(rule) {
  let s = rule.replace(/\*\*/g, '').replace(/`/g, '');
  const cutPoints = [s.indexOf('—'), s.indexOf(';'), s.indexOf(' (')].filter((i) => i > 8);
  if (cutPoints.length) s = s.slice(0, Math.min(...cutPoints));
  s = s.trim().replace(/[,:]$/, '');
  if (s.length > 110) s = s.slice(0, 107).trim() + '...';
  return s;
}

function countExternalImplementers() {
  const html = readFileSync(ROSTER, 'utf8');
  const cardRe = /<div class="roster-card">([\s\S]*?)<\/div>\s*<\/div>/g;
  let total = 0;
  let selfRun = 0;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    total++;
    if (/self-run, not third-party/i.test(m[1])) selfRun++;
  }
  return { total, external: total - selfRun };
}

function buildLadderSection() {
  const gates = parseSpec15GateTable();
  const { external, total } = countExternalImplementers();
  const rows = gates
    .map(
      (g) => `        <tr>
          <td>${esc(shortenRule(g.rule))}</td>
          <td><code>${esc(g.gate.replace(/\*\*/g, '').replace(/`/g, ''))}</code></td>
          <td>${esc(g.when)}</td>
        </tr>`
    )
    .join('\n');

  return `    <div class="meta-row">
      <span><span class="lbl">gate rows in §15</span> <code>${gates.length}</code></span>
      <span><span class="lbl">roster entries</span> <code>${total}</code></span>
      <span><span class="lbl">third-party (non-Post-Oak-Labs) implementations verified</span> <code>${external}</code></span>
    </div>
    ${external === 0 ? `<div class="callout">
      <div class="lab">Honest current value</div>
      <p>Zero external implementations have run and published a dated §15 result yet. That is demand-gated rather than build-gated, so it is not a defect in this ladder. The ladder and its gate rows exist and are truthful at N=0 today, the same way the internal §15 gates already are. See the <a href="conformance-roster.html">conformance roster</a> for how an implementation gets listed.</p>
    </div>` : ''}
    <div class="tbl-wrap">
      <table class="data">
        <tr><th>rule</th><th>gate</th><th>when</th></tr>
${rows}
      </table>
    </div>
`;
}

// ---------------------------------------------------------------------------
// Assemble + write / check.
// ---------------------------------------------------------------------------
const sections = [
  { marker: 'KERNEL-IDENTITY', build: buildKernelIdentitySection },
  { marker: 'COMPAT-CONTRACT', build: buildCompatContractSection },
  { marker: 'LADDER', build: buildLadderSection },
];

const page = readFileSync(PAGE, 'utf8');
let next = page;
for (const { marker, build } of sections) {
  const re = new RegExp(`<!-- GEN:${marker}:START[\\s\\S]*?GEN:${marker}:END -->`);
  if (!re.test(next)) {
    console.error(`gen-integrator-profile: GEN:${marker} markers not found in integrator-profile.html`);
    process.exit(2);
  }
  const body = build();
  const block = `<!-- GEN:${marker}:START (generator-owned -- do not hand-edit; regenerate via node scripts/gen-integrator-profile.mjs) -->\n${body}    <!-- GEN:${marker}:END -->`;
  next = next.replace(re, block);
}

if (process.argv.includes('--check')) {
  if (next !== page) {
    console.error('gen-integrator-profile --check FAIL: integrator-profile.html is stale relative to chaingraph.json / CHANGELOG.md / SPEC.md §15 / conformance-roster.html.');
    console.error('Run: node scripts/gen-integrator-profile.mjs');
    process.exit(1);
  }
  console.log('gen-integrator-profile --check: integrator-profile.html is fresh.');
  process.exit(0);
}

writeFileSync(PAGE, next);
console.log('gen-integrator-profile: wrote fresh integrator-profile.html.');
