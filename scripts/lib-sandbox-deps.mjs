// scripts/lib-sandbox-deps.mjs — the file set a fixture-repo harness copies into
// its throwaway sandbox, DERIVED from the real import graph instead of typed out
// by hand, plus the two assertions that name what derivation cannot see.
//
// ── WHY THIS EXISTS (SANDBOX-FILELIST-GATE-1) ─────────────────────────────
// check-shard-assembly.test.mjs and check-nav-reachability.test.mjs each build a
// throwaway git repo and run the REAL gate inside it. Until this module they did
// that by copying a HAND-MAINTAINED list of source files, and nothing checked
// that list against what the copied modules actually import. Adding one import to
// any copied module therefore killed the whole suite:
//
//   · DENOMINATOR-SENTINEL-1 (PR #1492) — schema-validate.mjs gained
//     `import { assertSsotPresentOrExit } from '../../scripts/denominator-sentinel.mjs'`
//     ⇒ 13 of 18 cases red.
//   · GIT-ENV-LEAK-SWEEP-1 (PR #1498) — check-shard-assembly.mjs gained
//     `import { gitEnv } from './_git-env-lib.mjs'`
//     ⇒ all 18 cases ERR_MODULE_NOT_FOUND.
//
// Both were fixed by adding the missing filename to the list, which is why it
// happened twice. Both were caught by a before/after diff rather than by the
// change itself, which is the dangerous part: a broken sandbox does not announce
// itself as lost coverage. On check-shard-assembly.test.mjs it reads as 18
// unrelated case failures; on check-nav-reachability.test.mjs it is worse still,
// because the gate under test SWALLOWS the sub-gate crash and returns a
// confident, wrong verdict ("1 NEW island(s)") with no mention of a missing
// module anywhere in the output. A session that did not happen to diff would
// have shipped a dead suite reading as a pass.
//
// ── DERIVE, NOT GATE, AND WHY ─────────────────────────────────────────────
// The row offered two shapes: DERIVE the list from the import graph, or GATE the
// hand-maintained list against it. This module DERIVES, because the graph is
// shallow and entirely static — measured, not assumed:
//
//   check-shard-assembly.mjs -> _git-env-lib.mjs, lib-shard-order.mjs
//   schema-validate.mjs      -> denominator-sentinel.mjs -> _git-env-lib.mjs
//   check-nav-reachability.mjs -> (node: builtins only)
//
// Five modules, depth 2, zero dynamic import(), zero bare specifiers, zero
// re-exports. Derivation therefore pulls in exactly the files the hand list
// already named and nothing else, and the list stops being hand-maintained AT
// ALL — the defect class is gone by construction rather than merely made loud.
// A gate would have left the list in place and only shouted when it went stale,
// which is strictly weaker for the same amount of code (STANDING-ORDERS #0b:
// prefer generated over hand-maintained). Gating is the right call when
// derivation would pull a large or dynamic tree; here it would pull five files.
//
// ── WHAT DERIVATION CANNOT SEE, STATED PLAINLY ────────────────────────────
// Static imports are derivable. Two things are not, and both are handled by
// naming rather than by guessing:
//
//  1. SHELL-OUT TARGETS. check-shard-assembly.mjs spawns
//     `node chaingraph/standard/schema-validate.mjs`, and check-nav-reachability
//     .mjs spawns `node scripts/check-shard-assembly.mjs`. Those are execFileSync
//     calls, not imports, so a harness declares them as ROOTS. Deriving them from
//     `.mjs` string literals was tried and rejected: denominator-sentinel.mjs
//     carries the literals 'golden-parity.test.mjs' and 'determinism-replay
//     .test.mjs' as DATA it looks for, and _git-env-lib.mjs names
//     'check-git-env-scrub.mjs' inside a help string. A literal-scanning rule
//     would demand those be copied too — a false RED, needing an exemption list,
//     which is the hand-maintained surface this module exists to delete.
//     The roots list is 2-3 lines and its breakage shape is different (the copy
//     itself throws ENOENT naming the path), so it stays declared.
//
//  2. NON-MODULE DATA READ AT RUNTIME, e.g. openchain-graph-v0.4.schema.json,
//     which schema-validate.mjs readFileSync()s. Declared as `extras`. A missing
//     one produces a direct "cannot read file" from the gate, never
//     ERR_MODULE_NOT_FOUND, so it is not this defect class.
//
// Everything else is derived, and every residual is converted into a NAMED
// diagnosis by the two assertions below rather than left as a bare
// ERR_MODULE_NOT_FOUND.
//
// Zero-dep, node: builtins only. Proven in scripts/lib-sandbox-deps.test.mjs.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(__dirname, '..')

const BUILTINS = new Set(builtinModules)

const toPosix = (p) => p.split(sep).join('/')

