#!/usr/bin/env node
// check-shard-assembly.test.mjs — fixture proof for SHARD-GATE-PRE-ASSEMBLE-1.
//
// WHAT THIS PROVES, and why it runs against REAL git repositories rather than
// against a mocked set difference: the thing under test is a distinction the
// gate draws from git history, so a harness that stubs git out would be the
// self-consistent-checker shape STANDING-ORDERS #34 names — a checker
// agreeing with itself. Every case below builds a throwaway repo with a bare
// `origin`, pushes a real main, and runs the REAL scripts/check-shard-assembly.mjs
// against it, asserting the exit code and the printed diagnosis.
//
// THE THREE STATES THE ROW REQUIRES (SO #34c — a gate never seen red is not a
// gate, and a gate that stops being red where it should is worse):
//   (a) a NEW shard on a branch, absent from origin/main → PENDING-ASSEMBLE, exit 0
//   (b) a shard PRESENT on origin/main and still unregistered → RED, exit 1
//   (c) an assembled, registered shard → OK, exit 0
//
// Plus the mutation control that makes (a) and (b) one fact rather than two:
// the SAME shard id, GREEN as pending while it lives only on the branch,
// turns RED the moment it reaches origin/main. If that flip ever stops
// happening, the exemption has eaten the check it was carved out of.
//
// Plus both guards, each proven to FAIL CLOSED:
//   guard 1 — base ref unresolvable (bad ref / empty base tree / no git at all)
//   guard 2 — an assembling branch (one that edits chaingraph.json or
//             chaingraph.meta.json) gets no mid-flight exemption
//
// Plus two no-regression checks: the reverse orphan direction is NOT
// branch-aware, and the chain half stays advisory.
//
// Zero-dep, node: builtins only.

import { execFileSync } from 'node:child_process'
import { isolatedChildEnv } from './_git-env-lib.mjs'
import { assertSandboxCompleteOrExit, deriveSandboxFiles, namedModuleNotFound, REPO_ROOT } from './lib-sandbox-deps.mjs'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── THE SANDBOX FILE SET IS DERIVED, NOT TYPED (SANDBOX-FILELIST-GATE-1) ──
// This used to be seven hand-written `const *_SRC = resolve(...)` lines, and
// twice in two days a single added import to one of the COPIED modules took the
// whole suite out: DENOMINATOR-SENTINEL-1 (PR #1492) reddened 13 of 18 cases,
// GIT-ENV-LEAK-SWEEP-1 (PR #1498) reddened all 18 with ERR_MODULE_NOT_FOUND.
// Each was fixed by adding the missing filename here, which is precisely why it
// recurred — and each was caught by a before/after diff rather than by the
// change itself, so a session that did not happen to diff would have shipped a
// dead suite reading as a pass.
//
// Now only what CANNOT be derived is declared:
//   ROOTS  — the ONE script the fixture executes, the gate under test. The
//            closure is shut under BOTH edges, `import` and `node <script>`, so
//            schema-validate.mjs arrives on its own (SHARD-SCHEMA-PARITY-1: the
//            gate spawns `node schema-validate.mjs --shard <path>`) and so does
//            everything either of them imports.
//   EXTRAS — non-module data the gate readFileSync()s at runtime, which no
//            import or spawn edge points at.
// _git-env-lib.mjs, lib-shard-order.mjs, denominator-sentinel.mjs and
// schema-validate.mjs are no longer named anywhere, and the next added import
// needs no edit here at all. See scripts/lib-sandbox-deps.mjs for the
// derive-vs-gate reasoning and for what derivation still cannot see. Real files
// are copied verbatim, never a reproduction of their content — unchanged.
const SANDBOX_ROOTS = ['scripts/check-shard-assembly.mjs']
const SANDBOX_EXTRAS = ['chaingraph/standard/openchain-graph-v0.4.schema.json']
const SANDBOX_FILES = deriveSandboxFiles({ roots: SANDBOX_ROOTS, extras: SANDBOX_EXTRAS })

