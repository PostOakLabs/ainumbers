/**
 * scripts/codemods/page-null-proto.selftest.mjs — self-test for PAGE-NULLPROTO-CODEMOD-1.
 *
 * Builds a synthetic four-page estate in a temp git repo (DROP-by-R1, DROP-by-R2, KEEP-jcs,
 * DROP-by-R3 merge, plus a kernel-less page) and drives the real census and the real codemod
 * CLI against it:
 *   1. census classifies DROP / KEEP / DROP(merge) / NO-PATH as expected;
 *   2. the KEEP-jcs page's proto-leg hash EQUALS the kernel's proto hash — proving the proto
 *      member survives harness injection (a literal-object injection would strip it and every
 *      page would look "insensitive" for the wrong reason);
 *   3. the codemod refuses on a dirty tree (the guard's decision input is exercised, not
 *      assumed), then applies exactly the expected replacements per file;
 *   4. post-codemod census: every page KEEP, clean hashes byte-identical to the pre run.
 * Exit 0 on pass, 1 on any failure. Node built-ins only; no network; fixtures live in os.tmpdir().
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitEnv } from '../_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN = join(HERE, 'page-null-proto.mjs');
const REAL_HASH = resolve(HERE, '..', '..', 'chaingraph', 'kernels', '_hash.mjs');

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok: ${msg}`);
  else { failures++; console.error(`  SELFTEST-FAIL: ${msg}`); }
};

const JCS_BLOCK = `
function __ocgJcs(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v)){var s='[';for(var i=0;i<v.length;i++){if(i)s+=',';var e=v[i];s+=(e===undefined||typeof e==='function'||typeof e==='symbol')?'null':__ocgJcs(e);}return s+']';}var ks=Object.keys(v).sort(),o='{',f=true;for(var i=0;i<ks.length;i++){var k=ks[i],w=v[k];if(w===undefined||typeof w==='function'||typeof w==='symbol')continue;if(!f)o+=',';f=false;o+=JSON.stringify(k)+':'+__ocgJcs(w);}return o+'}';}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return __ocgJcs(x);}
async function sha256(obj){const c=__ocgCanonStr(obj);const b=new TextEncoder().encode(c);const h=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('');}
`;

function pageOf(title, script) {
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body><div id="x"></div>
<script>
${script}
</script>
</body></html>`;
}

function kernelOf(id) {
  return `// synthetic kernel for the page-null-proto selftest (${id})
import { executionHash } from './_hash.mjs';
export const meta = { tool_id: '${id}', tool_version: '1.0.0', mcp_name: 'pnp_selftest_${id.replace(/-/g, '_')}', gpu: false };
export function compute(pp) { return { output_payload: { ok: true, n: 3 }, compliance_flags: ['SELFTEST'] }; }
export async function buildArtifact(pp, opts = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  return { tool_id: meta.tool_id, policy_parameters: pp, output_payload, compliance_flags, execution_hash: await executionHash(pp, output_payload) };
}
`;
}

const FIX_PP = { envelope: { cap: 100 }, draws: [{ seq: 1, amount: 5 }] };
const FIX_OP = { ok: true, n: 3 };
const fixturesJson = (id) => JSON.stringify({ tool_id: id, vectors: [{ name: 'v1', policy_parameters: FIX_PP, output_payload: FIX_OP }] }, null, 1);

function buildEstate(root) {
  const cg = join(root, 'chaingraph');
  const kd = join(cg, 'kernels');
  const fd = join(kd, 'fixtures');
  mkdirSync(fd, { recursive: true });
  // kernels + fixtures for the four kernel-backed pages
  const ids = ['art-pnp-drop-r1', 'art-pnp-drop-r2', 'art-pnp-keep-jcs', 'art-pnp-drop-merge'];
  for (const id of ids) {
    writeFileSync(join(kd, `${id}.kernel.mjs`), kernelOf(id));
    writeFileSync(join(fd, `${id}.fixtures.json`), fixturesJson(id));
  }
  writeFileSync(join(kd, '_hash.mjs'), readFileSync(REAL_HASH, 'utf8'));

  // DROP by R1 (reduce with a `{}` accumulator)
  writeFileSync(join(cg, 'art-pnp-drop-r1.html'), pageOf('r1', `
function cgCanon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(cgCanon);
  return Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {});
}
async function executionHashLocal(pp, outputPayload) {
  const obj = cgCanon({ policy_parameters: pp, output_payload: outputPayload });
  const s = JSON.stringify(obj);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
document.getElementById('x').textContent = 'ready';
`));

  // DROP by R2 (`const out = {};` accumulator)
  writeFileSync(join(cg, 'art-pnp-drop-r2.html'), pageOf('r2', `
function cgCanon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(cgCanon);
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = cgCanon(v[k]);
  return out;
}
async function executionHashLocal(pp, outputPayload) {
  const obj = cgCanon({ policy_parameters: pp, output_payload: outputPayload });
  const s = JSON.stringify(obj);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
document.getElementById('x').textContent = 'ready';
`));

  // KEEP: jcs hash path (member included; proto hash MUST equal the kernel's)
  writeFileSync(join(cg, 'art-pnp-keep-jcs.html'), pageOf('jcs', `
${JCS_BLOCK}
async function runHash(pp, op) {
  return await sha256({ policy_parameters: pp, output_payload: op });
}
document.getElementById('x').textContent = 'ready';
`));

  // DROP by R3 (the exact Object.assign merge: a FLAT preimage from params+output, so the
  // member sits at merge-source top level and the {} target drops it; the census drives this
  // shape through its synthetic R3 seam, params=2 -> execHash(pp, op))
  writeFileSync(join(cg, 'art-pnp-drop-merge.html'), pageOf('merge', `
async function execHash(params, output) {
  const pre = Object.assign({}, params, output);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(pre)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
document.getElementById('x').textContent = 'ready';
`));

  // kernel-less page: NO-PATH
  writeFileSync(join(cg, 'art-pnp-nokernel.html'), pageOf('nokernel', 'var x = 1;\n'));
}

export async function selfTest() {
  console.log('page-null-proto selftest (PAGE-NULLPROTO-CODEMOD-1)');
  const root = mkdtempSync(join(tmpdir(), 'pnp-selftest-'));
  const repo = mkdtempSync(join(tmpdir(), 'pnp-selftest-repo-'));
  let passed = true;
  try {
    buildEstate(root);
    const { runCensus } = await import(pathToFileURL(MAIN).href);

    // ── 1. census classification ──
    console.log(' census classification:');
    const pre = await runCensus({ root });
    const byId = new Map(pre.pages.map((p) => [p.id, p]));
    const r1 = byId.get('art-pnp-drop-r1');
    const r2 = byId.get('art-pnp-drop-r2');
    const jcs = byId.get('art-pnp-keep-jcs');
    const mg = byId.get('art-pnp-drop-merge');
    const nk = byId.get('art-pnp-nokernel');
    ok(r1 && r1.cls === 'DROP' && r1.mechanism === 'cgCanon', `art-pnp-drop-r1 DROP cgCanon (got ${r1 && r1.cls}/${r1 && r1.mechanism})`);
    ok(r2 && r2.cls === 'DROP' && r2.mechanism === 'cgCanon', `art-pnp-drop-r2 DROP cgCanon (got ${r2 && r2.cls}/${r2 && r2.mechanism})`);
    ok(mg && mg.cls === 'DROP' && mg.mechanism === 'merge', `art-pnp-drop-merge DROP merge (got ${mg && mg.cls}/${mg && mg.mechanism})`);
    ok(nk && nk.cls === 'NO-PATH' && /no kernel file/.test(nk.note), `art-pnp-nokernel NO-PATH (got ${nk && nk.cls}/${nk && nk.note})`);
    ok(jcs && jcs.cls === 'KEEP', `art-pnp-keep-jcs KEEP (got ${jcs && jcs.cls})`);
    // ── 2. the proto member must SURVIVE injection: the jcs page's proto hash equals the kernel's
    ok(jcs && jcs.proto_hash === jcs.kernel_proto, `proto member survives injection (page proto ${jcs && String(jcs.proto_hash).slice(0, 12)} vs kernel proto ${jcs && String(jcs.kernel_proto).slice(0, 12)})`);
    ok(jcs && jcs.clean_parity === true, `jcs page clean hash byte-identical to kernel (parity ${jcs && jcs.clean_parity})`);
    // the drop pages' clean hashes stay byte-identical to the kernel's too (clean input has no member)
    ok(r1 && r1.clean_parity === true, `r1 page clean parity (got ${r1 && r1.clean_parity})`);
    ok(r1 && r1.proto_hash === r1.clean_hash, `r1 page hash unchanged under the added member (drop signature)`);

    // ── 3. codemod CLI: dirty-tree refusal, then the real edit ──
    console.log(' codemod CLI:');
    // fixture repo: commit the estate, then dirty it
    const g = (args) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: gitEnv() });
    rmSync(repo, { recursive: true, force: true });
    mkdirSync(repo, { recursive: true });
    // copy the estate into the repo working tree
    spawnSync('node', ['-e', `
      const fs = require('fs'); const path = require('path');
      function copy(src, dst) {
        for (const e of fs.readdirSync(src, { withFileTypes: true })) {
          const s = path.join(src, e.name), d = path.join(dst, e.name);
          if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); } else fs.copyFileSync(s, d);
        }
      }
      copy(${JSON.stringify(root)}, ${JSON.stringify(repo)});
    `]);
    g(['init']);
    g(['config', 'user.email', 'selftest@example.invalid']);
    g(['config', 'user.name', 'pnp-selftest']);
    g(['add', '-A']);
    g(['commit', '-m', 'fixture estate', '--quiet']);
    writeFileSync(join(repo, 'scratch-uncommitted.txt'), 'dirty\n');
    const refused = spawnSync(process.execPath, [MAIN, 'codemod', '--batch', '1', '--size', '50', '--root', repo], { encoding: 'utf8' });
    ok(refused.status === 1 && /dirty tree/.test(refused.stderr || ''), `codemod refuses on a dirty tree (exit ${refused.status}, stderr ${(refused.stderr || '').slice(0, 60)})`);
    ok(!existsSync(join(repo, 'chaingraph', 'art-pnp-drop-r1.html')) === false, 'refused run wrote nothing (page still present, unedited)');
    const before = readFileSync(join(repo, 'chaingraph', 'art-pnp-drop-r1.html'), 'utf8');
    rmSync(join(repo, 'scratch-uncommitted.txt'));
    const applied = spawnSync(process.execPath, [MAIN, 'codemod', '--batch', '1', '--size', '50', '--root', repo], { encoding: 'utf8' });
    ok(applied.status === 0, `codemod applies on a clean tree (exit ${applied.status}; stderr ${(applied.stderr || '').slice(0, 120)})`);
    ok(/art-pnp-drop-r1\.html: cgCanon:R1R2 x1/.test(applied.stdout || ''), `r1 log line names rule + count (got ${(applied.stdout || '').split('\n').find((l) => l.includes('art-pnp-drop-r1')) || 'none'})`);
    const after = readFileSync(join(repo, 'chaingraph', 'art-pnp-drop-r1.html'), 'utf8');
    ok(before !== after && /Object\.create\(null\)/.test(after), 'r1 source now carries Object.create(null)');
    const afterMerge = readFileSync(join(repo, 'chaingraph', 'art-pnp-drop-merge.html'), 'utf8');
    ok(/Object\.assign\(Object\.create\(null\),\s*params,\s*output\)/.test(afterMerge), 'R3 applied to the merge page');

    // ── 4. post-codemod census: all KEEP, clean hashes byte-identical ──
    console.log(' post-codemod census:');
    const post = await runCensus({ root: repo });
    const postById = new Map(post.pages.map((p) => [p.id, p]));
    for (const id of ['art-pnp-drop-r1', 'art-pnp-drop-r2', 'art-pnp-drop-merge']) {
      const a = postById.get(id);
      ok(a && a.cls === 'KEEP', `${id} now KEEP (got ${a && a.cls})`);
      ok(a && a.clean_hash === byId.get(id).clean_hash, `${id} clean hash byte-identical before/after`);
    }
    ok(postById.get('art-pnp-keep-jcs') && postById.get('art-pnp-keep-jcs').cls === 'KEEP', 'jcs page still KEEP');
  } catch (e) {
    failures++;
    console.error('  SELFTEST-FAIL (harness):', e && e.stack || e);
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* temp */ }
    try { rmSync(repo, { recursive: true, force: true }); } catch { /* temp */ }
  }
  if (failures) console.error(`page-null-proto selftest: ${failures} FAILURE(S)`);
  else console.log('page-null-proto selftest: all checks passed');
  return failures ? 1 : 0;
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) selfTest().then((code) => process.exit(code));