// ── SPECIFIER EXTRACTION ──────────────────────────────────────────────────
// Regex rather than a parser because the repo is zero-dep and always will be
// (STANDING-ORDERS #10). Every pattern is anchored at STATEMENT position, so a
// commented-out import (`// import x from 'y'`) and a JSDoc line (` * import ...`)
// cannot match: neither starts with optional whitespace then `import`/`export`.
//
// The clause between `import` and `from` is restricted to characters that can
// legally appear in an import clause — identifiers, braces, commas, `*`, and
// whitespace. That deliberately excludes quotes, parens and `;`, so the lazy
// match cannot run away past the end of a statement and pair the wrong specifier
// with the wrong importer. Whitespace is included, so multi-line
// `import {\n  a,\n  b,\n} from './x.mjs'` is matched.
const RE_FROM = /^[ \t]*(?:import|export)[ \t]+[A-Za-z0-9_$,{}*\s]*?from[ \t]*(['"])([^'"\n]+)\1/gm
const RE_SIDE_EFFECT = /^[ \t]*import[ \t]*(['"])([^'"\n]+)\1/gm
const RE_DYNAMIC_LITERAL = /\bimport[ \t]*\([ \t]*(['"])([^'"\n]+)\1[ \t]*\)/g
// A dynamic import whose argument is not a string literal. Its target is not
// knowable without executing the module, so derivation refuses rather than
// guessing (SO #34c — absence is a distinct state, never a green one).
const RE_DYNAMIC_COMPUTED = /\bimport[ \t]*\([ \t]*(?!['"])[^)\n]/g

// A line that is visually a comment. Used only to keep the computed-dynamic scan
// (the one pattern that cannot be anchored at statement position, because
// `await import(x)` is an expression) from firing on prose.
const looksLikeComment = (line) => {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/**
 * Every module specifier `source` imports, plus whether it contains a dynamic
 * import() whose target cannot be resolved statically.
 * Exported so the self-test can drive it directly.
 */
export function parseImportSpecifiers(source) {
  const specs = []
  for (const re of [RE_FROM, RE_SIDE_EFFECT, RE_DYNAMIC_LITERAL]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(source)) !== null) specs.push(m[2])
  }
  let computedDynamic = false
  RE_DYNAMIC_COMPUTED.lastIndex = 0
  let d
  while ((d = RE_DYNAMIC_COMPUTED.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', d.index) + 1
    let lineEnd = source.indexOf('\n', d.index)
    if (lineEnd === -1) lineEnd = source.length
    if (!looksLikeComment(source.slice(lineStart, lineEnd))) computedDynamic = true
  }
  return { specs: [...new Set(specs)], computedDynamic }
}

const isModule = (rel) => /\.(mjs|cjs|js)$/.test(rel)

// ── DERIVATION ────────────────────────────────────────────────────────────
/**
 * The repo-relative POSIX paths a fixture repo must contain: the declared
 * execution roots, the transitive closure of their static relative imports, and
 * any declared non-module extras. Sorted, de-duplicated, deterministic.
 *
 * Throws a NAMED error — never a bare ERR_MODULE_NOT_FOUND — for anything it
 * cannot derive, so a future import that breaks derivation fails at the
 * derivation, before a single test case has run.
 */
export function deriveSandboxFiles({ roots, extras = [], repoRoot = REPO_ROOT }) {
  const seen = new Set()
  const queue = [...roots]

  while (queue.length) {
    const rel = queue.shift()
    if (seen.has(rel)) continue
    const abs = resolve(repoRoot, rel)
    if (!existsSync(abs)) {
      throw new Error(`sandbox list cannot be derived: declared root ${rel} does not exist in the repository`)
    }
    seen.add(rel)
    if (!isModule(rel)) continue

    const { specs, computedDynamic } = parseImportSpecifiers(readFileSync(abs, 'utf8'))
    if (computedDynamic) {
      throw new Error(
        `sandbox list cannot be derived: ${rel} uses a computed dynamic import(), whose target is not knowable ` +
          `without running the module. Give it a string-literal specifier, or declare the target as a root in the harness.`
      )
    }

    for (const spec of specs) {
      if (spec.startsWith('node:') || BUILTINS.has(spec)) continue
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        throw new Error(
          `sandbox list cannot be derived: ${rel} imports bare specifier "${spec}". A throwaway fixture repo has no ` +
            `node_modules, so nothing can supply it (the site repo is zero-dep by contract, STANDING-ORDERS #10).`
        )
      }
      const targetAbs = resolve(dirname(abs), spec)
      const targetRel = toPosix(relative(repoRoot, targetAbs))
      if (targetRel.startsWith('..')) {
        throw new Error(
          `sandbox list cannot be derived: ${rel} imports "${spec}", which resolves outside the repository ` +
            `(${targetRel}) and therefore cannot be copied into a fixture.`
        )
      }
      if (!existsSync(targetAbs)) {
        throw new Error(`sandbox list is missing ${targetRel}, imported by ${rel} — no such file in the repository`)
      }
      queue.push(targetRel)
    }
  }

  for (const rel of extras) {
    if (!existsSync(resolve(repoRoot, rel))) {
      throw new Error(`sandbox list cannot be derived: declared extra ${rel} does not exist in the repository`)
    }
    seen.add(rel)
  }

  return [...seen].sort()
}

// ── ASSERTION 1: the BUILT sandbox is import-complete ──────────────────────
function walkModules(root, acc = [], base = root) {
  for (const entry of readdirSync(root)) {
    if (entry === '.git' || entry === 'node_modules') continue
    const abs = resolve(root, entry)
    if (statSync(abs).isDirectory()) walkModules(abs, acc, base)
    else if (isModule(entry)) acc.push(abs)
  }
  return acc
}

/**
 * Reads the sandbox that was ACTUALLY built and asserts every relative import in
 * it resolves inside it. Deliberately independent of deriveSandboxFiles(): it
 * never consults the derived list, only the tree on disk, so a blind spot in the
 * derivation parser cannot also blind the check (STANDING-ORDERS #34 —
 * a gate may not read the value it validates from the artifact under test).
 *
 * Returns null when the sandbox is complete, otherwise the named diagnosis.
 */
export function checkSandboxComplete(sandboxRoot, expected = []) {
  for (const rel of expected) {
    if (!existsSync(resolve(sandboxRoot, rel))) {
      return `sandbox copy incomplete: ${rel} was derived but never written into the fixture at ${sandboxRoot}`
    }
  }
  for (const abs of walkModules(sandboxRoot)) {
    const importerRel = toPosix(relative(sandboxRoot, abs))
    const { specs, computedDynamic } = parseImportSpecifiers(readFileSync(abs, 'utf8'))
    if (computedDynamic) {
      return `sandbox list cannot be verified: ${importerRel} uses a computed dynamic import(), whose target cannot be checked`
    }
    for (const spec of specs) {
      if (spec.startsWith('node:') || BUILTINS.has(spec)) continue
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        return `sandbox list is missing "${spec}", imported by ${importerRel} — a bare specifier a fixture repo cannot supply`
      }
      const targetAbs = resolve(dirname(abs), spec)
      if (!existsSync(targetAbs)) {
        const targetRel = toPosix(relative(sandboxRoot, targetAbs))
        return `sandbox list is missing ${targetRel}, imported by ${importerRel}`
      }
    }
  }
  return null
}

/**
 * checkSandboxComplete() with the repo's established fail-fast idiom
 * (cf. denominator-sentinel.mjs's assertSsotPresentOrExit): print the named
 * cause ONCE and exit non-zero, rather than let the same defect resurface as N
 * unrelated-looking case failures with the real reason nowhere in the output.
 */
export function assertSandboxCompleteOrExit(sandboxRoot, expected = [], harness = 'harness') {
  const problem = checkSandboxComplete(sandboxRoot, expected)
  if (!problem) return
  console.error(`\n${harness}: FIXTURE SANDBOX IS INCOMPLETE — the cases below would have failed for this reason, not yours.`)
  console.error(`  ${problem}`)
  console.error(
    `  Fix: the sandbox file set is DERIVED from the harness's declared roots by scripts/lib-sandbox-deps.mjs.\n` +
      `  If the module above is reached by a static import, it should already be copied — see that file's header for\n` +
      `  the two things derivation cannot see (shell-out targets, runtime data files), which are declared instead.`
  )
  process.exit(1)
}

// ── ASSERTION 2: translate a child's ERR_MODULE_NOT_FOUND ─────────────────
const RE_NOT_FOUND = /Cannot find module '([^']+)'(?:\s+imported from\s+(\S+))?/
const RE_NOT_FOUND_DQ = /Cannot find (?:module|package) "([^"]+)"/

/**
 * Node's own module-not-found text already names BOTH halves the row requires —
 * the missing module and the file that imported it. Anything a sandboxed child
 * process emits therefore gets rewritten into the same named sentence the
 * assertions above use, so "never a bare ERR_MODULE_NOT_FOUND" holds for
 * failures that escape the pre-run check too (a missing SHELL-OUT root, for
 * instance, which is not an import and so is invisible to derivation).
 *
 * Returns null when the output carries no module-not-found.
 */
export function namedModuleNotFound(output, sandboxRoot) {
  if (!output) return null
  const m = RE_NOT_FOUND.exec(output) || RE_NOT_FOUND_DQ.exec(output)
  if (!m) return null
  const rel = (p) => {
    if (!p) return null
    const clean = p.replace(/^file:\/\/\/?/, '').replace(/[)\s]+$/, '')
    if (!sandboxRoot) return clean
    const r = toPosix(relative(sandboxRoot, resolve(clean)))
    return r && !r.startsWith('..') ? r : clean
  }
  const missing = rel(m[1])
  const importer = rel(m[2])
  return importer
    ? `sandbox list is missing ${missing}, imported by ${importer}`
    : `sandbox list is missing ${missing}, required by the fixture (a shell-out target or entry script, not an import)`
}
