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
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GATE_SRC = resolve(__dirname, 'check-shard-assembly.mjs')
const LIB_SRC = resolve(__dirname, 'lib-shard-order.mjs')

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
const CHILD_ENV_ALLOWLIST = [
  // POSIX + Node runtime essentials
  'PATH', 'HOME', 'SHELL', 'TERM', 'TZ', 'USER', 'LOGNAME',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'XDG_CONFIG_HOME',
  // Windows runtime essentials (git.exe and node.exe both need these)
  'ALLUSERSPROFILE', 'APPDATA', 'COMPUTERNAME', 'ComSpec',
  'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432',
  'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'LOGONSERVER',
  'NUMBER_OF_PROCESSORS', 'OS', 'PATHEXT',
  'PROCESSOR_ARCHITECTURE', 'PROCESSOR_ARCHITEW6432',
  'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'PUBLIC', 'SESSIONNAME', 'SystemDrive', 'SystemRoot',
  'TEMP', 'TMP', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'windir',
]
const ALLOWED = new Set(CHILD_ENV_ALLOWLIST.map((k) => k.toLowerCase()))

// Builds the env for every child process this harness spawns. `extra` is
// applied last so a case can still set what it deliberately means to set
// (commit dates, GIT_CEILING_DIRECTORIES, the gate's own base-ref vars).
function childEnv(extra = {}) {
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (ALLOWED.has(key.toLowerCase()) && value !== undefined) env[key] = value
  }
  return { ...env, ...extra }
}

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

function nodeShard(work, id, mcpName) {
  writeJson(join(work, 'chaingraph/graph/nodes', `${id}.json`), { tool_id: id, mcp_name: mcpName ?? `tool_${id}` })
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

  // commit 0 — scripts only, no chaingraph/ yet.
  mkdirSync(join(work, 'scripts'), { recursive: true })
  cpSync(GATE_SRC, join(work, 'scripts/check-shard-assembly.mjs'))
  cpSync(LIB_SRC, join(work, 'scripts/lib-shard-order.mjs'))
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
    return { status: e.status, out: (e.stdout || '') + (e.stderr || '') }
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

for (const dir of cleanup) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // a leftover temp dir is not a test failure
  }
}

console.log(`\ncheck-shard-assembly.test.mjs: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
