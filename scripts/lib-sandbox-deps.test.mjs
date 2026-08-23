#!/usr/bin/env node
// scripts/lib-sandbox-deps.test.mjs — RED/GREEN proof for SANDBOX-FILELIST-GATE-1.
//
// WHAT THIS PROVES. scripts/lib-sandbox-deps.mjs replaced the hand-maintained
// copy lists in check-shard-assembly.test.mjs and check-nav-reachability.test.mjs
// with a derivation over the real import graph. Three claims need to be RED
// before they can be trusted GREEN (SO #34c — a gate never seen red is not a
// gate; SO #40(b) — prove RED before GREEN):
//
//   1. THE HISTORICAL DEFECT IS DEAD BY CONSTRUCTION. Adding an import to a
//      copied module used to require a matching edit to a hand list; twice it
//      did not get one and 18 cases died. Here the derived closure simply grows.
//   2. WHEN SOMETHING IS MISSING, THE ERROR NAMES IT. The output must read
//      "sandbox list is missing <module>, imported by <file>", never a bare
//      ERR_MODULE_NOT_FOUND, because 18 unrelated-looking case failures read as
//      "my change broke everything" and invite the wrong fix.
//   3. WHAT DERIVATION CANNOT FOLLOW FAILS CLOSED, BY NAME. A computed dynamic
//      import, a bare specifier, an import escaping the repo: each refuses with
//      a diagnosis rather than quietly producing a short list.
//
// Plus a live parity check that the derived set for BOTH real harnesses is
// exactly the set their hand-maintained lists named on the day this landed, so
// the conversion demonstrably changed no coverage.
//
// Zero-dep, node: builtins only.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  checkSandboxComplete,
  deriveSandboxFiles,
  namedModuleNotFound,
  parseImportSpecifiers,
  REPO_ROOT,
} from './lib-sandbox-deps.mjs'

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
function threw(fn) {
  try {
    fn()
  } catch (e) {
    return e.message
  }
  return null
}

function scratch(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  cleanup.push(dir)
  return dir
}
function write(root, rel, body) {
  const abs = join(root, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, body, 'utf8')
  return abs
}

console.log('lib-sandbox-deps.test.mjs — derived sandbox file set (SANDBOX-FILELIST-GATE-1)')

// ── 1. THE HISTORICAL DEFECT, REPLAYED ────────────────────────────────────
// GIT-ENV-LEAK-SWEEP-1's exact shape: a copied module gains one sibling import.
test('CLASS KILLED — a newly added sibling import joins the derived set with no list edit', () => {
  const repo = scratch('sbx-grow-')
  write(repo, 'scripts/gate.mjs', "import { readFileSync } from 'node:fs'\nvoid readFileSync\n")
  const before = deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo })
  assert(before.length === 1 && before[0] === 'scripts/gate.mjs', `expected only the root, got ${JSON.stringify(before)}`)

  // The mutation that broke the suite twice: one import added to a copied file.
  write(repo, 'scripts/_new-sibling.mjs', 'export const X = 1\n')
  write(repo, 'scripts/gate.mjs', "import { X } from './_new-sibling.mjs'\nvoid X\n")
  const after = deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo })
  assert(after.includes('scripts/_new-sibling.mjs'), `the new import must be derived, got ${JSON.stringify(after)}`)
  assert(after.length === 2, `expected exactly root + sibling, got ${JSON.stringify(after)}`)
})

test('CLASS KILLED — derivation is TRANSITIVE (the DENOMINATOR-SENTINEL-1 shape, two hops)', () => {
  const repo = scratch('sbx-deep-')
  write(repo, 'scripts/gate.mjs', "import './mid.mjs'\n")
  write(repo, 'scripts/mid.mjs', "import { L } from '../lib/leaf.mjs'\nvoid L\n")
  write(repo, 'lib/leaf.mjs', 'export const L = 1\n')
  const set = deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo })
  assert(
    JSON.stringify(set) === JSON.stringify(['lib/leaf.mjs', 'scripts/gate.mjs', 'scripts/mid.mjs']),
    `expected the full two-hop closure, got ${JSON.stringify(set)}`
  )
})

