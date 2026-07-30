#!/usr/bin/env node
/**
 * check-helm-techdoc-parity.mjs — SSOT gate: the rendered Helm technical
 * design page may not drift from the markdown it renders.
 *
 * The normative document lives in the helm repository, beside the code it
 * describes (helm's own CI gates it against drift in that code). A pinned copy
 * is vendored here under helm/technical-design/ so this page can be rendered
 * and checked locally, deterministically, with no build step and no network
 * fetch at page load. A page that only renders while a fetch of another host
 * succeeds is not a page that survives an absent maintainer.
 *
 * Modelled on chaingraph/standard/spec-page-parity.mjs, and it checks the same
 * class of thing: STRUCTURE, not prose. Content-identity is deliberately not
 * checked here; the vendored bytes are pinned by digest instead (check 1).
 *
 *   1. The vendored markdown matches the sha256 recorded in its MANIFEST.json,
 *      and the page's pinned-sha meta matches the manifest's pinnedSha.
 *   2. Every `## N.` heading in the markdown has exactly one page section
 *      labelled "Section N" and exactly one TOC entry tagged N.
 *   3. The page may not display a section number the markdown does not define
 *      (no invented sections).
 *   4. Every TOC link resolves to a real section id, and the number shown in
 *      the TOC matches the number in the target section's eyebrow.
 *   5. No orphan sections (every section id is reachable from the TOC).
 *   6. Every `###` subheading in the markdown appears as an <h3> on the page,
 *      and the page shows no <h3> the markdown does not define.
 *
 * Behind-upstream is a WARNING, never a failure — see checkBehindUpstream().
 *
 * Zero-dependency, node: builtins only. Exit 1 on failure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const VENDOR_DIR = resolve(REPO, 'helm', 'technical-design');
const MANIFEST_PATH = resolve(VENDOR_DIR, 'MANIFEST.json');
const PAGE_PATH = resolve(REPO, 'helm-technical-design.html');

// The TOC lives inside a .section wrapper for layout reasons; it is chrome,
// not a rendered document section, so it is exempt from the orphan check.
const NON_DOC_SECTION_IDS = new Set(['contents']);

const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const normalize = (s) =>
  stripTags(s)
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

export function collectIssues(markdown, page, manifest, vendoredBytes) {
  const errors = [];

  // 1. Vendored bytes and pin.
  const entry = (manifest.files || []).find((f) => f.path === manifest.sourcePath.split('/').pop());
  if (!entry) {
    errors.push(`MANIFEST.json lists no entry for ${manifest.sourcePath} — the vendored copy is unpinned.`);
  } else {
    const actual = createHash('sha256').update(vendoredBytes).digest('hex');
    if (actual !== entry.sha256) {
      errors.push(`vendored ${entry.path} does not match MANIFEST.json (manifest ${entry.sha256.slice(0, 12)}…, on disk ${actual.slice(0, 12)}…) — re-vendor, do not edit the vendored copy in place.`);
    }
  }
  const pinMeta = page.match(/<meta name="helm-techdoc-pinned-sha" content="([^"]*)"/);
  if (!pinMeta) {
    errors.push('page carries no helm-techdoc-pinned-sha meta — a reader cannot tell which upstream commit this renders.');
  } else if (pinMeta[1] !== manifest.pinnedSha) {
    errors.push(`page pinned-sha meta (${pinMeta[1]}) does not match MANIFEST.json pinnedSha (${manifest.pinnedSha}).`);
  }

  // 2-5. Section structure.
  const canonical = new Map(); // number -> title
  for (const m of markdown.matchAll(/^## (\d+)\.\s+(.*)$/gm)) canonical.set(Number(m[1]), m[2].trim());

  const sections = []; // { id, sec }
  const starts = [];
  for (const m of page.matchAll(/<div class="section"[^>]*\bid="([^"]+)"[^>]*>/g)) starts.push({ id: m[1], idx: m.index });
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].idx : page.length;
    const chunk = page.slice(starts[i].idx, end);
    const eyebrow = chunk.match(/<div class="sec-num">\s*Section (\d+)\s*<\/div>/);
    sections.push({ id: starts[i].id, sec: eyebrow ? Number(eyebrow[1]) : null });
  }

  const toc = [];
  for (const m of page.matchAll(/<li><a href="#([^"]+)"><span class="toc-sec">(\d+)<\/span>/g)) {
    toc.push({ target: m[1], sec: Number(m[2]) });
  }

  const pageSecs = sections.filter((s) => s.sec !== null).map((s) => s.sec);
  const tocSecs = toc.map((t) => t.sec);
  for (const n of [...canonical.keys()].sort((a, b) => a - b)) {
    const inPage = pageSecs.filter((x) => x === n).length;
    const inToc = tocSecs.filter((x) => x === n).length;
    if (inPage !== 1) errors.push(`the markdown defines section ${n} ("${canonical.get(n)}") but the page has ${inPage} section(s) labelled Section ${n} (want exactly 1)`);
    if (inToc !== 1) errors.push(`the markdown defines section ${n} ("${canonical.get(n)}") but the TOC has ${inToc} entr(ies) tagged ${n} (want exactly 1)`);
  }

  for (const s of sections) {
    if (s.sec !== null && !canonical.has(s.sec)) errors.push(`page section id="${s.id}" is labelled Section ${s.sec}, which the markdown does not define`);
  }
  for (const t of toc) {
    if (!canonical.has(t.sec)) errors.push(`TOC entry #${t.target} is tagged ${t.sec}, which the markdown does not define`);
  }

  const byId = new Map(sections.map((s) => [s.id, s]));
  for (const t of toc) {
    const s = byId.get(t.target);
    if (!s) { errors.push(`TOC links #${t.target} but no section with that id exists`); continue; }
    if (s.sec !== t.sec) errors.push(`TOC tags #${t.target} as ${t.sec} but that section's eyebrow says ${s.sec === null ? 'unnumbered' : s.sec}`);
  }

  const tocTargets = new Set(toc.map((t) => t.target));
  for (const s of sections) {
    if (NON_DOC_SECTION_IDS.has(s.id)) continue;
    if (!tocTargets.has(s.id)) errors.push(`section id="${s.id}" has no TOC entry (orphan section)`);
  }

  // 6. Subheading parity.
  const mdSubs = [...markdown.matchAll(/^### (.*)$/gm)].map((m) => normalize(m[1]));
  const pageSubs = [...page.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map((m) => normalize(m[1]));
  const pageSubSet = new Set(pageSubs);
  const mdSubSet = new Set(mdSubs);
  for (const h of mdSubs) if (!pageSubSet.has(h)) errors.push(`the markdown has subheading "${h}" but the page does not render it`);
  for (const h of pageSubs) if (!mdSubSet.has(h)) errors.push(`the page shows subheading "${h}", which the markdown does not define`);

  return errors;
}

/**
 * Behind-upstream is a WARNING, deliberately, and this choice is load-bearing.
 *
 * A hard failure here would couple every site deploy to the helm repository's
 * merge queue: this repo deploys on every push to main, so an unrelated helm
 * commit that touches the doc would redden and block a site deploy that has
 * nothing to do with Helm. That is a real footgun and the wrong trade for a
 * rendering. The guarantee that actually matters is that the page matches the
 * bytes it claims to render, and that is checks 1-6 above, which are local,
 * deterministic, and hard failures.
 *
 * The staleness that matters (the doc's claims no longer matching helmd's
 * code) is caught in the helm repository by its own citation gate, at the
 * moment the code moves, which is where a human can act on it. Re-vendoring
 * here is a follow-up, not an emergency.
 *
 * It is also network-dependent, so it must never be able to fail a build.
 */
