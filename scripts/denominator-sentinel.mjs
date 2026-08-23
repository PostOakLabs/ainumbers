#!/usr/bin/env node
// denominator-sentinel.mjs — the shared, HARD-FAILING scope assert that a counting gate calls
// AT ITS POINT OF CHECK (DENOMINATOR-SENTINEL-1; gate-integrity audit findings F-01…F-06 and F-08).
//
// ⛔⛔ THE DEFECT THIS EXISTS TO KILL — "the vacuous pass".
// A sweep gate globs a directory, counts what it found, checks each one, and reports the result. When
// the glob finds nothing, every one of those gates printed a GREEN line and exited 0:
//
//     run-proptests: 0 property files found — no-op PASS.            ⛔ 634 floors, renamed away
//     ✓ proof-surface gate GREEN — all 0 emitters carry the surface  ⛔ page dirs moved
//     ✓ deadline-freshness gate clean — 0 entries                    ⛔ `entries` emptied in place
//     ! chaingraph.json not found at …   → 0 failed → exit 0         ⛔ the SSOT itself gone
//     ✓ golden parity clean — 0 vector(s)                            ⛔ nothing hashed at all
//
// ⇒ ⭐ "0 of 0 passed" is byte-indistinguishable from real coverage in a CI log. The gate did not fail.
// It stopped examining anything, and its output still read green. One rename, one emptied array, one
// moved SSOT file, and a control that covered the whole estate silently covers nothing.
//
// ⚖ THIS IS SO #34c AT THE SCOPE BOUNDARY — "absence is not a pass". A gate that checked zero things
// produced no gate result; a missing result is a DISTINCT state, never a green one. And it is SO #34's
// independent-derivation rule applied to the denominator itself: where a floor can be recomputed from a
// primary source (git's index, for the committed floor-file count) it is recomputed, never read back out
// of the very directory whose disappearance is the failure being detected.
//
// ✅ THE HARD-FAIL STATES (each names itself in the message, so a CI log says WHICH one fired):
//   EMPTY-SCOPE            the gate examined ZERO units. The headline state — "0 of 0 passed".
//   BELOW-FLOOR            it examined some, but fewer than the floor its own scope guarantees.
//   BAD-FLOOR              a side of the comparison is not a valid count (a floor of 0 is not a floor:
//                          it is the vacuous pass this module exists to refuse, spelled as a constant).
//   UNDETERMINABLE-FLOOR   the floor had to be derived and could not be. ⛔ Not a licence to pass —
//                          an unknown denominator is exactly as uninformative as an empty one.
//   MISSING-SSOT           a single required input document (not a swept set) is absent.
//   ZERO-VECTOR-FIXTURE    a present corpus file that contributes zero usable vectors. ⭐ The exact hole
//                          the row names: a file that LOOKS like coverage and contributes none.
//
// ⚖ SCOPE — ⛔ this module is for DENOMINATOR ASSERTS ONLY: "did this gate actually examine anything,
// and enough of it?" It is not a general precondition helper and it is not the ratchet-baseline loader.
// Its sibling scripts/ratchet-baseline.mjs answers a different question — "does this gate still have a
// valid CEILING to compare against?" — and the two are deliberately not merged: a ratchet baseline is a
// pinned file with required keys, a denominator is a live count recomputed every run. The test for
// whether a call belongs here: if this number went to 0, would the gate still print green? If yes,
// assert it here, at the line where the count is taken.
//
// ⛔ AND ASSERT IT AT THE POINT OF CHECK, NEVER IN A WRAPPER. A preflight-level or workflow-level
// "did that gate print a number" wrapper is a second, ungoverned copy of the gate's own scope rule, and
// it goes stale the moment the gate's scope changes. Every export below is called from inside the gate,
// on the same line the count is computed.
//
// Zero-dependency. Self-test (SO #40(b), RED before GREEN): scripts/denominator-sentinel.test.mjs.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

// ── DenominatorSentinelError ─────────────────────────────────────────────────────────────────────
// Carries the machine-readable `state` alongside the human message, so the self-test asserts on the
// STATE (a stable contract) rather than on message wording (prose, and improvable).
export class DenominatorSentinelError extends Error {
  constructor(state, message) {
    super(message);
    this.name = 'DenominatorSentinelError';
    this.state = state;
  }
}

