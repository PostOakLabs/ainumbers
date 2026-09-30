#!/usr/bin/env node
// webmcp-triple-hash.mjs — SAME-INPUT triple hash: page ↔ live MCP ↔ local embed runner.
// (report-only; WEBMCP-RUNTIME-PARITY-INSTRUMENTS-1, 2026-09-26)
//
//   node scripts/webmcp-triple-hash.mjs [--dry-run] [--n 6] [--only art-339] [--self-test]
//
// Why: this week's census called plan_chain against the MCP for 341 chain pages, read page 1 of
// a 13-page tools/list, and compared page-exact hashes with lean-input calls — three false alarms
// and one false "v0.3" claim, all from the absence of a standing same-input comparison. This
// instrument picks ONE sample per page — the manifest's `input_example`, the same bytes the
// ask-agent block is generated from — and runs it through three legs:
//   (P) headless page compute via the PAGE-SMOKE harness's CDP shape, DIRECT-COMPUTE
//       ROUTED (7F-V344 item 3): the leg navigates the page bare (no fragment, no
//       run=1 — the form is untouched and the visible page stays on its form-driven
//       defaults) and evaluates the page's OWN inline compute + hash pair on the raw
//       manifest sample — the same sample bytes M/E hash — so all three legs hash
//       identical preimages. The pair is discovered statically from the page bytes
//       (discoverDirectCompute: `function compute*(pp)` + the `(pp, op)` hash family);
//       pages without a discoverable pair fall back to the legacy deep-link prefill
//       path (#p=v1.<b64url(gzip JSON)> + &run=1, TOOLPAGE-DEEPLINK-1, hash read off
//       window.__ocgDeeplinkArtifact) unchanged. Routing reason (art-50): an empty or
//       partial sample prefills nothing, so the prefill path hashed the FORM DEFAULTS'
//       preimage while M/E hashed the raw sample — a structural input-path divergence,
//       not compute drift; never a page-behavior change;
//   (M) live tools/call on https://mcp.ainumbers.co/mcp with {policy_parameters: sample} using
//       the node's mcp_name (Accept: application/json, text/event-stream) — ONE call per rotated
//       page per tick, all MCP requests throttled to <=2/s. Exposure is decided against the FULL
//       paginated tools/list (cursor honoured to exhaustion — the census's page-1 false alarm);
//   (E) local embed runner, zero network: getKernel(tool_id).buildArtifact(sample) from the
//       mcp-apps-poc checkout at its quoted sha.
// Verdict per page: MATCH (P=M=E) / DIVERGENT-SAME-INPUTS (detail names the diverging legs) /
//   NOT-EXPOSED (mcp_name absent from the full tools/list) / BROWSER-ONLY (no kernel in the embed
//   registry) / SKIP-DIRECT (direct-mode page: its manifest inputs have no single control, so the
//   page has no same-input prefill path — structural, never a finding) / LEG-ERROR <leg>.
// Chain pages are out of scope: the rotation universe is chaingraph/art-*.html pages carrying a
// generated WEBMCP region (the rig-fix row covers run_chain).
//
// Output: one `## <stamp> @ repo <sha> @ embed <esha>` block per run appended to
// farm/notes/WEBMCP-TRIPLE-HASH.md (constants-sweep record shape), plus a one-line stdout
// summary for the farm TICK line. Only non-MATCH, non-structural rows are draft-factory
// records. --dry-run computes and prints but appends nothing. Chrome absent -> the P leg
// records NO-CHROME, nothing is appended, exit 0 (never a red tick). No repo checkout ->
// NO-REPO, exit 0.
import { existsSync, readFileSync, appendFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync, spawn, execFileSync } from 'node:child_process';
import { execPath } from 'node:process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