// ── CHILD-ENVIRONMENT ISOLATION (SHARD-HARNESS-ENV-LEAK-1) ────────────────
// Git EXPORTS GIT_DIR (and GIT_INDEX_FILE, GIT_WORK_TREE, GIT_PREFIX, ...) to
// every hook it runs. This file is wired into scripts/preflight.mjs, which the
// pre-push hook invokes, so any child spawned here with a copied process.env
// inherits a GIT_DIR pointing at the OUTER repository — and every git call
// below then operates on that repo instead of its throwaway fixture.
//
// That is not merely a test failure. Measured 2026-08-15: standalone this file
// reports 14 passed / 0 failed, and with GIT_DIR set it reports 0 passed /
// 14 failed. Worse, `git init --bare` under an inherited GIT_DIR re-initialises
// THAT gitdir and sets core.bare=true, which is how a single run of this file
// disabled the shared checkout and all 56 worktrees estate-wide. The env leak
// is therefore the safety half of this harness, not only the correctness half.
//
// CI could never have caught it: scripts-verify.yml runs preflight as an
// ordinary step with no GIT_DIR, so the entry is green in CI and red in every
// hook — STANDING-ORDERS #34b (a gate must run in the environment of the thing
// it validates) one step sideways.
//
// THE METHOD IS AN ALLOWLIST, NOT COPY-AND-DELETE. Deleting the four or five
// git variables we know about today leaves the next one to reintroduce the
// leak; building the child env from an explicit list excludes every GIT_* — and
// anything else not named here — by construction. Names are matched
// case-insensitively so Windows' own casing is preserved on the way out.
// Builds the env for every child process this harness spawns. `extra` is
// applied last so a case can still set what it deliberately means to set
// (commit dates, GIT_CEILING_DIRECTORIES, the gate's own base-ref vars).
//
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): the 40-key allowlist argued for above used to be written out
// right here, and check-clause-digest.test.mjs and check-nav-reachability.test.mjs each carried a
// byte-identical copy of it. It is now isolatedChildEnv() in scripts/_git-env-lib.mjs — same keys,
// same case-insensitive filter, same `extra`-last override. A de-duplication, not a behaviour
// change; the local name is kept so every call site below is untouched.
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
    env: childEnv({ GIT_AUTHOR_DATE: '2026-08-15T00:00:00Z', GIT_COMMITTER_DATE: '2026-08-15T00:00:00Z' }),
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

// SHARD-SCHEMA-PARITY-1: a fully $defs.node-conformant minimal shard, so
// every EXISTING test in this file (which exercises the registration/
// assembly axes, not schema conformance) keeps passing the NEW schema check
// without being about schema at all. mcp_name defaults to a pattern-safe
// (`^[a-z][a-z0-9_]*$`) transform of id — callers that already pass an
// explicit lowercase mcpName (e.g. 'tool_b') are untouched. tool_id is
// lowercased independently of the (possibly uppercase, e.g. "art-LEAK")
// filesystem id these tests use to name shards — nothing in the
// registration/assembly logic under test reads the tool_id FIELD, only the
// filename, so this divergence is deliberate and inert.
function nodeShard(work, id, mcpName) {
  writeJson(join(work, 'chaingraph/graph/nodes', `${id}.json`), {
    tool_id: id.toLowerCase(),
    tool_version: '1.0.0',
    display_name: id,
    mcp_name: mcpName ?? `tool_${id.toLowerCase().replace(/-/g, '_')}`,
    mandate_type: 'test_fixture',
    wave: 1,
    gpu: false,
    url: 'https://example.invalid/x.html',
    description: 'test fixture shard for check-shard-assembly.test.mjs',
    input_schema_ref: 'x.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    compute_capability: 'server',
  })
}

// A node shard with a property $defs.node forbids (additionalProperties:false)
// — the exact defect class this row closes (art-662's real `pageless` key).
function schemaInvalidNodeShard(work, id) {
  writeJson(join(work, 'chaingraph/graph/nodes', `${id}.json`), {
    tool_id: id.toLowerCase(),
    tool_version: '1.0.0',
    display_name: id,
    mcp_name: `tool_${id.toLowerCase().replace(/-/g, '_')}`,
    mandate_type: 'test_fixture',
    wave: 1,
    gpu: false,
    url: 'https://example.invalid/x.html',
    description: 'test fixture shard for check-shard-assembly.test.mjs',
    input_schema_ref: 'x.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    compute_capability: 'server',
    pageless: 'not a real $defs.node property — deliberately invalid',
  })
}