export const DENOMINATOR_SENTINEL_STATES = Object.freeze([
  'EMPTY-SCOPE',
  'BELOW-FLOOR',
  'BAD-FLOOR',
  'UNDETERMINABLE-FLOOR',
  'MISSING-SSOT',
  'ZERO-VECTOR-FIXTURE',
]);

const isCount = (n) => typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0;

// The common tail on every hard-fail message: what this state means and how to get out of it.
function tailFor({ label, remedy }) {
  return [
    `  A denominator is a CONTROL, not a progress figure: a gate that examined nothing has produced NO`,
    `  result, and printing its usual green line over that is a silently-disabled control`,
    `  (SO #34c — absence is not a pass). "0 of 0 passed" reads identically to full coverage in a CI log,`,
    `  which is why ${label} now refuses it instead of reporting it (DENOMINATOR-SENTINEL-1, findings F-01…F-06).`,
    `  Fix, in order of likelihood:`,
    `    1. ${remedy}`,
    `    2. The scope genuinely shrank on purpose — then the floor this gate derives must move WITH it,`,
    `       in the same reviewed diff, so the shrink is visible rather than silent.`,
    `  ⛔ Do NOT "fix" this by lowering the floor to 0 or making ${label} tolerate an empty scope again.`,
  ].join('\n');
}

// ── assertDenominator ────────────────────────────────────────────────────────────────────────────
// THE primitive. `observed` is what the gate actually examined; `floor` is the minimum its own scope
// guarantees. Returns `observed` on success so it can be used inline at the counting site.
//
// ⭐ BOUNDARY, pinned deliberately: the comparison is `observed < floor`, so exactly-at-threshold
// PASSES and one below FAILS. A floor of N means "N is still full coverage", not "more than N".
export function assertDenominator(observed, floor, { label, unit, scope, remedy }) {
  const tail = tailFor({ label, remedy });

  if (!isCount(floor) || floor < 1) {
    throw new DenominatorSentinelError('BAD-FLOOR',
      `✗ DENOMINATOR BAD-FLOOR — ${label}: floor must be a whole number of ${unit} that is at least 1, got ${JSON.stringify(floor)} (${typeof floor}).\n` +
      `  A floor of 0 is not a floor — it is the vacuous pass this sentinel exists to refuse, written as a constant.\n${tail}`);
  }
  if (!isCount(observed)) {
    throw new DenominatorSentinelError('BAD-FLOOR',
      `✗ DENOMINATOR BAD-FLOOR — ${label}: observed count must be a whole number of ${unit}, got ${JSON.stringify(observed)} (${typeof observed}).\n` +
      `  A count this gate cannot state is a count it cannot have checked.\n${tail}`);
  }

  if (observed === 0) {
    throw new DenominatorSentinelError('EMPTY-SCOPE',
      `✗ DENOMINATOR EMPTY-SCOPE — ${label}: examined 0 ${unit}. The denominator is EMPTY.\n` +
      `  Scope: ${scope}\n` +
      `  Expected at least ${floor} ${unit}. "0 of 0 passed" is not a pass — this gate checked nothing at all.\n${tail}`);
  }
  if (observed < floor) {
    throw new DenominatorSentinelError('BELOW-FLOOR',
      `✗ DENOMINATOR BELOW-FLOOR — ${label}: examined ${observed} ${unit}, floor is ${floor}. ${floor - observed} ${unit} vanished from scope.\n` +
      `  Scope: ${scope}\n` +
      `  The gate would have reported ${observed}/${observed} green while ${floor - observed} ${unit} went unchecked.\n${tail}`);
  }
  return observed;
}

// ── assertSsotPresent ────────────────────────────────────────────────────────────────────────────
// For the degenerate denominator: ONE required input document, where "the file moved" is the whole
// failure. `existsSync(x) ? check(x) : console.error('! not found')` is the same silent-green shape with
// a denominator of one.
export function assertSsotPresent(path, { label, what, remedy }) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new DenominatorSentinelError('MISSING-SSOT',
      `✗ DENOMINATOR MISSING-SSOT — ${label}: no path resolved for ${what}.\n${tailFor({ label, remedy })}`);
  }
  if (!existsSync(path)) {
    throw new DenominatorSentinelError('MISSING-SSOT',
      `✗ DENOMINATOR MISSING-SSOT — ${label}: ${what} not found at ${path}.\n` +
      `  This gate's entire subject is that document. Absent, it validates nothing and its "0 failed" line is vacuous.\n` +
      `${tailFor({ label, remedy })}`);
  }
  return path;
}

