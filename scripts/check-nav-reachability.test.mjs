#!/usr/bin/env node
// check-nav-reachability.test.mjs — fixture proof for NAV-ISLAND-PENDING-ASSEMBLE-1.
//
// WHAT THIS PROVES: check-nav-reachability.mjs's PENDING-ASSEMBLE accommodation
// gives a class-K row's new node page (chaingraph/<id>.html, shipped in the same
// PR as its shard per RIDER-KERNEL K-FULL) a pass on THIS branch, without ever
// becoming a permanent hole once the shard is genuinely registered or leaked.
// Every case below builds a throwaway repo with a bare `origin`, pushes a real
// main, and runs the REAL scripts/check-nav-reachability.mjs (which itself
// shells to the REAL scripts/check-shard-assembly.mjs — copied in verbatim,
// never reproduced) against it, asserting the exit code and printed diagnosis.
// A harness that stubbed either gate out would be the self-consistent-checker
// shape STANDING-ORDERS #34 names — a checker agreeing with itself.
//
// THE FOUR STATES THE ROW REQUIRES (SO #34c — a gate never seen red is not a
// gate, and a gate that stops being red where it should is worse):
//   1. a PENDING-ASSEMBLE node page on a branch                 -> PASSES (green)
//   2. the SAME page once its node is registered but STILL      -> still RED
//      genuinely unlinked (the exemption did not become a hole)
//   3. an unrelated, genuinely-unlinked page with no shard       -> still RED
//      behind it at all (no over-loosening)
//   4. the SAME PENDING-ASSEMBLE case evaluated once its shard   -> RED
//      has reached the base ref ("main context") — proves the
//      accommodation is branch-scoped, not a standing grant
//
// Zero-dep, node: builtins only.

import { execFileSync } from 'node:child_process'
import { isolatedChildEnv } from './_git-env-lib.mjs'
import { assertSandboxCompleteOrExit, deriveSandboxFiles, namedModuleNotFound, REPO_ROOT } from './lib-sandbox-deps.mjs'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── THE SANDBOX FILE SET IS DERIVED, NOT TYPED (SANDBOX-FILELIST-GATE-1) ──
// The gate under test shells to check-shard-assembly.mjs for the PENDING-
// ASSEMBLE classification (NAV-ISLAND-PENDING-ASSEMBLE-1's whole point is
// reuse, not reimplementation — SO #34), so every fixture repo needs real
// copies of it and everything IT needs in turn — the same real files, never a
// reproduction of their content.
//
// "Everything it needs in turn" used to be five hand-written const lines, and an
// import added to any of them killed this suite. Here the damage was WORSE than
// in check-shard-assembly.test.mjs: check-nav-reachability.mjs catches the
// sub-gate's crash, so the missing module never reaches this file's output at
// all. Measured on GIT-ENV-LEAK-SWEEP-1's mutation, this harness printed
// "1 NEW island(s) — page(s) no nav path reaches" and failed 3 of 7 cases with a
// confident, wrong nav verdict and no ERR_MODULE_NOT_FOUND anywhere in the log.
//
// Only what CANNOT be derived is declared now:
//   ROOTS  — the scripts the fixture EXECUTES: the gate itself, the gate it
//            SHELLS OUT to, and that one's own shell-out target
//            (schema-validate.mjs). Shell-outs are execFileSync calls, not
//            imports, so import derivation cannot see them.
//   EXTRAS — non-module data read at runtime.
// _git-env-lib.mjs and lib-shard-order.mjs are derived and no longer named.
const SANDBOX_ROOTS = [
  'scripts/check-nav-reachability.mjs',
  'scripts/check-shard-assembly.mjs',
  'chaingraph/standard/schema-validate.mjs',
]
const SANDBOX_EXTRAS = ['chaingraph/standard/openchain-graph-v0.4.schema.json']
const SANDBOX_FILES = deriveSandboxFiles({ roots: SANDBOX_ROOTS, extras: SANDBOX_EXTRAS })