function writeAssembled(work, nodeIds, chainNames) {
  writeJson(join(work, 'chaingraph/chaingraph.json'), {
    nodes: nodeIds.map((id) => ({ tool_id: id })),
    chains: chainNames.map((name) => ({ name })),
  })
  writeJson(join(work, 'chaingraph/chaingraph.meta.json'), { order: { nodes: [...nodeIds], chains: [...chainNames] } })
}

// A throwaway repo whose `origin/main` carries exactly one registered node
// shard (art-A) and one registered chain shard. First commit deliberately has
// NO chaingraph/ tree at all, so the empty-base-tree guard has something real
// to resolve to.
function makeFixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'shard-gate-'))
  cleanup.push(tmp)
  const originDir = join(tmp, 'origin.git')
  const work = join(tmp, 'work')
  // Routed through git() rather than a raw execFileSync so this file has
  // exactly ONE git spawn site, and therefore exactly one place that could
  // ever leak an inherited GIT_DIR again. This is the specific call that
  // re-initialised the shared repo gitdir on 2026-08-15.
  git(tmp, ['init', '--bare', '-q', '-b', 'main', originDir])
  mkdirSync(work, { recursive: true })
  git(work, ['init', '-q', '-b', 'main'])

  // commit 0 — scripts only, no chaingraph/graph/ yet. schema-validate.mjs +
  // the schema JSON go in here too (chaingraph/standard/, not chaingraph/graph/)
  // since the gate shells out to the REAL file — SHARD-SCHEMA-PARITY-1.
  // Every path is repo-relative and copied to the SAME relative path, which is
  // what makes '../../scripts/denominator-sentinel.mjs' resolve in the fixture
  // exactly as it does in the repo.
  for (const rel of SANDBOX_FILES) {
    const dest = join(work, ...rel.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(resolve(REPO_ROOT, rel), dest)
  }
  // Reads the tree that was ACTUALLY built and names any module an imported file
  // cannot reach — once, before a single case runs, instead of leaving it to
  // resurface as 18 unrelated-looking failures with the real cause nowhere in
  // the output. Independent of the derivation above by construction: it consults
  // the sandbox on disk, never the derived list (STANDING-ORDERS #34).
  assertSandboxCompleteOrExit(work, SANDBOX_FILES, 'check-shard-assembly.test.mjs')
  commit(work, 'scripts only')
  const preChaingraphSha = git(work, ['rev-parse', 'HEAD']).trim()

  // commit 1 — one registered node shard, one registered chain shard.
  nodeShard(work, 'art-A')
  writeJson(join(work, 'chaingraph/graph/chains/chain-A.json'), { name: 'chain-A' })
  writeAssembled(work, ['art-A'], ['chain-A'])
  commit(work, 'assembled art-A')

  git(work, ['remote', 'add', 'origin', originDir])
  git(work, ['push', '-q', '-u', 'origin', 'main'])
  return { tmp, work, originDir, preChaingraphSha }
}

// Runs the REAL gate inside the fixture and returns {status, out}.
function runGate(work, args = [], env = {}) {
  try {
    const out = execFileSync(process.execPath, [join(work, 'scripts/check-shard-assembly.mjs'), ...args], {
      cwd: work,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // The gate itself shells out to git, so its env must be scrubbed too —
      // otherwise the leak simply moves one process further down.
      env: childEnv({ GITHUB_BASE_REF: '', SHARD_ASSEMBLY_BASE_REF: '', ...env }),
    })
    return { status: 0, out }
  } catch (e) {
    if (e.status === undefined) throw e
    const out = (e.stdout || '') + (e.stderr || '')
    // SANDBOX-FILELIST-GATE-1: a module-not-found escaping the child is a
    // SANDBOX defect, never a gate verdict. Node's own text already names both
    // halves the diagnosis needs, so it is rewritten rather than passed through
    // as a bare ERR_MODULE_NOT_FOUND buried in a stack trace. Catches what the
    // pre-run check cannot see — a missing shell-out target is not an import.
    const named = namedModuleNotFound(out, work)
    if (named) {
      console.error(`\ncheck-shard-assembly.test.mjs: FIXTURE SANDBOX IS INCOMPLETE — this is not a gate failure.`)
      console.error(`  ${named}`)
      process.exit(1)
    }
    return { status: e.status, out }
  }
}