test('CLASS KILLED — a cycle terminates instead of hanging', () => {
  const repo = scratch('sbx-cycle-')
  write(repo, 'scripts/a.mjs', "import './b.mjs'\n")
  write(repo, 'scripts/b.mjs', "import './a.mjs'\n")
  const set = deriveSandboxFiles({ roots: ['scripts/a.mjs'], repoRoot: repo })
  assert(set.length === 2, `expected both files once each, got ${JSON.stringify(set)}`)
})

// ── 2. RED — THE MISSING MODULE AND ITS IMPORTER ARE NAMED ────────────────
// This is the sentence the row requires, proven against a sandbox in exactly the
// state the two incidents produced: a copied module whose import is not there.
test('RED — checkSandboxComplete names the missing module AND its importer', () => {
  const sandbox = scratch('sbx-missing-')
  write(sandbox, 'scripts/check-shard-assembly.mjs', "import { gitEnv } from './_git-env-lib.mjs'\nvoid gitEnv\n")
  // _git-env-lib.mjs deliberately NOT written — PR #1498's exact state.
  const problem = checkSandboxComplete(sandbox)
  assert(problem !== null, 'a sandbox missing an imported module must not read as complete')
  assert(
    problem === 'sandbox list is missing scripts/_git-env-lib.mjs, imported by scripts/check-shard-assembly.mjs',
    `expected the named diagnosis verbatim, got: ${problem}`
  )
  assert(!/ERR_MODULE_NOT_FOUND/.test(problem), `the diagnosis must not be a bare node error: ${problem}`)
})

test('RED — a cross-directory miss is named with both repo-relative paths', () => {
  const sandbox = scratch('sbx-cross-')
  write(
    sandbox,
    'chaingraph/standard/schema-validate.mjs',
    "import { assertSsotPresentOrExit } from '../../scripts/denominator-sentinel.mjs'\nvoid assertSsotPresentOrExit\n"
  )
  const problem = checkSandboxComplete(sandbox)
  assert(
    problem === 'sandbox list is missing scripts/denominator-sentinel.mjs, imported by chaingraph/standard/schema-validate.mjs',
    `expected PR #1492's shape named on both halves, got: ${problem}`
  )
})

test('GREEN — the same sandbox with the module present reads complete', () => {
  const sandbox = scratch('sbx-complete-')
  write(sandbox, 'scripts/check-shard-assembly.mjs', "import { gitEnv } from './_git-env-lib.mjs'\nvoid gitEnv\n")
  write(sandbox, 'scripts/_git-env-lib.mjs', 'export const gitEnv = () => ({})\n')
  assert(checkSandboxComplete(sandbox) === null, 'a complete sandbox must read complete')
})

test('RED — an expected file that never got written is named as a copy failure', () => {
  const sandbox = scratch('sbx-nocopy-')
  write(sandbox, 'scripts/gate.mjs', 'export const x = 1\n')
  const problem = checkSandboxComplete(sandbox, ['scripts/gate.mjs', 'chaingraph/standard/schema.json'])
  assert(/^sandbox copy incomplete: chaingraph\/standard\/schema\.json /.test(problem), `expected the copy-failure line, got: ${problem}`)
})

// ── 3. RED — WHAT DERIVATION CANNOT FOLLOW FAILS CLOSED, BY NAME ──────────
test('RED — a computed dynamic import() refuses rather than deriving a short list', () => {
  const repo = scratch('sbx-dyn-')
  write(repo, 'scripts/gate.mjs', "const n = './plug' + '.mjs'\nconst m = await import(n)\nvoid m\n")
  const msg = threw(() => deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo }))
  assert(msg !== null, 'a computed dynamic import must not silently derive a short list')
  assert(/^sandbox list cannot be derived: scripts\/gate\.mjs uses a computed dynamic import\(\)/.test(msg), `got: ${msg}`)
})

test('GREEN — a dynamic import() with a STRING LITERAL is followed, not refused', () => {
  const repo = scratch('sbx-dynlit-')
  write(repo, 'scripts/gate.mjs', "const m = await import('./plug.mjs')\nvoid m\n")
  write(repo, 'scripts/plug.mjs', 'export const p = 1\n')
  const set = deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo })
  assert(set.includes('scripts/plug.mjs'), `a literal dynamic import is derivable, got ${JSON.stringify(set)}`)
})