// ── CHILD-ENVIRONMENT ISOLATION (SHARD-HARNESS-ENV-LEAK-1) ────────────────
// Same allowlist discipline as check-shard-assembly.test.mjs, for the same
// reason: git exports GIT_DIR (and friends) to every child, and this file is
// wired into scripts/preflight.mjs, which the pre-push hook invokes — an
// inherited GIT_DIR would point every git call below at the OUTER repository
// instead of the throwaway fixture. Built as an ALLOWLIST, not copy-and-delete,
// so the next unnamed GIT_* variable is excluded by construction rather than
// by memory.
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): the 40-key allowlist and its childEnv() filter used to be
// written out here. Three harnesses carried a byte-identical copy; all three now share
// isolatedChildEnv() from scripts/_git-env-lib.mjs. Same key list, same filter, same `extra`-last
// override — a de-duplication, not a behaviour change. The local name is kept so the call sites
// below (which pass GIT_AUTHOR_DATE/GIT_COMMITTER_DATE as deliberate `extra`) are untouched.
const childEnv = isolatedChildEnv

let passed = 0
let failed = 0
const cleanup = []

function test(name, fn) {
  try {
    fn()
    console.log('  ✓ ' + name)
    passed++
  } catch (e) {
    console.error('  ✗ ' + name + ' — ' + e.message)
    failed++
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed')
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv({ GIT_AUTHOR_DATE: '2026-08-22T00:00:00Z', GIT_COMMITTER_DATE: '2026-08-22T00:00:00Z' }),
  })
}