console.log('check-shard-assembly.test.mjs — branch-aware gate proof (SHARD-GATE-PRE-ASSEMBLE-1)')

// ── STATE (c): assembled + registered ⇒ GREEN ─────────────────────────────
test('STATE (c) — an assembled, registered shard is GREEN', () => {
  const { work } = makeFixture()
  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0, got ${status}\n${out}`)
  assert(/check-shard-assembly: OK —/.test(out), `expected the OK line, got:\n${out}`)
  assert(!/PENDING-ASSEMBLE/.test(out), `a fully assembled tree must not mention PENDING-ASSEMBLE:\n${out}`)
})

// ── STATE (a): new shard on a branch ⇒ PENDING-ASSEMBLE, GREEN ────────────
test('STATE (a) — a NEW shard on a branch reports PENDING-ASSEMBLE and exits 0', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-B', 'tool_b')
  commit(work, 'art-B shard (class-K row, no chaingraph.json write)')
  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0 for a mid-flight shard, got ${status}\n${out}`)
  assert(/PENDING-ASSEMBLE/.test(out), `expected PENDING-ASSEMBLE, got:\n${out}`)
  assert(/art-B/.test(out), `expected art-B named, got:\n${out}`)
  assert(/branch-aware split against origin\/main/.test(out), `expected the resolved base ref printed, got:\n${out}`)
  assert(!/FAILING/.test(out), `must not report FAILING:\n${out}`)
})

test('STATE (a) — an UNCOMMITTED new shard is pending too (a row that has not committed yet)', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-B', 'tool_b') // never committed
  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0, got ${status}\n${out}`)
  assert(/PENDING-ASSEMBLE/.test(out) && /art-B/.test(out), `expected art-B pending, got:\n${out}`)
})

// ── STATE (b): shard on origin/main, unregistered ⇒ RED ───────────────────
test('STATE (b) — a shard PRESENT on origin/main and unregistered is RED', () => {
  const { work } = makeFixture()
  nodeShard(work, 'art-LEAK', 'tool_leak') // registered nowhere
  commit(work, 'art-LEAK shard, never appended to order.nodes')
  git(work, ['push', '-q', 'origin', 'main'])
  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 for a published unregistered shard, got ${status}\n${out}`)
  assert(/1 node shard\(s\) not yet in the assembled chaingraph.json/.test(out), `expected the leak line, got:\n${out}`)
  assert(/art-LEAK/.test(out), `expected art-LEAK named, got:\n${out}`)
  assert(!/PENDING-ASSEMBLE/.test(out), `a published shard must NEVER be reported pending:\n${out}`)
  assert(/FAILING — node case is BLOCKING/.test(out), `expected the blocking verdict, got:\n${out}`)
})

// ── THE MUTATION CONTROL — same shard, green then red ─────────────────────
test('MUTATION — the same shard flips PENDING(green) → RED the moment it reaches origin/main', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-M', 'tool_m')
  commit(work, 'art-M shard')

  const before = runGate(work)
  assert(before.status === 0 && /PENDING-ASSEMBLE/.test(before.out), `pre-publish expected pending+0, got ${before.status}\n${before.out}`)

  // Publish it, unregistered — exactly the NODE-REGISTRATION-GAP-1 leak.
  git(work, ['checkout', '-q', 'main'])
  git(work, ['merge', '-q', '--ff-only', 'shard-row'])
  git(work, ['push', '-q', 'origin', 'main'])

  const after = runGate(work)
  assert(after.status === 1, `post-publish expected exit 1, got ${after.status}\n${after.out}`)
  assert(!/PENDING-ASSEMBLE/.test(after.out), `post-publish must not be pending:\n${after.out}`)
  assert(/art-M/.test(after.out), `expected art-M named in the failure, got:\n${after.out}`)
})