// Dual-home (7F-V344 item 3): this file exists byte-identical in two places —
// the workspace copy (beside farm/, the standing rotation; REPO = <ws>/repo) and
// the versioned copy committed to the site repo (scripts/webmcp-triple-hash.mjs;
// REPO = THAT checkout, so a run from a worktree measures its own branch bytes,
// which is what the cparity door gate reads). Detection: a chaingraph/ directory
// beside scripts/ means the repo home. NOTES/EMBED always live in the workspace.
const SELF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN_REPO_CHECKOUT = existsSync(join(SELF_ROOT, 'chaingraph'));
const WS_ROOT = IN_REPO_CHECKOUT ? 'C:/dev/Claude/Projects/AINumbers' : SELF_ROOT; // the workspace (farm notes + embed checkout), not a worktree
const REPO = IN_REPO_CHECKOUT ? SELF_ROOT : `${WS_ROOT}/repo`;                     // read-only input; branch bytes in the repo home
const EMBED = `${WS_ROOT}/mcp-apps-poc`;                       // read-only input (E leg)
const NOTES = `${WS_ROOT}/farm/notes/WEBMCP-TRIPLE-HASH.md`;   // the record file (non-dry runs)
const MCP_URL = 'https://mcp.ainumbers.co/mcp';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'webmcp-triple-hash');
const HEADER = '# WEBMCP-TRIPLE-HASH — one block per same-input triple-hash run (WEBMCP-RUNTIME-PARITY-INSTRUMENTS-1, 2026-09-26; report-only). The draft-factory stamps DIVERGENT-SAME-INPUTS / NOT-EXPOSED / LEG-ERROR rows as T1 fix proposals; MATCH, BROWSER-ONLY and SKIP-DIRECT are not findings.\n';
const MCP_MIN_GAP_MS = 550;   // <=2 calls/s across ALL MCP requests (census safety shape)
const LOAD_BUDGET_MS = 15000;
const PAGE_BUDGET_MS = 45000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const SELF = args.includes('--self-test');
const N = Number((args.indexOf('--n') >= 0 && args[args.indexOf('--n') + 1]) || 6);
const ONLY = args.indexOf('--only') >= 0 ? args[args.indexOf('--only') + 1] : null;
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim().slice(0, 120);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normHash = (h) => String(h || '').trim().replace(/^sha256:/i, '').toLowerCase();

// ---------------------------------------------------------------- pure core (self-testable)
/** The deep-link fragment for a sample — the page reader's exact decode contract
 *  (b64url(gzip(JSON)) after the `v1.` tag, no padding). Same codec the ask-agent
 *  gate's verifyFragment decodes. Pure. */