function commit(cwd, message) {
  git(cwd, ['add', '-A'])
  git(cwd, ['-c', 'user.email=gate@test.invalid', '-c', 'user.name=gate-test', 'commit', '-q', '-m', message])
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

// A fully $defs.node-conformant minimal shard (same shape check-shard-assembly
// .test.mjs's own nodeShard() helper uses), so schema conformance never muddies
// what these tests are actually about (registration/reachability, not schema).
function nodeShard(work, id, url) {
  writeJson(join(work, 'chaingraph/graph/nodes', `${id}.json`), {
    tool_id: id,
    tool_version: '1.0.0',
    display_name: id,
    mcp_name: `tool_${id.replace(/-/g, '_')}`,
    mandate_type: 'test_fixture',
    wave: 1,
    gpu: false,
    url: url ?? `https://ainumbers.co/chaingraph/${id}.html`,
    description: 'test fixture shard for check-nav-reachability.test.mjs',
    input_schema_ref: `chaingraph/${id}.html#manifest`,
    consumes: [],
    feeds: [],
    status: 'live',
    compute_capability: 'server',
  })
}

// The node page itself — a class-K row ships this in the SAME PR as the shard
// (RIDER-KERNEL K-FULL). Deliberately unlinked from index.html and absent from
// chaingraph.json: nothing on this branch COULD have linked it yet. Page BYTES
// are irrelevant to the gate under test (it only cares about the file's path
// matching a shard id, and that it is not itself a sitemap or a redirect shim —
// see the header's reachability model) — a real ~200KB node composer page adds
// nothing a one-line placeholder does not, so only the SHARD below is the real,
// verbatim, retrieved artifact.
function nodePage(work, id) {
  writeFileSync(join(work, 'chaingraph', `${id}.html`), '<!doctype html><html><body>test node page</body></html>\n', 'utf8')
}

// REAL historical content, not a synthetic reproduction (SO #40(b) — use a
// real fixture where one exists, the same discipline check-shard-assembly
// .test.mjs's own art-662 fixture applies): the EXACT bytes
// chaingraph/graph/nodes/art-652-verify-receipt.json carried in commit
// 87e0de80 (`git show 87e0de80:chaingraph/graph/nodes/art-652-verify-receipt.json`
// — the merge of PR #1401, ART652-COMPLETE-1's own subject), the precise
// pre-registration tree the row body names: the shard AND its node page
// (chaingraph/art-652-verify-receipt.html) existed at that commit, and
// chaingraph.json mentioned art-652 zero times — verified live with
// `git show 87e0de80:chaingraph/chaingraph.json | grep -c art-652` -> 0,
// vs 4 after the later assemble commit 69513e85. This is what STATE 1 and
// STATE 4 below replay.
const ART_652_SHARD_AT_PRE_REGISTRATION = {
  tool_id: 'art-652-verify-receipt',
  tool_version: '1.0.0',
  display_name: 'Verify Receipt',
  mcp_name: 'compute_verify_receipt',
  mandate_type: 'compliance_control',
  wave: 108,
  gpu: false,
  url: 'https://ainumbers.co/chaingraph/art-652-verify-receipt.html',
  description: "Offline verifier for AINumbers Evidence Envelope v0.1 receipts. Given a receipt JSON, recomputes the RFC 8785 JCS signing preimage, verifies the Ed25519 (EdDSA) signature against the did:key resolved from issuer_id/signatures[].kid, checks hash-field shape (sha256:-prefixed, 64 hex chars), and — when a prior receipt is supplied — recomputes previousReceiptHash to prove the chain link. Verify-only: never issues a receipt, never contacts a transparency log or registry, never resolves a DID document over the network. Every check recomputes from the receipt's own bytes; no self-claimed hash or verdict field is trusted (SO #34).",
  input_schema_ref: 'chaingraph/art-652-verify-receipt.html#manifest',
  consumes: [],
  feeds: [],
  status: 'live',
  conformance_fixtures: true,
  compute_capability: 'server',
  compute_images: [{ system: 'sha256-source', image_id: 'sha256:2662a63bf15814b04ad4a314cabd6b1b4f47260c916cc58df3ae59bbd24eedf9', valid_from: '2026-08-20' }],
  export_capability: ['json'],
  standards_basis: 'not_applicable',
  scope_statement: 'Verifies AINumbers Evidence Envelope v0.1 receipts against the ratified format recorded at research/EVIDENCE-ENVELOPE-V01-RATIFIED-2026-08-20.md. That format is an AINumbers-internal ratified artifact rather than a third-party published standard or regulation, so standards_basis is not_applicable: SO #38 binds nodes implementing an EXTERNAL standard. Computes signature validity, hash-field shape and previous-receipt chain linkage from the receipt\'s own bytes; it does not issue receipts, resolve DID documents over the network, or consult a transparency log.',
  compute_proof_ready: 'deferred',
  deferred_reason: 'New gpu:false node, art-652-verify-receipt, built 2026-08-20 (MCP-VERIFY-RECEIPT-TOOL-1). No GPU prove has been run and none is proposed by this row — deferred per the section 18 steady-state rule (RIDER-KERNEL.md). Run GPU-CYCLE-PREFLIGHT-1\'s static pre-screen once a prove row is staged, then measure user_cycles with runq-cpu exec before booking.',
}

function writeArt652Shard(work) {
  writeJson(join(work, 'chaingraph/graph/nodes/art-652-verify-receipt.json'), ART_652_SHARD_AT_PRE_REGISTRATION)
  nodePage(work, 'art-652-verify-receipt')
}

function writeAssembled(work, nodeIds, chainNames = []) {
  writeJson(join(work, 'chaingraph/chaingraph.json'), {
    nodes: nodeIds.map((id) => ({ tool_id: id })),
    chains: chainNames.map((name) => ({ name })),
  })
  writeJson(join(work, 'chaingraph/chaingraph.meta.json'), { order: { nodes: [...nodeIds], chains: [...chainNames] } })
}

// A throwaway repo whose `origin/main` carries: index.html (deliberately
// link-free — reachability comes only from the mechanisms under test), ONE
// already-registered baseline node shard (so check-shard-assembly.mjs's own
// "base ref resolves but the shard dir reads back empty" guard — deliberately
// strict, see its GUARD 1 — has something real to resolve against, exactly
// the reason check-shard-assembly.test.mjs's own fixture seeds an art-A too),
// and every script dependency the gate under test needs, real and unmodified.
function makeFixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'nav-pending-'))
  cleanup.push(tmp)
  const originDir = join(tmp, 'origin.git')
  const work = join(tmp, 'work')
  git(tmp, ['init', '--bare', '-q', '-b', 'main', originDir])
  mkdirSync(work, { recursive: true })
  git(work, ['init', '-q', '-b', 'main'])

  // Every path is repo-relative and copied to the SAME relative path, which is
  // what makes '../../scripts/denominator-sentinel.mjs' resolve in the fixture
  // exactly as it does in the repo.
  for (const rel of SANDBOX_FILES) {
    const dest = join(work, ...rel.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(resolve(REPO_ROOT, rel), dest)
  }
  // Reads the tree that was ACTUALLY built and names any module an imported file
  // cannot reach — once, before a single case runs. This is the check that saves
  // THIS harness specifically: the gate under test swallows its sub-gate's
  // crash, so a missing module would otherwise never appear in the output at
  // all, only as a wrong nav verdict. Independent of the derivation above by
  // construction: it consults the sandbox on disk, never the derived list
  // (STANDING-ORDERS #34).
  assertSandboxCompleteOrExit(work, SANDBOX_FILES, 'check-nav-reachability.test.mjs')

  writeFileSync(join(work, 'index.html'), '<!doctype html><html><body>root, deliberately link-free</body></html>\n', 'utf8')
  nodeShard(work, 'art-nip-baseline')
  writeAssembled(work, ['art-nip-baseline'], [])
  // check-shard-assembly.mjs readdirSync()s chaingraph/graph/chains unconditionally
  // (even when the chain half has nothing to say) — it must exist on disk, tracked,
  // so it survives every checkout in this fixture. Not a .json file, so it is
  // never itself read as a chain shard (shardIdsOnDisk filters by extension).
  mkdirSync(join(work, 'chaingraph/graph/chains'), { recursive: true })
  writeFileSync(join(work, 'chaingraph/graph/chains/.gitkeep'), '', 'utf8')

  commit(work, 'baseline: scripts + one registered node shard + link-free index')
  git(work, ['remote', 'add', 'origin', originDir])
  git(work, ['push', '-q', '-u', 'origin', 'main'])
  return { tmp, work, originDir }
}