test('MUTATION — registering the published shard turns it GREEN again (red → green closes the loop)', () => {
  const { work } = makeFixture()
  nodeShard(work, 'art-M', 'tool_m')
  commit(work, 'art-M shard, unregistered')
  git(work, ['push', '-q', 'origin', 'main'])
  assert(runGate(work).status === 1, 'expected the unregistered published shard to be red first')

  writeAssembled(work, ['art-A', 'art-M'], ['chain-A'])
  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0 once registered, got ${status}\n${out}`)
  assert(/check-shard-assembly: OK —/.test(out), `expected the OK line, got:\n${out}`)
})

// ── GUARD 1 — fail closed when the base ref cannot be resolved ────────────
test('GUARD 1 — an unresolvable base ref FAILS CLOSED (no shard is exempted)', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-B', 'tool_b')
  commit(work, 'art-B shard')
  const { status, out } = runGate(work, ['--base-ref', 'refs/heads/no-such-base'])
  assert(status === 1, `expected exit 1 when the base is unresolvable, got ${status}\n${out}`)
  assert(/BASE REF UNRESOLVED/.test(out), `expected the fail-closed diagnosis, got:\n${out}`)
  assert(!/PENDING-ASSEMBLE/.test(out), `nothing may be exempted with no base:\n${out}`)
})

test('GUARD 1 — a base ref that resolves but has an EMPTY shard dir also fails closed', () => {
  const { work, preChaingraphSha } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-B', 'tool_b')
  commit(work, 'art-B shard')
  const { status, out } = runGate(work, ['--base-ref', preChaingraphSha])
  assert(status === 1, `expected exit 1 for an empty base tree, got ${status}\n${out}`)
  assert(/BASE REF UNRESOLVED/.test(out), `expected the fail-closed diagnosis, got:\n${out}`)
  assert(/is empty at that ref/.test(out), `expected the empty-tree reason, got:\n${out}`)
})

test('GUARD 1 — no git at all (unpacked tree) fails closed rather than crashing', () => {
  const { tmp, work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-B', 'tool_b')
  const nogit = join(tmp, 'nogit')
  cpSync(work, nogit, { recursive: true })
  rmSync(join(nogit, '.git'), { recursive: true, force: true })
  const { status, out } = runGate(nogit, [], { GIT_CEILING_DIRECTORIES: tmp })
  assert(status === 1, `expected exit 1 with no git metadata, got ${status}\n${out}`)
  assert(/BASE REF UNRESOLVED/.test(out), `expected the fail-closed diagnosis, got:\n${out}`)
})

// ── GUARD 2 — an assembling branch gets no exemption ──────────────────────
test('GUARD 2 — a branch that edits chaingraph.meta.json is an ASSEMBLER and gets no exemption', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'assemble-land'])
  nodeShard(work, 'art-B', 'tool_b')
  // The assembler touched meta.json but forgot art-B — the exact miss that
  // put six nodes on main unregistered.
  writeJson(join(work, 'chaingraph/chaingraph.meta.json'), { order: { nodes: ['art-A'], chains: ['chain-A'], touched: true } })
  commit(work, 'assemble pass that missed art-B')
  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 on an assembling branch, got ${status}\n${out}`)
  assert(/ASSEMBLING branch/.test(out), `expected the assembler diagnosis, got:\n${out}`)
  assert(!/PENDING-ASSEMBLE/.test(out), `an assembler gets no mid-flight exemption:\n${out}`)
})

test('GUARD 2 — a shard row that has merely fallen BEHIND main is NOT mistaken for an assembler', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-B', 'tool_b')
  commit(work, 'art-B shard')
  // main advances with an unrelated registered node; the shard row does not rebase.
  git(work, ['checkout', '-q', 'main'])
  nodeShard(work, 'art-C', 'tool_c')
  writeAssembled(work, ['art-A', 'art-C'], ['chain-A'])
  commit(work, 'unrelated later land')
  git(work, ['push', '-q', 'origin', 'main'])
  git(work, ['checkout', '-q', 'shard-row'])

  const { status, out } = runGate(work)
  assert(status === 0, `a stale-but-clean shard branch must stay green, got ${status}\n${out}`)
  assert(/PENDING-ASSEMBLE/.test(out) && /art-B/.test(out), `expected art-B pending, got:\n${out}`)
  assert(!/ASSEMBLING branch/.test(out), `an out-of-date chaingraph.json is not assembly work:\n${out}`)
})