function checkBehindUpstream(manifest) {
  let out;
  try {
    out = execFileSync('git', ['ls-remote', manifest.sourceRepo, `refs/heads/${manifest.sourceBranch}`], {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
    }).toString().trim();
  } catch {
    console.log('helm-techdoc-parity: upstream check skipped (no network access to the helm repository).');
    return;
  }
  const head = out.split(/\s+/)[0];
  if (!head) {
    console.log('helm-techdoc-parity: upstream check skipped (could not read the helm repository head).');
    return;
  }
  if (head !== manifest.pinnedSha) {
    console.log(`helm-techdoc-parity: WARNING (not a failure) — the vendored copy is pinned at ${manifest.pinnedSha.slice(0, 12)} but ${manifest.sourceBranch} is now ${head.slice(0, 12)}.`);
    console.log('  If the technical design doc itself changed upstream, re-vendor it and re-render the page. If only code changed, nothing is owed here.');
  } else {
    console.log(`helm-techdoc-parity: vendored copy is level with ${manifest.sourceRepo}@${manifest.sourceBranch}.`);
  }
}

function main() {
  for (const [label, path] of [['MANIFEST.json', MANIFEST_PATH], ['page', PAGE_PATH]]) {
    if (!existsSync(path)) {
      console.error(`helm-techdoc-parity: missing ${label} at ${path}`);
      process.exit(1);
    }
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const vendoredPath = resolve(VENDOR_DIR, manifest.sourcePath.split('/').pop());
  if (!existsSync(vendoredPath)) {
    console.error(`helm-techdoc-parity: MANIFEST.json points at ${manifest.sourcePath} but no vendored copy exists at ${vendoredPath}`);
    process.exit(1);
  }
  const vendoredBytes = readFileSync(vendoredPath);
  const markdown = vendoredBytes.toString('utf8');
  const page = readFileSync(PAGE_PATH, 'utf8');

  const errors = collectIssues(markdown, page, manifest, vendoredBytes);

  if (errors.length) {
    console.error(`helm-techdoc-parity: ${errors.length} FAILURE(s) — the rendered page drifted from the vendored markdown:\n  ` + errors.join('\n  '));
    console.error('\nThe markdown is the source of truth. Fix the page (section eyebrow, TOC entry, subheading, or the pinned-sha meta); never edit the vendored markdown to match the page.');
    process.exit(1);
  }

  const sectionCount = [...markdown.matchAll(/^## (\d+)\.\s+/gm)].length;
  console.log(`helm-techdoc-parity: OK (${sectionCount} sections mirrored and TOC-reachable, subheadings match, vendored bytes match the pin).`);
  checkBehindUpstream(manifest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