// ── committedFileCount ───────────────────────────────────────────────────────────────────────────
// SO #34 independent derivation of a floor: ask git's INDEX how many files of a kind are committed,
// rather than re-counting the same on-disk directory whose disappearance is the failure being detected.
// ⛔ `git ls-files`, never a directory walk — this workspace holds dozens of live worktrees under .wt/
// and a recursive walk multiplies the count by that number (SO #52).
// ⛔ An unanswerable git query is UNDETERMINABLE-FLOOR, never 0 and never "skip the check".
//
// ⚠⚠ GIT_DIR IS STRIPPED, AND THAT IS LOAD-BEARING, NOT TIDINESS (SHARD-HARNESS-ENV-LEAK-1 shape,
// SO #34b — a gate must run in the environment of the thing it validates). Git EXPORTS `GIT_DIR`,
// `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_PREFIX` and friends to every hook it runs, and preflight runs
// from `.githooks/pre-push`. With those inherited, `git ls-files` ignores `cwd` entirely and answers from
// whatever repository the OUTER git command was operating on — so the floor would be derived from a
// different tree than the one being checked, and the whole point of deriving it independently is lost.
// ⭐ This was not theoretical: the self-test's UNDETERMINABLE-FLOOR case passed standalone and FAILED
// under the pre-push hook, because a temp directory that is not a repository still answered successfully
// through the leaked GIT_DIR. Building the child env by DELETING every `GIT_*` key excludes the next one
// too, which is the same by-construction argument check-shard-assembly.test.mjs makes for its allowlist.
//
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): that by-construction argument is now the estate's, not this
// file's. gitEnv() moved verbatim into scripts/_git-env-lib.mjs and is imported above; RED #5b in
// denominator-sentinel.test.mjs still pins the behaviour from this end.

export function committedFileCount({ repoRoot, pathspec, match, label, remedy }) {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '--', pathspec], {
      cwd: repoRoot,
      env: gitEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    throw new DenominatorSentinelError('UNDETERMINABLE-FLOOR',
      `✗ DENOMINATOR UNDETERMINABLE-FLOOR — ${label}: could not derive the committed floor.\n` +
      `  \`git ls-files -- ${pathspec}\` failed in ${repoRoot} (${e.message?.split('\n')[0] ?? e}).\n` +
      `  The floor is derived from git's index precisely so it cannot be read out of the directory whose\n` +
      `  disappearance this gate detects. With no index there is no independent floor, and a gate with no\n` +
      `  floor cannot tell full coverage from none — which is a distinct state, not a pass (SO #34c).\n` +
      `${tailFor({ label, remedy })}`);
  }
  return out.split('\n').filter((f) => f && match.test(f)).length;
}

// ── vector-corpus helpers (the "present but empty" hole) ─────────────────────────────────────────
//
// ⚠⚠ THE EXACT HOLE THE ROW NAMES: `for (const v of (doc.vectors ?? []))` treats a present corpus file
// that yields zero vectors as a SKIP. It sits in the directory, it is counted in the "N node(s)" headline,
// and it contributes nothing — a file that looks like coverage and is not.
//
// ⚖ Two corpus files in chaingraph/kernels/fixtures/ legitimately carry no `vectors` array: they are a
// different schema by design and belong to a different gate. ⛔ They are NOT handled with a pinned
// allowlist — a hand-maintained shield rots the moment its consumer is renamed, and a stale shield is the
// silent-green shape one level up. Instead the exemption is DERIVED (SO #34) from the primary source:
// a zero-vector corpus file is legal ONLY while a sibling gate in chaingraph/kernels/*.test.mjs actually
// NAMES it. Delete that consumer, or rename the fixture, and the exemption evaporates by itself.
//
// ⛔ AND THE EXEMPTION NEVER COVERS AN EMPTY `vectors` KEY. A file carrying `"vectors": []` is claiming
// parity coverage and delivering none; that is an error whatever else names it.