// ── NO-REGRESSION — the other two directions are untouched ────────────────
test('NO-REGRESSION — the orphan direction is NOT branch-aware and stays RED on a branch', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  rmSync(join(work, 'chaingraph/graph/nodes/art-A.json'))
  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 for a registry entry with no shard file, got ${status}\n${out}`)
  assert(/NO backing shard file/.test(out), `expected the orphan line, got:\n${out}`)
  assert(/art-A/.test(out), `expected art-A named, got:\n${out}`)
})

test('NO-REGRESSION — the chain half stays ADVISORY (unassembled chain shard, exit 0)', () => {
  const { work } = makeFixture()
  git(work, ['checkout', '-q', '-b', 'chain-row'])
  writeJson(join(work, 'chaingraph/graph/chains/chain-B.json'), { name: 'chain-B' })
  const { status, out } = runGate(work)
  assert(status === 0, `chain case is advisory, expected exit 0, got ${status}\n${out}`)
  assert(/1 chain shard\(s\) not yet in the assembled chaingraph.json/.test(out), `expected the chain line, got:\n${out}`)
})

test('NO-REGRESSION — a published unregistered shard is RED even alongside a pending one', () => {
  const { work } = makeFixture()
  nodeShard(work, 'art-LEAK', 'tool_leak')
  commit(work, 'published leak')
  git(work, ['push', '-q', 'origin', 'main'])
  git(work, ['checkout', '-q', '-b', 'shard-row'])
  nodeShard(work, 'art-NEW', 'tool_new')
  commit(work, 'new shard on the branch')
  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 — the leak must still bite, got ${status}\n${out}`)
  assert(/PENDING-ASSEMBLE/.test(out) && /art-NEW/.test(out), `expected art-NEW pending, got:\n${out}`)
  assert(/art-LEAK/.test(out), `expected art-LEAK still reported, got:\n${out}`)
  assert(/FAILING — node case is BLOCKING/.test(out), `expected the blocking verdict, got:\n${out}`)
})

// ── SCHEMA CONFORMANCE (SHARD-SCHEMA-PARITY-1) ─────────────────────────────
// Real historical content, not a synthetic reproduction (SO #40(b) — use a
// real fixture where one exists): the EXACT bytes
// chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json carried on `main`
// before ASSEMBLE-MAINSIDE-ENROLL-1 (PR #1416, commit bb8ee4e4) stripped the
// `pageless` key, retrieved via
// `git show bb8ee4e4^:chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json`.
// That defect is already fixed on `main` as of this row (bb8ee4e4 landed
// 2026-08-21, before this row was built), so it can no longer be pointed at
// live the way the row anticipated — this is the SAME real defect, preserved
// here as the regression fixture so the RED control stays provably real
// rather than invented.
const ART_662_WITH_PAGELESS = {
  tool_id: 'art-662-odnsf-fee-recompute',
  tool_version: '1.0.0',
  display_name: 'Overdraft / NSF Fee Recomputation',
  mcp_name: 'compute_odnsf_fee_recompute',
  mandate_type: 'compliance_control',
  wave: 109,
  gpu: false,
  url: 'https://ainumbers.co/tools/662-odnsf-fee-recompute.html',
  pageless:
    'No chaingraph/art-662-odnsf-fee-recompute.html node composer page — this node is presented via tools/662-odnsf-fee-recompute.html instead (see url). A chaingraph node page would trip NAV-ISLAND-1 as a new unreachable island since a shard row cannot link it from any SO #35 single-writer nav surface; that linkage is CORE-VERIFY-ASSEMBLE-LAND-1\'s to add.',
  description:
    "Independently recomputes overdraft (OD) and non-sufficient-funds (NSF) fee events from a caller-supplied posted-transaction ledger and opening balance, applying the caller's own declared posting-order policy and fee schedule, then diffs the recomputed fee totals against caller-supplied core-charged fees.",
  input_schema_ref: 'tools/662-odnsf-fee-recompute.html#manifest',
  consumes: [],
  feeds: [],
  status: 'live',
  conformance_fixtures: true,
  compute_capability: 'server',
  standards_basis: 'not_applicable',
  cited_clause_digest: [],
  compute_proof_ready: 'deferred',
  deferred_reason: 'New gpu:false node, scaffolded 2026-08-20 (KERNEL-SCAFFOLD-1).',
}
const { pageless: _droppedPageless, ...ART_662_WITHOUT_PAGELESS } = ART_662_WITH_PAGELESS