// Runs the REAL gate inside the fixture and returns {status, out}.
function runGate(work, args = []) {
  try {
    const out = execFileSync(process.execPath, [join(work, 'scripts/check-nav-reachability.mjs'), ...args], {
      cwd: work,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // The gate shells to check-shard-assembly.mjs, which itself shells to
      // git — the leak-prevention env must reach both hops.
      env: childEnv({ GITHUB_BASE_REF: '', SHARD_ASSEMBLY_BASE_REF: '' }),
    })
    return { status: 0, out }
  } catch (e) {
    if (e.status === undefined) throw e
    const out = (e.stdout || '') + (e.stderr || '')
    // SANDBOX-FILELIST-GATE-1: a module-not-found escaping the child is a
    // SANDBOX defect, never a nav verdict. Node's own text already names both
    // halves the diagnosis needs, so it is rewritten rather than passed through
    // as a bare ERR_MODULE_NOT_FOUND. Catches what the pre-run check cannot see
    // — a missing shell-out target is not an import.
    const named = namedModuleNotFound(out, work)
    if (named) {
      console.error(`\ncheck-nav-reachability.test.mjs: FIXTURE SANDBOX IS INCOMPLETE — this is not a gate failure.`)
      console.error(`  ${named}`)
      process.exit(1)
    }
    return { status: e.status, out }
  }
}

console.log('check-nav-reachability.test.mjs — PENDING-ASSEMBLE accommodation proof (NAV-ISLAND-PENDING-ASSEMBLE-1)')