const FIXTURE_NAME_RE = /[A-Za-z0-9._-]+\.fixtures\.json/g;

// The two gates that consume the corpus AS vectors — excluded as claimants so neither can exempt a file
// from the very check it is performing.
export const PARITY_GATE_FILES = Object.freeze(['golden-parity.test.mjs', 'determinism-replay.test.mjs']);

// fixtureClaimants — scan chaingraph/kernels/*.test.mjs (non-recursive; the parity gates' own siblings)
// and return Map<fixtureFileName, claimantTestFileName> for every fixture filename a sibling gate names.
export function fixtureClaimants(kernelsDir) {
  const claims = new Map();
  let names;
  try {
    names = readdirSync(kernelsDir);
  } catch {
    return claims; // unreadable ⇒ no claimants ⇒ every zero-vector file errors. Fails CLOSED by design.
  }
  for (const name of names) {
    if (!name.endsWith('.test.mjs') || PARITY_GATE_FILES.includes(name)) continue;
    let src;
    try { src = readFileSync(join(kernelsDir, name), 'utf8'); } catch { continue; }
    for (const m of src.match(FIXTURE_NAME_RE) ?? []) {
      if (!claims.has(m)) claims.set(m, name);
    }
  }
  return claims;
}

// parityVectorsOf — the replacement for `doc.vectors ?? []` at both parity gates' point of check.
// Returns the vectors array, or null for a DERIVED-EXEMPT non-vector corpus file (caller skips it).
// Throws ZERO-VECTOR-FIXTURE for the hole: a present file contributing zero usable vectors.
export function parityVectorsOf(doc, fileName, { claimants, label, remedy }) {
  const isPlainObject = doc !== null && typeof doc === 'object' && !Array.isArray(doc);
  const declaresVectors = isPlainObject && Object.prototype.hasOwnProperty.call(doc, 'vectors');
  const tail = tailFor({ label, remedy });

  if (declaresVectors) {
    const v = doc.vectors;
    if (Array.isArray(v) && v.length > 0) return v;
    throw new DenominatorSentinelError('ZERO-VECTOR-FIXTURE',
      `✗ DENOMINATOR ZERO-VECTOR-FIXTURE — ${label}: ${fileName} declares a "vectors" key that yields 0 usable vectors ` +
      `(got ${Array.isArray(v) ? 'an empty array' : JSON.stringify(v)}).\n` +
      `  A corpus file that claims parity coverage must contribute at least one vector. Present-but-empty is the\n` +
      `  exact hole this sentinel closes: the file is counted in the "N node(s)" headline and checks nothing.\n` +
      `  ⛔ Being named by another gate does NOT exempt an empty "vectors" key — the claim is the problem.\n${tail}`);
  }

  const claimant = claimants.get(fileName);
  if (claimant) return null; // derived exemption: a different schema, consumed by a named sibling gate

  throw new DenominatorSentinelError('ZERO-VECTOR-FIXTURE',
    `✗ DENOMINATOR ZERO-VECTOR-FIXTURE — ${label}: ${fileName} contributes 0 usable vectors and no sibling gate names it.\n` +
    `  It carries no "vectors" array, so this gate hashes nothing from it, yet it is counted in the corpus headline.\n` +
    `  A zero-vector corpus file is legal ONLY while some chaingraph/kernels/*.test.mjs consumes it BY NAME —\n` +
    `  that derived exemption is what keeps a renamed or orphaned fixture from masquerading as coverage.\n` +
    `  Either give it vectors, or have its real consumer reference "${fileName}" so the exemption is provable.\n${tail}`);
}

// ── *OrExit wrappers ─────────────────────────────────────────────────────────────────────────────
// CLI convenience: a DenominatorSentinelError prints its (already self-describing) message and exits 1
// instead of unwinding as a stack trace. ⛔ Any OTHER error still throws — a bug in this module must
// never be laundered into a tidy gate failure.
function orExit(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      if (e instanceof DenominatorSentinelError) {
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }
  };
}

export const assertDenominatorOrExit = orExit(assertDenominator);
export const assertSsotPresentOrExit = orExit(assertSsotPresent);
export const committedFileCountOrExit = orExit(committedFileCount);
export const parityVectorsOfOrExit = orExit(parityVectorsOf);