test('RED — a bare specifier refuses, naming the specifier and the importer', () => {
  const repo = scratch('sbx-bare-')
  write(repo, 'scripts/gate.mjs', "import { z } from 'some-package'\nvoid z\n")
  const msg = threw(() => deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo }))
  assert(/scripts\/gate\.mjs imports bare specifier "some-package"/.test(msg), `got: ${msg}`)
})

test('RED — a relative import with no file behind it is named, not left to ESM', () => {
  const repo = scratch('sbx-ghost-')
  write(repo, 'scripts/gate.mjs', "import './ghost.mjs'\n")
  const msg = threw(() => deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo }))
  assert(
    /^sandbox list is missing scripts\/ghost\.mjs, imported by scripts\/gate\.mjs/.test(msg),
    `expected the same named sentence at derivation time, got: ${msg}`
  )
})

test('RED — an import escaping the repository root refuses', () => {
  const repo = scratch('sbx-escape-')
  write(repo, 'scripts/gate.mjs', "import '../../outside.mjs'\n")
  const msg = threw(() => deriveSandboxFiles({ roots: ['scripts/gate.mjs'], repoRoot: repo }))
  assert(/resolves outside the repository/.test(msg), `got: ${msg}`)
})

test('RED — a declared root that does not exist refuses at derivation', () => {
  const repo = scratch('sbx-noroot-')
  const msg = threw(() => deriveSandboxFiles({ roots: ['scripts/nope.mjs'], repoRoot: repo }))
  assert(/declared root scripts\/nope\.mjs does not exist/.test(msg), `got: ${msg}`)
})

test('RED — a declared extra that does not exist refuses at derivation', () => {
  const repo = scratch('sbx-noextra-')
  write(repo, 'scripts/gate.mjs', 'export const x = 1\n')
  const msg = threw(() => deriveSandboxFiles({ roots: ['scripts/gate.mjs'], extras: ['data/nope.json'], repoRoot: repo }))
  assert(/declared extra data\/nope\.json does not exist/.test(msg), `got: ${msg}`)
})

// ── 4. THE PARSER'S OWN EDGES ─────────────────────────────────────────────
test('PARSER — multi-line, star, side-effect, and export-from specifiers are all seen', () => {
  const src = [
    "import {",
    "  a,",
    "  b,",
    "} from './multi.mjs'",
    "import * as ns from './star.mjs'",
    "import './side-effect.mjs'",
    "export { c } from './re-export.mjs'",
    "export * from './star-export.mjs'",
    "import def from './default.mjs'",
  ].join('\n')
  const { specs } = parseImportSpecifiers(src)
  for (const want of ['./multi.mjs', './star.mjs', './side-effect.mjs', './re-export.mjs', './star-export.mjs', './default.mjs']) {
    assert(specs.includes(want), `expected ${want} in ${JSON.stringify(specs)}`)
  }
})

test('PARSER — a commented-out import is NOT treated as a dependency', () => {
  const src = "// import { x } from './commented.mjs'\n *  import { y } from './jsdoc.mjs'\nexport const z = 1\n"
  const { specs } = parseImportSpecifiers(src)
  assert(specs.length === 0, `comments must not produce dependencies, got ${JSON.stringify(specs)}`)
})

test('PARSER — a side-effect import does not swallow a later unrelated `from`', () => {
  // The runaway-lazy-match hazard: without the restricted clause class, the
  // side-effect import on line 1 could pair with the `from` several lines down.
  const src = "import './first.mjs'\n\nconst msg = 'copied from the spec'\nimport { q } from './second.mjs'\n"
  const { specs } = parseImportSpecifiers(src)
  assert(specs.includes('./first.mjs') && specs.includes('./second.mjs'), `got ${JSON.stringify(specs)}`)
  assert(specs.length === 2, `exactly two specifiers expected, got ${JSON.stringify(specs)}`)
})

test('PARSER — import.meta is not mistaken for a dynamic import', () => {
  const { computedDynamic } = parseImportSpecifiers('const d = import.meta.url\nvoid d\n')
  assert(computedDynamic === false, 'import.meta must not read as a computed dynamic import')
})