// ── STATE 1 — a PENDING-ASSEMBLE node page on a branch is excused ─────────
// art-652's REAL pre-registration tree (commit 87e0de80, see the fixture
// constant above) — not a synthetic reproduction, per SO #40(b).
test('STATE 1 (real art-652 tree) — a PENDING-ASSEMBLE node page on a branch is excused, exit 0', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'mcp-verify-receipt-tool-1'])
  writeArt652Shard(work)
  commit(work, 'feat(chaingraph): add verify_receipt Evidence Envelope v0.1 verifier (art-652) (#1401)')

  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0 for a mid-flight node page, got ${status}\n${out}`)
  assert(/excused as PENDING-ASSEMBLE/.test(out), `expected the excusal line, got:\n${out}`)
  assert(/art-652-verify-receipt/.test(out), `expected art-652-verify-receipt named, got:\n${out}`)
  assert(!/NEW island\(s\)/.test(out), `must not be reported as a new island:\n${out}`)
  assert(/nav-reachability: OK/.test(out), `expected the OK line, got:\n${out}`)
})

test('STATE 1 (real art-652 tree) — the excused page is NOT written to the baseline via --update', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'mcp-verify-receipt-tool-1'])
  writeArt652Shard(work)
  commit(work, 'feat(chaingraph): add verify_receipt Evidence Envelope v0.1 verifier (art-652) (#1401)')

  const { status, out } = runGate(work, ['--update'])
  assert(status === 0, `expected exit 0, got ${status}\n${out}`)
  const baseline = JSON.parse(readFileSync(join(work, 'scripts/nav-island-baseline.json'), 'utf8'))
  assert(!baseline.includes('chaingraph/art-652-verify-receipt.html'), `excused page must never be baselined: ${JSON.stringify(baseline)}`)
})

// ── STATE 2 — registered but still genuinely unlinked stays RED ───────────
// Synthetic (SO #40(b) allows this: no specific incident named a node that
// was registered yet still unreachable — this is a guard against the
// accommodation over-loosening, not a replay of a measured defect).
test('STATE 2 — the SAME page once registered but still unlinked stays a real island, exit 1', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'k-row'])
  nodeShard(work, 'art-nip-registered', 'https://ainumbers.co/chaingraph/some-other-page.html')
  nodePage(work, 'art-nip-registered')
  // Registered in chaingraph.json (so it is no longer "unassembled" and
  // check-shard-assembly.mjs will NOT report it PENDING-ASSEMBLE), but its
  // own url field points elsewhere — a genuine registration/linking defect,
  // not a mid-flight shard. The accommodation must not eat this case.
  writeAssembled(work, ['art-nip-registered'], [])
  commit(work, 'art-nip-registered: shard + page + registered-but-mislinked')

  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 for a registered-but-unlinked page, got ${status}\n${out}`)
  assert(/NEW island\(s\)/.test(out), `expected the new-island failure, got:\n${out}`)
  assert(/chaingraph\/art-nip-registered\.html/.test(out), `expected the page named as an island, got:\n${out}`)
  assert(!/excused as PENDING-ASSEMBLE/.test(out), `a registered node must NOT be excused:\n${out}`)
})