// AMENDED 2026-08-21 (SCHEMA-PAGELESS-FIELD-1): `pageless` is now a LEGAL, additive
// property on $defs.node, so art-662's pre-fix shard no longer fails schema validation —
// that is the intended new behaviour, not a regression. The gate's real contract here is
// "an unknown property is RED", so this case now uses a property that is genuinely not in
// the schema. Whether a `pageless` declaration is *honest* (pageless + a resolving page =
// HARD FAIL) is a different axis, owned by chaingraph/standard/check-pageless-consistency.mjs
// and proven in pageless-consistency.test.mjs.
const ART_662_WITH_UNKNOWN_PROP = { ...ART_662_WITHOUT_PAGELESS, not_a_real_schema_property: 'x' }

test('SCHEMA — a shard carrying an unknown property is RED, quoting the violation', () => {
  const { work } = makeFixture()
  writeJson(join(work, 'chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json'), ART_662_WITH_UNKNOWN_PROP)
  // Registered too, so registration/assembly is clean and ONLY the schema axis is under test.
  writeAssembled(work, ['art-A', 'art-662-odnsf-fee-recompute'], ['chain-A'])
  const { status, out } = runGate(work)
  assert(status === 1, `expected exit 1 for the unknown-property defect, got ${status}\n${out}`)
  assert(/FAIL v0\.4 schema validation/.test(out), `expected the schema-failure section, got:\n${out}`)
  assert(/additional property "not_a_real_schema_property" not allowed/.test(out), `expected the exact unknown-property message, got:\n${out}`)
  assert(/FAILING — schema case is BLOCKING/.test(out), `expected the blocking verdict, got:\n${out}`)
  assert(!/node shard\(s\) not yet in the assembled chaingraph\.json/.test(out), `registration axis must stay clean — only schema should fail:\n${out}`)
})

test('SCHEMA — art-662\'s shard WITH pageless is now GREEN (SCHEMA-PAGELESS-FIELD-1 made it legal)', () => {
  const { work } = makeFixture()
  writeJson(join(work, 'chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json'), ART_662_WITH_PAGELESS)
  writeAssembled(work, ['art-A', 'art-662-odnsf-fee-recompute'], ['chain-A'])
  const { status, out } = runGate(work)
  assert(status === 0, `pageless is now an additive legal property; expected exit 0, got ${status}\n${out}`)
  assert(!/additional property "pageless" not allowed/.test(out), `pageless must no longer be an unknown property:\n${out}`)
})

test('SCHEMA — the same shard with pageless removed is GREEN (the real fix, ASSEMBLE-MAINSIDE-ENROLL-1)', () => {
  const { work } = makeFixture()
  writeJson(join(work, 'chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json'), ART_662_WITHOUT_PAGELESS)
  writeAssembled(work, ['art-A', 'art-662-odnsf-fee-recompute'], ['chain-A'])
  const { status, out } = runGate(work)
  assert(status === 0, `expected exit 0 once pageless is dropped, got ${status}\n${out}`)
  assert(/check-shard-assembly: OK —/.test(out), `expected the OK line, got:\n${out}`)
})

test('SCHEMA — an unrelated, already-valid shard is unaffected — the gate was not over-tightened', () => {
  const { work } = makeFixture()
  const { status, out } = runGate(work)
  assert(status === 0, `a clean fixture must stay green under the new schema axis, got ${status}\n${out}`)
  assert(/validate against \$defs\.node/.test(out), `expected the schema axis named in the OK line, got:\n${out}`)
})

for (const dir of cleanup) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // a leftover temp dir is not a test failure
  }
}

console.log(`\ncheck-shard-assembly.test.mjs: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