// ── 5. THE ERR_MODULE_NOT_FOUND TRANSLATION ───────────────────────────────
test('TRANSLATION — node\'s own ERR_MODULE_NOT_FOUND becomes the named sentence', () => {
  const sandboxRoot = join(tmpdir(), 'work')
  const nodeText =
    "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '" +
    join(sandboxRoot, 'scripts', '_git-env-lib.mjs') +
    "' imported from " +
    join(sandboxRoot, 'scripts', 'check-shard-assembly.mjs') +
    '\n    at finalizeResolution (node:internal/modules/esm/resolve:271:11)\n'
  const named = namedModuleNotFound(nodeText, sandboxRoot)
  assert(
    named === 'sandbox list is missing scripts/_git-env-lib.mjs, imported by scripts/check-shard-assembly.mjs',
    `expected the named sentence, got: ${named}`
  )
})

test('TRANSLATION — a missing SHELL-OUT target (no importer) is still named', () => {
  const sandboxRoot = join(tmpdir(), 'work')
  const nodeText = "Error: Cannot find module '" + join(sandboxRoot, 'scripts', 'check-shard-assembly.mjs') + "'\n"
  const named = namedModuleNotFound(nodeText, sandboxRoot)
  assert(/^sandbox list is missing scripts\/check-shard-assembly\.mjs, required by the fixture/.test(named), `got: ${named}`)
})

test('TRANSLATION — ordinary gate output is left alone', () => {
  assert(namedModuleNotFound('check-shard-assembly: OK — 1 node shard(s)\n', '/tmp/work') === null, 'no false positive on normal output')
  assert(namedModuleNotFound('', '/tmp/work') === null, 'empty output is not a module-not-found')
})

// ── 6. LIVE PARITY WITH THE TWO REAL HARNESSES ────────────────────────────
// ZERO COVERAGE CHANGE, mechanically: the derived set must equal the set the
// hand-maintained lists named on the day this row landed. Recorded here as
// literals so a future silent DROP from the closure (which would quietly shrink
// a fixture repo) reds, not merely a future addition.
test('PARITY — check-shard-assembly.test.mjs derives exactly its former hand list', () => {
  const set = deriveSandboxFiles({
    roots: ['scripts/check-shard-assembly.mjs', 'chaingraph/standard/schema-validate.mjs'],
    extras: ['chaingraph/standard/openchain-graph-v0.4.schema.json'],
    repoRoot: REPO_ROOT,
  })
  const expected = [
    'chaingraph/standard/openchain-graph-v0.4.schema.json',
    'chaingraph/standard/schema-validate.mjs',
    'scripts/_git-env-lib.mjs',
    'scripts/check-shard-assembly.mjs',
    'scripts/denominator-sentinel.mjs',
    'scripts/lib-shard-order.mjs',
  ]
  assert(JSON.stringify(set) === JSON.stringify(expected), `derived set drifted from the pre-conversion list:\n  got      ${JSON.stringify(set)}\n  expected ${JSON.stringify(expected)}`)
})

test('PARITY — check-nav-reachability.test.mjs derives exactly its former hand list', () => {
  const set = deriveSandboxFiles({
    roots: ['scripts/check-nav-reachability.mjs', 'scripts/check-shard-assembly.mjs', 'chaingraph/standard/schema-validate.mjs'],
    extras: ['chaingraph/standard/openchain-graph-v0.4.schema.json'],
    repoRoot: REPO_ROOT,
  })
  const expected = [
    'chaingraph/standard/openchain-graph-v0.4.schema.json',
    'chaingraph/standard/schema-validate.mjs',
    'scripts/_git-env-lib.mjs',
    'scripts/check-nav-reachability.mjs',
    'scripts/check-shard-assembly.mjs',
    'scripts/denominator-sentinel.mjs',
    'scripts/lib-shard-order.mjs',
  ]
  assert(JSON.stringify(set) === JSON.stringify(expected), `derived set drifted from the pre-conversion list:\n  got      ${JSON.stringify(set)}\n  expected ${JSON.stringify(expected)}`)
})

for (const dir of cleanup) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // a leftover temp dir is not a test failure
  }
}

console.log(`\nlib-sandbox-deps.test.mjs: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