// ── STATE 3 — an unrelated page with no shard behind it stays RED ─────────
// Synthetic (SO #40(b) allows this: an ordinary orphan tool page unrelated to
// any shard is a routine no-regression check, not a replay of an incident).
test('STATE 3 — an unrelated unlinked page with no matching shard is unaffected, exit 1', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'unrelated-row'])
  mkdirSync(join(work, 'tools'), { recursive: true })
  writeFileSync(join(work, 'tools/999-orphan-tool.html'), '<!doctype html><html><body>orphan</body></html>\n', 'utf8')
  commit(work, 'an ordinary unlinked tool page, no shard involved at all')

  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 for a genuinely unlinked page, got ${status}\n${out}`)
  assert(/NEW island\(s\)/.test(out), `expected the new-island failure, got:\n${out}`)
  assert(/tools\/999-orphan-tool\.html/.test(out), `expected the orphan page named, got:\n${out}`)
  assert(!/excused as PENDING-ASSEMBLE/.test(out), `nothing here should ever be excused (no shard exists):\n${out}`)
})

test('STATE 3 — a chaingraph/ page whose id names NO on-disk shard is unaffected, exit 1', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'unrelated-row'])
  // Looks like a node page by path shape, but chaingraph/graph/nodes/art-nip-nonexistent.json
  // was never created — must not be mistaken for a candidate at all.
  nodePage(work, 'art-nip-nonexistent')
  commit(work, 'a chaingraph/ page with no backing shard file')

  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1, got ${status}\n${out}`)
  assert(/chaingraph\/art-nip-nonexistent\.html/.test(out), `expected the page named as an island, got:\n${out}`)
  assert(!/excused as PENDING-ASSEMBLE/.test(out), `a page with no shard file must never be excused:\n${out}`)
})

// ── STATE 4 / MUTATION — branch-scoped: the SAME case flips green -> RED ──
// once its shard reaches the base ref, proving the exemption is not a
// standing grant (SHARD-GATE-PRE-ASSEMBLE-1's own mutation shape, observed
// here through the nav gate that reuses it). SAME real art-652 tree as STATE 1.
test('STATE 4 / MUTATION (real art-652 tree) — the SAME PENDING-ASSEMBLE page flips excused(green) -> RED once its shard reaches origin/main', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'mcp-verify-receipt-tool-1'])
  writeArt652Shard(work)
  commit(work, 'feat(chaingraph): add verify_receipt Evidence Envelope v0.1 verifier (art-652) (#1401)')

  const before = runGate(work)
  assert(before.status === 0, `pre-publish expected exit 0, got ${before.status}\n${before.out}`)
  assert(/excused as PENDING-ASSEMBLE/.test(before.out) && /art-652-verify-receipt/.test(before.out), `pre-publish expected art-652-verify-receipt excused, got:\n${before.out}`)

  // Publish the shard + page to origin/main, still UNREGISTERED in
  // chaingraph.json — exactly commit 87e0de80's real state: PR #1401 merged to
  // main, and chaingraph.json would not mention art-652 until the later
  // ASSEMBLE-LAND commit 69513e85 (SO #35 single-writer). "Main context" here
  // means: this shard has now reached the gate's own base ref.
  git(work, ['checkout', '-q', 'main'])
  git(work, ['merge', '-q', '--ff-only', 'mcp-verify-receipt-tool-1'])
  git(work, ['push', '-q', 'origin', 'main'])

  const after = runGate(work)
  assert(after.status === 1, `post-publish ("main context") expected exit 1, got ${after.status}\n${after.out}`)
  assert(!/excused as PENDING-ASSEMBLE/.test(after.out), `post-publish must NOT still be excused:\n${after.out}`)
  assert(/chaingraph\/art-652-verify-receipt\.html/.test(after.out), `expected the page now named as an island, got:\n${after.out}`)
  assert(/NEW island\(s\)/.test(after.out), `expected the new-island failure, got:\n${after.out}`)
})

// ── NO-REGRESSION — a clean tree with no candidate node pages stays fast+green ──
test('NO-REGRESSION — a tree with no chaingraph/ candidate pages never shells out, stays green', () => {
  const { work } = makeFixture()
  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0 for the clean baseline fixture, got ${status}\n${out}`)
  assert(/nav-reachability: OK/.test(out), `expected the OK line, got:\n${out}`)
  assert(!/excused as PENDING-ASSEMBLE/.test(out), `nothing to excuse in a clean tree:\n${out}`)
})

for (const dir of cleanup) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // a leftover temp dir is not a test failure
  }
}

console.log(`\ncheck-nav-reachability.test.mjs: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