export function sampleToFragment(sample) {
  const gz = gzipSync(Buffer.from(JSON.stringify(sample), 'utf8'));
  return 'v1.' + gz.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Direct-compute discovery (7F-V344 item 3): the page's OWN inline compute +
 *  hash entry names, read statically from the page bytes. The compute family is
 *  `function compute*(pp)` (art-50 `compute(pp)`, art-195 `computeCC(pp)`); the
 *  hash family is the `(pp, op)` pair mirroring the kernel's _hash.mjs
 *  executionHash preimage ({policy_parameters, output_payload}; the execHash /
 *  cgHash / executionHashLocal / ... names). BOTH must be present — the P leg
 *  hashes the page-computed payload through the PAGE's own hash, never a second
 *  canonicalization. Null = no discoverable pair: the P leg falls back to the
 *  deep-link prefill path. Pure. */
export function discoverDirectCompute(src) {
  const s = String(src);
  const c = /function\s+(compute[A-Za-z0-9_$]*)\s*\(\s*pp\s*\)\s*\{/.exec(s);
  const h = /(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(\s*pp\s*,\s*op\s*\)/.exec(s);
  return c && h ? { compute: c[1], hash: h[1] } : null;
}

/** Walk a paginated tools/list to exhaustion, honouring result.nextCursor. The
 *  census false alarm was reading page 1 of 13; this walker is the fix. `list`
 *  is an injected async (params) => result transport (self-test uses a fake). */
export async function fullToolsList(list) {
  const names = new Set();
  let cursor; let pages = 0;
  do {
    const res = await list(cursor ? { cursor } : {});
    pages++;
    for (const t of (res && res.tools) || []) if (t && t.name) names.add(t.name);
    cursor = res && res.nextCursor;
  } while (cursor && pages < 100);
  return { names, pages };
}

/** Verdict composition from the three leg outcomes. Leg values: { ok, hash | why }.
 *  Precedence: NOT-EXPOSED (no M leg) > BROWSER-ONLY (no E leg) > SKIP-DIRECT
 *  (no P leg, structural) > LEG-ERROR <legs> > MATCH > DIVERGENT-SAME-INPUTS. */
export function composeVerdict({ exposed, direct, p, m, e }) {
  if (exposed === false) return { verdict: 'NOT-EXPOSED', detail: 'mcp_name absent from the full paginated tools/list' };
  if (e && !e.ok && e.why === 'NO-KERNEL') return { verdict: 'BROWSER-ONLY', detail: 'no kernel in the embed registry (getKernel -> null)' };
  if (direct) return { verdict: 'SKIP-DIRECT', detail: 'direct-mode page: no form prefill path, P leg not runnable' };
  if (p && !p.ok && p.why === 'NO-CHROME') return { verdict: 'NO-CHROME', detail: 'headless Chrome absent — nothing measured' };
  const bad = [p, m, e].filter((x) => x && !x.ok);
  if (bad.length) return { verdict: 'LEG-ERROR ' + bad.map((x) => x.leg).join('+'), detail: oneLine(bad.map((x) => x.why).join(' | ')) };
  const ph = normHash(p && p.hash), mh = normHash(m && m.hash), eh = normHash(e && e.hash);
  if (ph === mh && mh === eh) return { verdict: 'MATCH', detail: ph.slice(0, 12) };
  const legs = [];
  if (ph !== mh) legs.push('P≠M');
  if (mh !== eh) legs.push('M≠E');
  if (ph !== eh) legs.push('P≠E');
  return { verdict: 'DIVERGENT-SAME-INPUTS', detail: `P=${ph.slice(0, 12)} M=${mh.slice(0, 12)} E=${eh.slice(0, 12)} (${legs.join(' ')})` };
}

/** The verdict classes the draft-factory stamps (structural/environmental classes never stamp). */
export const FACTORY_VERDICTS = new Set(['DIVERGENT-SAME-INPUTS', 'NOT-EXPOSED', 'LEG-ERROR']);

/** One stable record row — no timestamp, so a stable finding stamps once. */
export function renderRow(page, p, m, e, verdict, detail) {
  const cell = (s) => oneLine(s) || '-';
  return `| ${page} | ${cell(p)} | ${cell(m)} | ${cell(e)} | ${verdict} | ${cell(detail)} |`;
}

// ---------------------------------------------------------------- --self-test (fixtures, offline)
if (SELF) {
  let fails = 0; const t = (name, ok) => { if (!ok) fails++; console.log(`self-test: ${ok ? 'ok' : 'FAIL'} ${name}`); };
  // 1) fragment codec: b64url(gzip(JSON)) round-trips, no padding, `v1.` prefix — the page
  //    reader's decode contract (chaingraph/_page-chrome.mjs buildDeeplinkScript).
  const sample = JSON.parse(readFileSync(join(FIXTURES, 'sample-input.json'), 'utf8'));
  const frag = sampleToFragment(sample);
  t('fragment carries the v1. tag', frag.startsWith('v1.'));
  t('fragment is base64url without padding', /^[A-Za-z0-9_-]+$/.test(frag.slice(3)));
  const gz = Buffer.from(frag.slice(3).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const { gunzipSync } = await import('node:zlib');
  t('fragment decodes to the exact sample JSON', JSON.stringify(JSON.parse(gunzipSync(gz).toString('utf8'))) === JSON.stringify(sample));
  // 1b) direct-compute discovery (7F-V344 item 3): both families present -> the
  //     entry names; either family missing -> null (prefill-path fallback).
  const dp = discoverDirectCompute('<script>function compute(pp){return {output_payload:pp}}\nasync function execHash(pp,op){return "h"}</script>');
  t('direct discovery names both families', !!dp && dp.compute === 'compute' && dp.hash === 'execHash');
  const dp2 = discoverDirectCompute('<script>function computeCC(pp){return {output_payload:pp}}\nasync function cgHash(pp,op){return "h"}</script>');
  t('direct discovery carries the suffixed families', !!dp2 && dp2.compute === 'computeCC' && dp2.hash === 'cgHash');
  t('direct discovery needs the hash family too', discoverDirectCompute('<script>function compute(pp){return pp}</script>') === null);
  t('direct discovery needs the compute family too', discoverDirectCompute('<script>async function execHash(pp,op){return "h"}</script>') === null);
  // 2) cursor walker: a paginated transport is walked to exhaustion, cursor honoured.
  const page1 = JSON.parse(readFileSync(join(FIXTURES, 'tools-list-page1.json'), 'utf8'));
  const page2 = JSON.parse(readFileSync(join(FIXTURES, 'tools-list-page2.json'), 'utf8'));
  const seen = [];
  const walked = await fullToolsList(async (params) => { seen.push(params && params.cursor); return seen.length === 1 ? page1 : page2; });
  t('all names collected across pages', walked.names.size === 3 && walked.names.has('tool_a') && walked.names.has('tool_b') && walked.names.has('tool_c'));
  t('cursor honoured (second request carried page 1 nextCursor)', walked.pages === 2 && seen[1] === page1.nextCursor);
  const onePage = await fullToolsList(async () => ({ tools: [{ name: 'x' }] }));
  t('a cursor-less list terminates after one page', onePage.pages === 1 && onePage.names.size === 1);
  // 3) verdict composition, precedence order.
  const H1 = 'a'.repeat(64), H2 = 'b'.repeat(64);
  t('all three equal -> MATCH', composeVerdict({ exposed: true, direct: false, p: { ok: true, hash: H1 }, m: { ok: true, hash: H1 }, e: { ok: true, hash: H1 } }).verdict === 'MATCH');
  const dv = composeVerdict({ exposed: true, direct: false, p: { ok: true, hash: H1 }, m: { ok: true, hash: H2 }, e: { ok: true, hash: H1 } });
  t('P!=M -> DIVERGENT-SAME-INPUTS naming the legs', dv.verdict === 'DIVERGENT-SAME-INPUTS' && dv.detail.includes('P≠M') && dv.detail.includes('M≠E'));
  t('sha256: prefix and case are normalised before compare', composeVerdict({ exposed: true, direct: false, p: { ok: true, hash: 'SHA256:' + H1.toUpperCase() }, m: { ok: true, hash: H1 }, e: { ok: true, hash: H1 } }).verdict === 'MATCH');
  t('NOT-EXPOSED outranks everything', composeVerdict({ exposed: false, direct: false, p: { ok: false, leg: 'P', why: 'x' }, m: null, e: { ok: false, leg: 'E', why: 'NO-KERNEL' } }).verdict === 'NOT-EXPOSED');
  t('BROWSER-ONLY outranks SKIP-DIRECT', composeVerdict({ exposed: true, direct: true, p: null, m: { ok: true, hash: H1 }, e: { ok: false, leg: 'E', why: 'NO-KERNEL' } }).verdict === 'BROWSER-ONLY');
  t('direct-mode page with all legs -> SKIP-DIRECT', composeVerdict({ exposed: true, direct: true, p: null, m: { ok: true, hash: H1 }, e: { ok: true, hash: H1 } }).verdict === 'SKIP-DIRECT');
  t('leg error is named', composeVerdict({ exposed: true, direct: false, p: { ok: false, leg: 'P', why: 'no hash in artifact' }, m: { ok: true, hash: H1 }, e: { ok: true, hash: H1 } }).verdict === 'LEG-ERROR P');
  t('NO-CHROME is its own verdict', composeVerdict({ exposed: true, direct: false, p: { ok: false, leg: 'P', why: 'NO-CHROME' }, m: { ok: true, hash: H1 }, e: { ok: true, hash: H1 } }).verdict === 'NO-CHROME');
  // 4) the record row is a stable, pipe-safe table line and the factory classes are the findings.
  const row = renderRow('chaingraph/art-x.html', 'aaa', 'bbb', 'ccc', 'DIVERGENT-SAME-INPUTS', 'P=a M=b (P≠M)');
  t('row shape is 6 pipe-delimited cells', row.split('|').length === 8 && row.startsWith('| chaingraph/art-x.html | '));
  t('factory stamps only the finding classes', FACTORY_VERDICTS.has('DIVERGENT-SAME-INPUTS') && FACTORY_VERDICTS.has('NOT-EXPOSED') && FACTORY_VERDICTS.has('LEG-ERROR') && !FACTORY_VERDICTS.has('MATCH') && !FACTORY_VERDICTS.has('SKIP-DIRECT') && !FACTORY_VERDICTS.has('BROWSER-ONLY'));
  // 5) rotation is deterministic for a fixed hour seed (live-smoke's formula).
  const pages = ['a.html', 'b.html', 'c.html', 'd.html', 'e.html', 'f.html', 'g.html'];
  const pickOf = (h, n) => Array.from({ length: Math.min(n, pages.length) }, (_, i) => pages[(h * n + i) % pages.length]);
  t('rotation deterministic per hour', JSON.stringify(pickOf(3, 2)) === JSON.stringify(pickOf(3, 2)) && pickOf(3, 2).length === 2 && pickOf(3, 2)[0] === pages[6]);
  console.log(fails ? `self-test: ${fails} check(s) FAILED` : 'self-test: all green');
  process.exit(fails ? 1 : 0);
}

// ---------------------------------------------------------------- the page universe + rotation
// Import-safe (the draft-factory.mjs law): the pure exports stay importable, a RUN happens
// only when this file is the entry script — an accidental import must never touch the tree,
// the live MCP, or Chrome.
if (!process.argv[1] || !/webmcp-triple-hash\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) process.exit(0);
const repoSha = (() => { try { return execFileSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', env: gitEnv() }).trim(); } catch { return '?'; } })();
const embedSha = (() => { try { return execFileSync('git', ['-C', EMBED, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', env: gitEnv() }).trim(); } catch { return '?'; } })();

if (!existsSync(join(REPO, 'chaingraph'))) { console.log(`NO-REPO ${REPO} — nothing measured (never a red tick)`); process.exit(0); }

const graph = JSON.parse(readFileSync(join(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const nodes = Array.isArray(graph.nodes) ? graph.nodes : Object.values(graph.nodes || {});
const byTool = new Map(nodes.filter((n) => n.tool_id).map((n) => [n.tool_id, n]));

const allArt = execFileSync('git', ['-C', REPO, 'ls-files', '--', 'chaingraph/art-*.html'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: gitEnv() })
  .split(/\r?\n/).map((s) => s.trim()).filter(Boolean).sort();
const universe = []; const noRegion = []; const noSample = [];
for (const p of allArt) {
  const id = p.replace(/^chaingraph\//, '').replace(/\.html$/, '');
  let src = ''; try { src = readFileSync(join(REPO, p), 'utf8'); } catch { continue; }
  if (!src.includes('<!-- WEBMCP:GEN-BEGIN ')) { noRegion.push(p); continue; } // not a WebMCP page
  const mPath = join(REPO, 'manifests', `${id}.manifest.json`);
  if (!existsSync(mPath)) { noSample.push(p); continue; }
  let sample = null; try { sample = JSON.parse(readFileSync(mPath, 'utf8')).input_example || null; } catch { sample = null; }
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) { noSample.push(p); continue; }
  const node = byTool.get(id) || {};
  universe.push({ p, id, sample, mcpName: node.mcp_name || null, direct: /<!-- WEBMCP:GEN-BEGIN [^>]*mode=direct/.test(src), pDirect: discoverDirectCompute(src) });
}
const slotOf = new Map(universe.map((u, i) => [u.p, i]));
let pick;
if (ONLY) pick = universe.filter((u) => u.p.includes(ONLY));
else {
  const h = new Date().getUTCHours() + 24 * (Math.floor(Date.now() / 86400000) % 10);
  pick = Array.from({ length: Math.min(N, universe.length) }, (_, i) => universe[(h * N + i) % universe.length]);
}
if (!pick.length) { console.log(`no pages match --only ${ONLY} — nothing to do`); process.exit(0); }
console.log(`universe ${universe.length} registered node page(s) @ repo ${repoSha} @ embed ${embedSha} (excluded: ${noRegion.length} no-region, ${noSample.length} no-sample); rotating ${pick.length}`);

// ---------------------------------------------------------------- (M) MCP client (live-smoke rpc shape)
let lastMcpAt = 0;
const throttle = () => { const wait = lastMcpAt + MCP_MIN_GAP_MS - Date.now(); lastMcpAt = Math.max(lastMcpAt + MCP_MIN_GAP_MS, Date.now()); return sleep(Math.max(0, wait)); };
async function rpc(session, id, method, params) {
  await throttle();
  const r = await fetch(MCP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const text = await r.text();
  const line = text.split('\n').map((l) => l.replace(/^data: /, '')).find((l) => l.trim().startsWith('{'));
  return { status: r.status, session: r.headers.get('mcp-session-id') || session, json: line ? JSON.parse(line) : null };
}

// ---------------------------------------------------------------- (P) zero-dep CDP client (page-smoke shape)
function cdpLaunch() {
  return (async () => {
    const profile = mkdtempSync(join(tmpdir(), 'triple-hash-profile-'));
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
      '--disable-background-networking', '--disable-component-update', '--mute-audio',
      '--no-default-browser-check', '--disable-crash-reporter', '--window-size=1400,2400',
      `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
    ], { stdio: 'ignore', windowsHide: true });
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const [portStr] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/);
        if (portStr && Number(portStr)) return { child, profile, port: Number(portStr) };
      } catch { /* not written yet */ }
      await sleep(250);
    }
    cdpClose({ child, profile });
    return null;
  })();
}
function cdpClose({ child, profile }) {
  try { if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); else child.kill(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

/** Open the page and read one execution_hash off it. Two routings:
 *  - direct == null (legacy): the URL carries the sample fragment + run=1 — the
 *    page's own deep-link reader prefills and runs; the emitted hash is read off
 *    window.__ocgDeeplinkArtifact (the global check-deeplink-contract.mjs reads),
 *    never a re-derivation.
 *  - direct = { sampleJson, compute, hash } (7F-V344 item 3): the URL is bare —
 *    no fragment, no prefill, no run(); the form is untouched and the visible
 *    page stays on its form-driven defaults. The sample goes through the PAGE's
 *    own inline compute + hash pair, i.e. the exact preimage bytes M/E hash.
 *    A result carrying `fallback: true` asks the caller to retry legacy. */
async function cdpPageHash(port, fileUrl, direct = null) {
  let target = null;
  for (let i = 0; i < 20 && !target; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
      if (res.ok) target = await res.json();
    } catch { /* devtools not accepting yet */ }
    if (!target) await sleep(250);
  }
  if (!target || !target.webSocketDebuggerUrl) return { ok: false, leg: 'P', why: 'no DevTools target' };
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const warns = [];
  let msgId = 0; const pending = new Map();
  let awaitingLoad = false; let resolveLoad = null;
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Page.loadEventFired' && awaitingLoad && resolveLoad) { resolveLoad(); return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'warning') {
      const line = (m.params.args || []).map((a) => a.description ?? a.value).filter(Boolean).join(' ');
      if (line.includes('[deeplink]')) warns.push(line);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      warns.push(String((d.exception && d.exception.description) || d.text || 'exception'));
    }
  };
  try {
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('devtools websocket failed')); setTimeout(() => rej(new Error('devtools websocket timeout')), 10000); });
    const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    const loaded = new Promise((res) => { resolveLoad = res; });
    awaitingLoad = true;
    await send('Page.navigate', { url: fileUrl });
    await Promise.race([loaded, sleep(LOAD_BUDGET_MS)]);
    await sleep(1000); // the reader runs on DOMContentLoaded; settle like page-smoke
    const expression = direct
      ? `(async (sampleJson, computeName, hashName) => { try { const pp = JSON.parse(sampleJson); const cf = window[computeName], hf = window[hashName]; if (typeof cf !== 'function' || typeof hf !== 'function') return { why: 'direct-compute entry not found on page' }; const out = cf(pp); const res = (out && typeof out.then === 'function') ? await out : out; const op = res && res.output_payload; if (!op || typeof op !== 'object') return { why: 'direct compute returned no output_payload' }; const h = await hf(pp, op); return (typeof h === 'string' && h) ? { hash: h } : { why: 'direct hash returned no execution_hash' }; } catch (e) { return { why: String((e && e.message) || e) }; } })(${JSON.stringify(direct.sampleJson)}, ${JSON.stringify(direct.compute)}, ${JSON.stringify(direct.hash)})`
      : `(async () => { if (typeof window.__ocgDeeplinkDone === 'object' && window.__ocgDeeplinkDone && typeof window.__ocgDeeplinkDone.then === 'function') { try { await window.__ocgDeeplinkDone; } catch {} } const a = window.__ocgDeeplinkArtifact; return a && a.execution_hash ? String(a.execution_hash) : null; })()`;
    const evalRes = await Promise.race([
      send('Runtime.evaluate', {
        expression,
        returnByValue: true, awaitPromise: true,
      }),
      sleep(PAGE_BUDGET_MS).then(() => null),
    ]);
    const val = evalRes && evalRes.result && evalRes.result.result && evalRes.result.result.value;
    if (direct) {
      if (val && typeof val === 'object' && typeof val.hash === 'string' && val.hash) return { ok: true, leg: 'P', hash: val.hash };
      return { ok: false, leg: 'P', why: oneLine((val && val.why) || 'direct compute produced no hash'), fallback: true };
    }
    if (typeof val === 'string' && val) return { ok: true, leg: 'P', hash: val };
    const why = warns.length ? warns[0] : 'page emitted no __ocgDeeplinkArtifact.execution_hash';
    return { ok: false, leg: 'P', why: oneLine(why) };
  } catch (e) {
    return { ok: false, leg: 'P', why: oneLine((e && e.message) || e) };
  } finally {
    try { ws.close(); } catch {}
    try { fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {}); } catch {}
  }
}

// ---------------------------------------------------------------- (E) local embed runner, zero network
let getKernel = null; let embedErr = '';
try {
  const reg = await import(pathToFileURL(join(EMBED, 'kernels', 'index.mjs')).href);
  getKernel = reg.getKernel;
} catch (e) { embedErr = oneLine((e && e.message) || e); }
async function embedHash(toolId, sample, node) {
  if (!getKernel) return { ok: false, leg: 'E', why: embedErr || 'embed registry unimportable' };
  const k = getKernel(toolId);
  if (!k || typeof k.buildArtifact !== 'function') return { ok: false, leg: 'E', why: 'NO-KERNEL' };
  try {
    const artifact = await k.buildArtifact(sample, { now: new Date().toISOString(), parent_hashes: [], parent_tool_ids: [], chain_depth: node.chain_depth ?? 0 });
    if (!artifact || !artifact.execution_hash) return { ok: false, leg: 'E', why: 'embed artifact carries no execution_hash' };
    return { ok: true, leg: 'E', hash: artifact.execution_hash };
  } catch (e) { return { ok: false, leg: 'E', why: oneLine((e && e.message) || e) }; }
}

// ---------------------------------------------------------------- one run over the rotated pages
const rows = [];
const chromePresent = existsSync(CHROME);
const sess = chromePresent ? await cdpLaunch() : null;
if (!chromePresent) console.log(`NO-CHROME ${CHROME} — P leg cannot run; nothing recorded (never a red tick)`);
let mcpDown = '';
let mcpSession = null;
const exposedNames = new Set();
if (sess) {
  try {
    const init = await rpc(null, 1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'webmcp-triple-hash', version: '1' } });
    if (init.status !== 200) mcpDown = `initialize: HTTP ${init.status}`;
    else {
      // The worker answers without a session header (measured 2026-09-11, live-smoke.mjs);
      // the session id is forwarded when present and omitted otherwise.
      mcpSession = init.session || null;
      const walked = await fullToolsList(async (params) => {
        const res = await rpc(init.session, 2, 'tools/list', params);
        if (res.status !== 200) throw new Error(`tools/list HTTP ${res.status}`);
        if (res.json && res.json.error) throw new Error(`tools/list error: ${res.json.error.message || 'unknown'}`);
        return (res.json && res.json.result) || {};
      });
      for (const n of walked.names) exposedNames.add(n);
      console.log(`tools/list: ${walked.names.size} exposed name(s) over ${walked.pages} page(s) — full pagination, cursor honoured`);
    }
  } catch (e) { mcpDown = oneLine((e && e.message) || e); }
}
let id = 100;
try {
  for (const u of pick) {
    let p, m, e;
    // (P) page leg — DIRECT-COMPUTE ROUTING first (7F-V344 item 3): the leg
    // consumes the manifest sample exactly as M/E do (the page's own inline
    // compute + hash on the raw sample; no form prefill), so all three legs
    // hash identical preimages. Pages without a discoverable inline pair — or
    // where the direct evaluate yields no hash — fall back to the legacy
    // deep-link prefill path unchanged.
    if (!sess) p = { ok: false, leg: 'P', why: 'NO-CHROME' };
    else if (u.direct) p = null; // structural: no prefill path, never clicked
    else {
      const fileUrl = pathToFileURL(join(REPO, u.p)).href;
      if (u.pDirect) {
        const directRes = await Promise.race([
          cdpPageHash(sess.port, fileUrl, { sampleJson: JSON.stringify(u.sample), compute: u.pDirect.compute, hash: u.pDirect.hash }),
          sleep(PAGE_BUDGET_MS + 5000).then(() => ({ ok: false, leg: 'P', why: 'page budget exceeded' })),
        ]);
        if (directRes && directRes.ok) p = directRes;
        else if (directRes && directRes.fallback) {
          const frag = sampleToFragment(u.sample);
          p = await Promise.race([
            cdpPageHash(sess.port, fileUrl + `#p=${frag}&run=1`),
            sleep(PAGE_BUDGET_MS + 5000).then(() => ({ ok: false, leg: 'P', why: 'page budget exceeded' })),
          ]);
        } else p = directRes;
      } else {
        const frag = sampleToFragment(u.sample);
        p = await Promise.race([
          cdpPageHash(sess.port, fileUrl + `#p=${frag}&run=1`),
          sleep(PAGE_BUDGET_MS + 5000).then(() => ({ ok: false, leg: 'P', why: 'page budget exceeded' })),
        ]);
      }
    }
    // (M) live leg — NOT-EXPOSED is decided against the FULL list; an unexposed tool is never called.
    if (!sess || mcpDown) m = { ok: false, leg: 'M', why: mcpDown || 'MCP not reachable (no browser session)' };
    else if (!u.mcpName || !exposedNames.has(u.mcpName)) m = { ok: false, leg: 'M', why: 'NOT-EXPOSED' };
    else {
      try {
        const res = await rpc(mcpSession, ++id, 'tools/call', { name: u.mcpName, arguments: { policy_parameters: u.sample } });
        const body = JSON.stringify(res.json || {});
        if (res.status !== 200) m = { ok: false, leg: 'M', why: `HTTP ${res.status}` };
        else if (res.json?.error || /"isError":true/.test(body)) m = { ok: false, leg: 'M', why: oneLine((res.json?.error?.message || body).slice(0, 120)) };
        else {
          const h = /"execution_hash":"([0-9a-fA-F]{64})"/.exec(body);
          m = h ? { ok: true, leg: 'M', hash: h[1] } : { ok: false, leg: 'M', why: 'NO-HASH in response' };
        }
      } catch (err) { m = { ok: false, leg: 'M', why: oneLine((err && err.message) || err) }; }
    }
    // (E) embed leg
    e = await embedHash(u.id, u.sample, byTool.get(u.id) || {});
    const exposed = !(m && !m.ok && m.why === 'NOT-EXPOSED');
    const { verdict, detail } = composeVerdict({ exposed, direct: u.direct, p, m, e });
    const pCell = !p ? (u.direct ? 'SKIP-DIRECT' : '-') : p.ok ? normHash(p.hash).slice(0, 12) : p.why;
    const mCell = !m ? (mcpDown || 'NOT-CALLED') : m.ok ? normHash(m.hash).slice(0, 12) : m.why;
    const eCell = !e.ok && e.why === 'NO-KERNEL' ? 'NO-KERNEL' : e.ok ? normHash(e.hash).slice(0, 12) : e.why;
    rows.push({ page: u.p, p: pCell, m: mCell, e: eCell, verdict, detail });
    console.log(renderRow(u.p, pCell, mCell, eCell, verdict, detail));
  }
} finally { if (sess) cdpClose(sess); }

if (chromePresent) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const summary = `triple-hash repo=${repoSha} embed=${embedSha} n=${rows.length} MATCH=${count('MATCH')} DIVERGENT-SAME-INPUTS=${count('DIVERGENT-SAME-INPUTS')} NOT-EXPOSED=${count('NOT-EXPOSED')} BROWSER-ONLY=${count('BROWSER-ONLY')} SKIP-DIRECT=${count('SKIP-DIRECT')} LEG-ERROR=${rows.filter((r) => r.verdict.startsWith('LEG-ERROR')).length} no-sample=${noSample.length} — ${stamp}`;
  if (DRY) {
    console.log('DRY-RUN nothing appended');
  } else {
    mkdirSync(dirname(NOTES), { recursive: true });
    if (!existsSync(NOTES)) appendFileSync(NOTES, HEADER, 'utf8');
    const block = [
      `## ${stamp} @ repo ${repoSha} @ embed ${embedSha}`,
      '',
      `- instrument: \`scripts/webmcp-triple-hash.mjs\` (WEBMCP-RUNTIME-PARITY-INSTRUMENTS-1, report-only; P leg direct-compute routed per 7F-V344 item 3) · repo measured: \`${IN_REPO_CHECKOUT ? 'this checkout (branch bytes)' : 'repo/'}\` @ \`${repoSha}\`, embed: \`mcp-apps-poc/\` @ \`${embedSha}\` (both read-only) · ${ONLY ? `--only ${ONLY}` : `rotation hour=${new Date().getUTCHours()} · --n ${N}`}`,
      '',
      '| page | P | M | E | verdict | detail |',
      '|---|---|---|---|---|---|',
      ...rows.map((r) => renderRow(r.page, r.p, r.m, r.e, r.verdict, r.detail)),
      '',
      summary,
      '',
    ];
    appendFileSync(NOTES, block.join('\n') + '\n', 'utf8');
    console.log(`appended ${rows.length} row(s) to farm/notes/WEBMCP-TRIPLE-HASH.md`);
  }
  console.log(summary);
}
process.exit(0);
