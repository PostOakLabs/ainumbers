#!/usr/bin/env node
/**
 * scripts/assemble-chaingraph.selftest.mjs — ASSEMBLE-CHAIN-CLASSIFY-1
 *
 * The paired tamper/mutation proof for scripts/assemble-chaingraph.mjs's
 * three-verdict classifier (SO #40b / GATE-SELFTEST-META-1: a checker that
 * cannot be shown red proves nothing). It drives classifyAssembly() directly,
 * so it needs no tree, no git and no network, and it asserts BOTH directions:
 * the auto-land cases go green and the refusal cases go red.
 *
 * WHERE THE FIXTURES COME FROM. Every chain fixture is a REAL shard read off
 * disk with a REAL recorded historical mutation applied — the commit SHA is
 * cited on each one. Reading live shards rather than embedding frozen copies
 * means an unrelated later edit to one of these chains cannot silently rot a
 * fixture: the mutation is applied to whatever the shard says today, and the
 * property under test (which FIELDS moved) is preserved either way.
 *
 * ONE FIXTURE IS A MUTATION, NOT HISTORY, AND SAYS SO: node removal. A scan of
 * all 346 commits that ever touched chaingraph/chaingraph.json found ZERO node
 * tool_id removals or renames — the estate has only ever grown. A deletion
 * guard for an event that has never happened can only be proved by mutation
 * (SO #34: "verify a checker by mutation, not by reading it"), so case 6
 * deletes a real live node from the assembled side and asserts the refusal.
 *
 * THE composer_url PAIR ([2b] GREEN / [3c] RED) USES THE LIVE PREDICATE, NOT A
 * STUB (CHAIN-CLASSIFY-COMPOSER-URL-1). Both drive repoTargetExists — the same
 * function the runner injects — over a real PR #1451 shard, so the green case
 * is decided by a page that is genuinely in this tree and the red case by one
 * that genuinely is not. A `() => true` stub would have proved only that the
 * parameter is readable.
 *
 * CASES 11-16 PROVE A SECOND, SEPARATE CLASSIFIER (SHARD-DRIFT-HASH-NEUTRAL-1):
 * classifyDrift, the HASH-NEUTRAL / HASH-MOVING LABEL `--check` prints. It is
 * not classifyAssembly and does not gate the write — it is the advice a session
 * reads to decide whether its PR's drift needs a human ASSEMBLE/LAND row, which
 * is exactly why a false HASH-MOVING is expensive. Cases 12-14 are the RED half
 * required by SO #40(b): one control per field that MUST keep reading
 * hash-moving, plus the fail-closed control for a field nobody has classified.
 *
 * CASES 17-24 PROVE PART 4 OF THE ASSEMBLER: --land-structural=<ROW-ID>, the
 * human sanction path (ASSEMBLE-LAND-STRUCTURAL-1). Case 20 is the one that
 * matters: it spawns the SHIPPED SCRIPT as a real child process with a real
 * CI-shaped environment and asserts it STILL REFUSES — a mocked module variable
 * would have proved only that the variable is readable, and the whole design
 * rests on this refusal being unreachable from automation. Case 22 closes the
 * other half by asserting no workflow passes the flag at all, and case 23 pins
 * that auto-land was widened by exactly zero cases.
 *
 * Usage: node scripts/assemble-chaingraph.selftest.mjs   (exit 1 on any failure)
 */
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isolatedChildEnv, gitSync } from './_git-env-lib.mjs'
import {
  classifyAssembly,
  classifyDrift,
  describeChange,
  describeDrift,
  refusalLine,
  composerUrlToRepoPath,
  repoTargetExists,
  COPY_ONLY_CHAIN_FIELDS,
  NODE_HASH_NEUTRAL_FIELDS,
  REFUSAL_EXIT_CODE,
  CI_ENV_SIGNALS,
  ROW_ID_PATTERN,
  BOARD_SANCTION_DIRS,
  detectCI,
  parseLandStructural,
  findBoardRoot,
  resolveSanctionRow,
  formatStructuralDiff,
  sanctionLine,
  sanctionEntry,
  buildSanctionStamp,
} from './assemble-chaingraph.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const CHAINS_DIR = resolve(REPO, 'chaingraph/graph/chains')
const NODES_DIR = resolve(REPO, 'chaingraph/graph/nodes')
const META_PATH = resolve(REPO, 'chaingraph/chaingraph.meta.json')
const CG_PATH = resolve(REPO, 'chaingraph/chaingraph.json')

const chain = (name) => JSON.parse(readFileSync(resolve(CHAINS_DIR, `${name}.json`), 'utf8'))
const node = (id) => JSON.parse(readFileSync(resolve(NODES_DIR, `${id}.json`), 'utf8'))
const clone = (o) => JSON.parse(JSON.stringify(o))

// The composer_url fixtures ([2b]/[3c]/[3d]) describe the PR #1451 TRANSITION,
// so their "before" is pinned to the deprecated pre-#1451 target rather than
// inherited from the shard. Inheriting it made the whole set self-erasing: once
// #1451 lands, the shard already carries the post-repoint URL, before === after,
// and the three cases collapse to CLEAN/copy-edit — 8 assertions that silently
// stop proving the guard they exist to prove. The AFTER target is still checked
// against the real tree by repoTargetExists, so the live half stays live.
const DEPRECATED_COMPOSER_URL = 'https://ainumbers.co/guides/agentic-checkout-composer.html'

// Two real, currently-registered nodes — taken from order.nodes rather than
// hardcoded, so no fixture depends on a specific art number surviving.
const order = JSON.parse(readFileSync(META_PATH, 'utf8')).order
const [NODE_A, NODE_B] = [...order.nodes].slice(0, 2).map(node)

let failures = 0
function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${label}: ${a}`)
  } else {
    console.error(`  ✗ ${label}: expected ${e}, got ${a}`)
    failures++
  }
}
function heading(n, title) {
  console.log(`\n[${n}] ${title}`)
}

// A committed/assembled pair always carries the same node set unless a case
// deliberately changes it, so chain cases isolate chain behaviour cleanly.
const baseNodes = [NODE_A, NODE_B]
const pair = (committedChains, assembledChains, committedNodes = baseNodes, assembledNodes = baseNodes) => [
  { nodes: committedNodes, chains: committedChains },
  { nodes: assembledNodes, chains: assembledChains },
]

// ── 1. GREEN (a) — the copy-only chain edit that reds main today. ───────────
// REAL: commit 121758de (PR #1449, CLAIMS-WORDING-FIX-1) changed exactly one
// word of aml-programme's description, "Full audited run" -> "Full receipted
// run". Two bytes. The old all-or-nothing guard refused it, so chaingraph.json
// could never be reassembled by any merge.
heading(1, 'copy-only chain edit (aml-programme, 121758de) -> AUTO-LAND')
{
  const after = chain('aml-programme')
  const before = clone(after)
  before.description = before.description.replace('Full receipted run', 'Full audited run')
  if (before.description === after.description) {
    console.error('  ✗ fixture stale: aml-programme no longer carries the post-121758de wording')
    failures++
  }
  const r = classifyAssembly(...pair([before], [after]))
  check('verdict', r.verdict, 'AUTO-LAND')
  check('changes', r.allowed.map(describeChange), ['chain-copy-edit aml-programme [description]'])
  check('refusals', r.refusals.length, 0)
}

// ── 2. GREEN (b) — a purely additive new chain. ────────────────────────────
// REAL: commit 1dc5d3e7 composed ap2-x402-cart-correlation (art-595 -> art-596)
// as a brand-new chain id. Nothing existing was modified or removed.
heading(2, 'purely additive new chain (ap2-x402-cart-correlation, 1dc5d3e7) -> AUTO-LAND')
{
  const added = chain('ap2-x402-cart-correlation')
  const untouched = chain('aml-programme')
  const r = classifyAssembly(...pair([untouched], [untouched, added]))
  check('verdict', r.verdict, 'AUTO-LAND')
  check('changes', r.allowed.map(describeChange), ['chain-added ap2-x402-cart-correlation'])
  check('refusals', r.refusals.length, 0)
}

// ── 2b. GREEN (a2) — the GUARDED composer_url repoint, target PRESENT. ─────
// REAL: draft PR #1451 repoints 13 chains' composer_url from the deprecated
// guides/*-composer.html pages to chaingraph/chains/*.html. The ORCH ran the
// landed classifier over all 13 real shard pairs: 13/13 REFUSED, changed field
// composer_url and nothing else, 0 additive. Tim's ruling of 2026-08-22 admits
// exactly that class WHEN THE TARGET EXISTS. agentic-checkout is one of the 13
// and its destination page is in this tree — asserted below before the verdict,
// so a future removal of that page reds this fixture loudly instead of quietly
// inverting what it proves.
heading('2b', 'composer_url repoint, target PRESENT (agentic-checkout, PR #1451) -> AUTO-LAND')
{
  const before = { ...chain('agentic-checkout'), composer_url: DEPRECATED_COMPOSER_URL }
  const after = clone(before)
  after.composer_url = 'https://ainumbers.co/chaingraph/chains/agentic-checkout.html'
  if (before.composer_url === after.composer_url) {
    console.error('  ✗ fixture stale: agentic-checkout already points at the post-#1451 URL')
    failures++
  }
  check(
    'fixture: destination page is really in this tree',
    existsSync(resolve(REPO, composerUrlToRepoPath(after.composer_url))),
    true,
  )
  const r = classifyAssembly(...pair([before], [after]), { targetExists: repoTargetExists })
  check('verdict', r.verdict, 'AUTO-LAND')
  check('changes', r.allowed.map(describeChange), ['chain-composer-url-repoint agentic-checkout [composer_url]'])
  check('refusals', r.refusals.length, 0)
}

// ── 3. REFUSE (c) — a structural chain edit. ───────────────────────────────
// REAL: commit c42babe7 (CHAINWIRE-1, PR #846) PREPENDED art-477 as Stage 1 of
// dw-capacity-check and rewrote the description to match. Node membership and
// order both moved. The mixed prose+structure shape is the one that matters:
// the description change alone would be (a), and it still must not rescue the
// diff.
heading(3, 'structural chain edit (dw-capacity-check, c42babe7) -> REFUSED')
{
  const after = chain('dw-capacity-check')
  const before = clone(after)
  // the real pre-c42babe7 shard: one step, and the single-node description
  before.steps = [
    {
      tool_id: 'art-427-discount-window-capacity',
      handoff: 'lendable value vs. coverage-target result feeds the Discount Window Preparedness Act evidence pack and LCR pre-positioned-collateral disclosure; standalone recurring check',
    },
  ]
  before.description = 'Single-node Federal Reserve Discount Window borrowing-capacity check: lendable collateral value against a runnable-liability / uninsured-deposit coverage target.'
  const r = classifyAssembly(...pair([before], [after]))
  check('verdict', r.verdict, 'REFUSED')
  check('refusals', r.refusals.map(describeChange), ['chain-structural-edit dw-capacity-check [steps]'])
  check('description change did not rescue it', r.allowed.length, 0)
}

// ── 3b. REFUSE (c) — a step-internal prose change is still structural. ─────
// `handoff` is prose a reader sees, but chain formal verification reads it as
// graph content, so it lives inside `steps` and is NOT copy-only. Stated in
// the classifier header; asserted here so the boundary cannot drift silently.
heading('3b', 'handoff-only edit inside steps (dw-capacity-check) -> REFUSED')
{
  const before = chain('dw-capacity-check')
  const after = clone(before)
  after.steps[0].handoff = after.steps[0].handoff + ' (reworded)'
  const r = classifyAssembly(...pair([before], [after]))
  check('verdict', r.verdict, 'REFUSED')
  check('refusals', r.refusals.map(describeChange), ['chain-structural-edit dw-capacity-check [steps]'])
}

// ── 3c. REFUSE (a2's guard) — composer_url repoint, target ABSENT. ─────────
// RE-EXPRESSED, NOT DELETED (CHAIN-CLASSIFY-COMPOSER-URL-1). Until Tim's ruling
// of 2026-08-22 this case pinned "composer_url repoint -> REFUSED" flat: a URL
// is not prose, so admitting it to the copy-only allowlist would have made that
// rule a carve-out. The ruling did not overturn that reasoning, it SATISFIED it
// — machine-resolvable is exactly what lets a machine check the target — so the
// pin is preserved with its meaning intact by re-expressing it as the case that
// still refuses: the target is not there.
//
// THIS IS THE CONTROL THAT MATTERS. It differs from [2b] in ONE way — the
// destination page does not exist. Same shard, same single field, same live
// repoTargetExists. If the guard were ever dropped, [2b] would still pass and
// the safety rule would be gone; only this case notices.
heading('3c', 'composer_url repoint, target ABSENT (agentic-checkout) -> REFUSED, naming the missing path')
{
  const MISSING_URL = 'https://ainumbers.co/chaingraph/chains/agentic-checkout-NOT-BUILT.html'
  const before = { ...chain('agentic-checkout'), composer_url: DEPRECATED_COMPOSER_URL }
  const after = clone(before)
  after.composer_url = MISSING_URL
  check(
    'fixture: destination page is really absent from this tree',
    existsSync(resolve(REPO, composerUrlToRepoPath(MISSING_URL))),
    false,
  )
  const r = classifyAssembly(...pair([before], [after]), { targetExists: repoTargetExists })
  check('verdict', r.verdict, 'REFUSED')
  check('refusals', r.refusals.map(describeChange), ['chain-composer-url-target-missing agentic-checkout [composer_url]'])
  check('reason names the missing target path', r.refusals[0].reason.includes('repo/chaingraph/chains/agentic-checkout-NOT-BUILT.html'), true)
  check('not the generic chain-structural-edit refusal', r.refusals[0].kind, 'chain-composer-url-target-missing')
  check('nothing was allowed', r.allowed.length, 0)

  // The DEFAULT predicate — a caller that injects nothing — refuses even the
  // real, present target from [2b]. An unwired caller can never auto-land a
  // repoint it did not verify.
  const realRepoint = clone(before)
  realRepoint.composer_url = 'https://ainumbers.co/chaingraph/chains/agentic-checkout.html'
  check('default predicate refuses a target it never checked', classifyAssembly(...pair([before], [realRepoint])).verdict, 'REFUSED')

  // An off-origin URL maps to no repo path at all, so it cannot be verified
  // and refuses for THAT stated reason rather than passing as "prose".
  const offsite = clone(before)
  offsite.composer_url = 'https://example.com/chains/agentic-checkout.html'
  const o = classifyAssembly(...pair([before], [offsite]), { targetExists: repoTargetExists })
  check('unmappable URL refuses', o.refusals.map(describeChange), ['chain-composer-url-unmappable agentic-checkout [composer_url]'])
}

// ── 3d. REFUSE (c) — composer_url PLUS any second field is still structural. ─
// One field's guard must not become a door for a second field. Both halves are
// tested: paired with a copy-only field (which would have auto-landed on its
// own) and paired with a structural one. The target exists in both, so the only
// thing standing between this diff and an auto-land is the strictness rule.
heading('3d', 'composer_url + a second field (agentic-checkout) -> REFUSED even with the target present')
{
  const REAL_URL = 'https://ainumbers.co/chaingraph/chains/agentic-checkout.html'
  const before = { ...chain('agentic-checkout'), composer_url: DEPRECATED_COMPOSER_URL }

  const withProse = clone(before)
  withProse.composer_url = REAL_URL
  withProse.description = `${withProse.description} (reworded in the same diff)`
  const p = classifyAssembly(...pair([before], [withProse]), { targetExists: repoTargetExists })
  check('verdict (paired with a copy-only field)', p.verdict, 'REFUSED')
  check('refusals', p.refusals.map(describeChange), ['chain-structural-edit agentic-checkout [composer_url]'])
  check('the copy-only field did not rescue it', p.allowed.length, 0)

  const withStructure = clone(before)
  withStructure.composer_url = REAL_URL
  withStructure.domain = `${withStructure.domain ?? ''}-moved`
  const s = classifyAssembly(...pair([before], [withStructure]), { targetExists: repoTargetExists })
  check('verdict (paired with a structural field)', s.verdict, 'REFUSED')
  check('refusals', s.refusals.map(describeChange), ['chain-structural-edit agentic-checkout [composer_url, domain]'])
}

// ── 4. REFUSE (c) — a chain removal or rename. ────────────────────────────
// REAL: commit f534336d (the ChainGraph engagement+naming wave, PR #29)
// renamed 60 chains at once — tcm-fit, tcm-access-model, tcm-repo-margin and
// the rest. A rename reaches the classifier as a removal plus an addition, so
// the removal half is what must refuse.
heading(4, 'chain removal/rename (f534336d naming wave) -> REFUSED')
{
  const removed = chain('aml-programme')
  const kept = chain('dw-capacity-check')
  const r = classifyAssembly(...pair([removed, kept], [kept]))
  check('verdict', r.verdict, 'REFUSED')
  check('refusals', r.refusals.map(describeChange), ['chain-removed aml-programme'])
}

// ── 5. REFUSE (c) — a node removal. THE DELETION GUARD. ───────────────────
// MUTATION, not history — no node tool_id has ever been removed or renamed in
// chaingraph.json's 346-commit history (see this file's header). Deleting a
// real live node from the assembled side is the only way to exercise it.
heading(5, `node removal (mutation over live node ${NODE_B.tool_id}) -> REFUSED`)
{
  const r = classifyAssembly(...pair([], [], [NODE_A, NODE_B], [NODE_A]))
  check('verdict', r.verdict, 'REFUSED')
  check('refusals', r.refusals.map(describeChange), [`node-removed ${NODE_B.tool_id}`])
}

// ── 6. UNCHANGED — a node-only diff behaves exactly as it did before. ─────
// Node additions and node content changes have always auto-landed (a re-prove
// receipt splice or a citation fix rewrites a node shard on most kernel PRs);
// this row did not touch that.
heading(6, 'node-only diff (addition + content change) -> AUTO-LAND, as before')
{
  const modified = clone(NODE_A)
  modified.description = `${modified.description ?? ''} (content change)`
  const r = classifyAssembly(...pair([], [], [NODE_A], [modified, NODE_B]))
  check('verdict', r.verdict, 'AUTO-LAND')
  check('changes', r.allowed.map(describeChange).sort(), [
    `node-added ${NODE_B.tool_id}`,
    `node-modified ${NODE_A.tool_id}`,
  ].sort())
  check('refusals', r.refusals.length, 0)
}

// ── 7. CLEAN — no diff at all is a third state, never confused with either. ─
heading(7, 'identical committed/assembled -> CLEAN')
{
  const c = chain('aml-programme')
  const r = classifyAssembly(...pair([c], [clone(c)]))
  check('verdict', r.verdict, 'CLEAN')
  check('changes', r.allowed.length, 0)
  check('refusals', r.refusals.length, 0)
}

// ── 8. ONE REFUSAL REFUSES THE WHOLE WRITE. ───────────────────────────────
// Assembly splices the full shard set, so there is no way to write the allowed
// half without also writing the refused half. A diff that mixes an auto-landable
// wording fix with a refused structural edit must come out REFUSED.
heading(8, 'auto-landable change mixed with a refused one -> REFUSED overall')
{
  const amlAfter = chain('aml-programme')
  const amlBefore = clone(amlAfter)
  amlBefore.description = amlBefore.description.replace('Full receipted run', 'Full audited run')
  const dwBefore = chain('dw-capacity-check')
  const dwAfter = clone(dwBefore)
  dwAfter.steps = dwAfter.steps.slice(0, 1)
  const r = classifyAssembly(...pair([amlBefore, dwBefore], [amlAfter, dwAfter]))
  check('verdict', r.verdict, 'REFUSED')
  check('refusals', r.refusals.map(describeChange), ['chain-structural-edit dw-capacity-check [steps]'])
}

// ── 9. PART 2 — the refusal signal itself. ────────────────────────────────
// Under GitHub Actions a refusal must surface as an `::error` annotation, and
// the status it maps to must be a distinct non-zero. Asserted here so neither
// can be softened back to a silent exit 0 without this gate going red.
heading(9, 'refusal emits a GitHub ::error annotation and a distinct exit code')
{
  const r = classifyAssembly(...pair([chain('aml-programme')], []))
  const annotated = refusalLine(r.refusals[0], { annotate: true })
  const plain = refusalLine(r.refusals[0], { annotate: false })
  check('annotation prefix', annotated.startsWith('::error title=chaingraph assembly refused::'), true)
  check('annotation is single-line', annotated.includes('\n'), false)
  check('annotation names the chain', annotated.includes('aml-programme'), true)
  check('plain form is not a workflow command', plain.startsWith('::'), false)
  check('refusal exit code is distinct from 0 and 1', REFUSAL_EXIT_CODE, 3)
}

// ── 10. The allowlist is the contract — pin it. ──────────────────────────
// Also the tripwire for the wrong way to satisfy Tim's 2026-08-22 ruling:
// appending 'composer_url' here would drop the [3c] guard entirely, and this
// assertion goes red the moment anyone tries it.
heading(10, 'copy-only allowlist is exactly the two prose fields (composer_url stays out — it is guarded, not allowlisted)')
check('COPY_ONLY_CHAIN_FIELDS', [...COPY_ONLY_CHAIN_FIELDS].sort(), ['description', 'title'])

// ══════════════════════════════════════════════════════════════════════════
// SHARD-DRIFT-HASH-NEUTRAL-1 — the DRIFT LABEL (classifyDrift), cases 11-16.
//
// A DIFFERENT classifier from classifyAssembly above, with a different job:
// classifyAssembly decides what the unattended write may LAND, classifyDrift
// labels what `--check` found so a human knows whether their PR needs an
// ASSEMBLE/LAND row. Cases 15 keeps the two from being conflated.
// ══════════════════════════════════════════════════════════════════════════

// classifyDrift takes the two artifact TEXTS (it is called on file contents),
// so fixtures serialise on the way in.
const drift = (committedNodes, assembledNodes, committedChains = [], assembledChains = []) =>
  classifyDrift(
    JSON.stringify({ nodes: committedNodes, chains: committedChains }),
    JSON.stringify({ nodes: assembledNodes, chains: assembledChains }),
  )

/** Top-level field names that differ — the fixtures' own check on themselves. */
const changedTop = (before, after) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .sort()

/** A minimal, type-preserving "this value moved" mutation for the RED controls. */
function bump(v) {
  if (typeof v === 'string') return `${v}-moved`
  if (typeof v === 'number') return v + 1
  if (typeof v === 'boolean') return !v
  if (Array.isArray(v)) return [...v, 'moved']
  if (v && typeof v === 'object') return { ...v, moved: true }
  return 'moved'
}

// ── 11. GREEN — the real diff this row exists for, VERBATIM. ──────────────
// REAL: PR #1470 / commit 715e5d1c (NODE-DESC-CLAUSE-PIN-1) rewrote five node
// shards' `description` and added `standards_basis` + `cited_clause_digest` to
// each. Measured on the real objects: those three fields moved on all five and
// NOTHING else did. The landed classifier called it HASH-MOVING, so the row
// checked off BLOCKED-complete and cost a successor ASSEMBLE-LAND row — while
// golden-parity was clean at 2126 vectors / 637 nodes and the shard diff carried
// zero execution_hash lines.
//
// BOTH SIDES ARE PINNED FROM THE COMMIT, not inherited from the live shard, so
// this case keeps proving the same thing after #1470 lands. Every OTHER field
// still comes from the live shard, so the fixture is a real node.
const CLAUSE_PIN_COMMIT = '715e5d1c'
const CLAUSE_PIN_NODES = Object.freeze([
  'art-216-trid-tolerance-cure',
  'art-91-ownership-50pct-aggregator',
  'art-396-compute-15c3-3-reserve',
  'art-536-reg-w-affiliate-transaction-tester',
  'art-447-securitization-risk-retention-check',
])
const CLAUSE_PIN_FIELDS = Object.freeze(['cited_clause_digest', 'description', 'standards_basis'])
const ART216_BEFORE_DESCRIPTION =
  'TRID fee tolerance analysis and cure calculation per Reg Z §1026.19(e)(3). Classifies each closing fee into zero-tolerance, ten-percent cumulative, or no-tolerance-limit bucket. Computes 10% bucket aggregate overage, identifies violations, and returns the cure amount required to make the consumer whole under TRID.'
const ART216_AFTER = Object.freeze({
  description:
    'TRID fee tolerance analysis and cure calculation per Reg Z §1026.19(e)(3). Each closing fee arrives with its tolerance bucket already assigned by the caller (zero-tolerance, ten-percent cumulative, or no-tolerance-limit); this node does not derive that membership, because the §1026.19(e)(3)(ii)(A)-(C) tests turn on provider identity, whether the consumer was permitted to shop for the provider, and creditor-affiliate status, and none of those facts are inputs here. Computes 10% bucket aggregate overage, identifies violations, and returns the cure amount required to make the consumer whole under TRID. The §1026.19(e)(3)(iv)(A)-(F) grounds for a revised estimate (changed circumstance affecting settlement charges, changed circumstance affecting eligibility, consumer-requested revision, interest-rate-dependent charges, expiration of the estimate, and delayed settlement on a construction loan) are not distinguished from one another: each fee carries one caller-declared changed-circumstance boolean, and which ground supports it is outside scope.',
  standards_basis: 'implements_standard',
  cited_clause_digest: [
    {
      digest: 'sha256:900bf87a953ba8e2dad62aa738eecdd91354505bdb2deee7ed9f407fc0c91321',
      source_url: 'https://www.ecfr.gov/api/versioner/v1/full/2026-08-20/title-12.xml?part=1026&section=1026.19',
      retrieved_at: '2026-08-22',
      clause_path: '(e)(3)(i)-(iii)',
      scheme: 'cfr',
      id: '12 CFR 1026.19',
    },
    {
      digest: 'sha256:fd2f6778cbe885ba22eb6e5c1278a696f58bf873d5158812190e6e1af39f2a88',
      source_url: 'https://www.ecfr.gov/api/versioner/v1/full/2026-08-20/title-12.xml?part=1026&section=1026.19',
      retrieved_at: '2026-08-22',
      clause_path: '(e)(3)(iv)(A)-(F)',
      scheme: 'cfr',
      id: '12 CFR 1026.19',
    },
  ],
})

heading(11, `real clause-pin shard diff, values verbatim from ${CLAUSE_PIN_COMMIT} (${CLAUSE_PIN_NODES[0]}) -> HASH-NEUTRAL`)
{
  const before = { ...node(CLAUSE_PIN_NODES[0]), description: ART216_BEFORE_DESCRIPTION }
  delete before.standards_basis
  delete before.cited_clause_digest
  const after = { ...before, ...ART216_AFTER }
  check('fixture: exactly the three recorded fields differ', changedTop(before, after), [...CLAUSE_PIN_FIELDS])
  check('fixture: it is a real node, not a stub', Object.keys(before).length > 10, true)
  const r = drift([before], [after])
  check('verdict', r.verdict, 'HASH-NEUTRAL')
  check('nothing reported as hash-moving', r.changes.map(describeDrift), [])
  check('changedIds empty', r.changedIds, [])
}

// ── 11b. GREEN — all five shards of the same commit, as one diff. ─────────
// The recorded per-node field set is identical across the five (measured on the
// real objects at 715e5d1c), and `implements_standard` is the real value all
// five received. The per-node prose and digest lists differ in the real commit
// and are irrelevant here: this classifier asks only WHICH FIELDS MOVED, which
// is the property the five-shard diff shares. Case 11 above is the verbatim one.
heading('11b', `all five clause-pin shards as one diff (${CLAUSE_PIN_COMMIT}) -> HASH-NEUTRAL`)
{
  const committed = CLAUSE_PIN_NODES.map((id) => {
    const n = node(id)
    delete n.standards_basis
    delete n.cited_clause_digest
    return n
  })
  const assembled = committed.map((n) => ({
    ...n,
    description: `${n.description} Rewritten by ${CLAUSE_PIN_COMMIT}.`,
    standards_basis: 'implements_standard',
    cited_clause_digest: ART216_AFTER.cited_clause_digest,
  }))
  committed.forEach((before, i) => {
    check(`fixture: ${CLAUSE_PIN_NODES[i]} moves exactly the recorded set`, changedTop(before, assembled[i]), [...CLAUSE_PIN_FIELDS])
  })
  check('the recorded set is a subset of the allowlist', CLAUSE_PIN_FIELDS.every((f) => NODE_HASH_NEUTRAL_FIELDS.includes(f)), true)
  const r = drift(committed, assembled)
  check('verdict', r.verdict, 'HASH-NEUTRAL')
  check('changedIds', r.changedIds, [])
}

// ── 12. RED — ONE CONTROL PER FIELD THAT MUST STAY HASH-MOVING. ──────────
// THE LOAD-BEARING HALF (SO #40b). An allowlist is only as good as the set it
// excludes, and an exclusion that is never exercised is a claim, not a guard.
// Each field below gets a single-field change over a REAL live node and must
// come back HASH-MOVING, NAMING that field. One missing case is a hole.
//
// The node is chosen at runtime as the first entry in order.nodes that actually
// carries all of them (371 of 634 do), so no control depends on a specific art
// number surviving, and a node that stopped carrying a field cannot silently
// turn its control into a no-op — the lookup would fail loudly instead.
const MUST_STAY_HASH_MOVING = Object.freeze([
  'tool_id',              // node identity
  'tool_version',         // the version consumers pin
  'mcp_name',             // registration identity — a duplicate 500s the live /mcp handshake
  'gpu',                  // prove-lane routing
  'status',               // live/deferred is load-bearing
  'consumes',             // graph edges in
  'feeds',                // graph edges out
  'input_schema_ref',     // the input contract
  'conformance_fixtures', // the vectors golden-parity hashes
  'compute_capability',
  'compute_images',       // guest image identity
  'export_capability',
  'compute_proof',        // the receipt itself
  'compute_proof_ready',
])
const RED_NODE_ID = [...order.nodes].find((id) => {
  const n = node(id)
  return MUST_STAY_HASH_MOVING.every((f) => f in n)
})

heading(12, `single-field RED control per must-stay-moving field (live node ${RED_NODE_ID})`)
{
  check('fixture: a live node carrying every controlled field was found', typeof RED_NODE_ID === 'string', true)
  for (const field of MUST_STAY_HASH_MOVING.filter((f) => f !== 'tool_id')) {
    const before = node(RED_NODE_ID)
    const after = { ...before, [field]: bump(before[field]) }
    const r = drift([before], [after])
    check(`${field} alone`, [r.verdict, r.changes.map(describeDrift)], ['HASH-MOVING', [`${RED_NODE_ID} [${field}]`]])
  }
}

// ── 12b. RED — tool_id, the key itself. ──────────────────────────────────
// A tool_id change is not a field edit at all: it reaches the classifier as a
// removal plus an addition, decided on the key sets before any field comparison
// runs. Both halves must be reported, or a rename could hide inside a diff.
heading('12b', 'tool_id change (the key) -> HASH-MOVING as removal + addition')
{
  const before = node(RED_NODE_ID)
  const after = { ...before, tool_id: `${before.tool_id}-renamed` }
  const r = drift([before], [after])
  check('verdict', r.verdict, 'HASH-MOVING')
  check('both halves reported', r.changes.map((c) => c.kind).sort(), ['node-added', 'node-removed'])
  check('changedIds', [...r.changedIds].sort(), [`${RED_NODE_ID}`, `${RED_NODE_ID}-renamed`].sort())
}

// ── 13. FAIL-CLOSED — a field nobody has classified. ─────────────────────
// The whole reason this is an allowlist and not a projection or a denylist. A
// field the schema gains tomorrow is not on the list, so it survives the filter
// and reads HASH-MOVING — and the verdict NAMES it, so the next reader can see
// which field needs classifying rather than guessing at a bare id.
heading(13, 'unrecognised field -> HASH-MOVING, naming the field')
{
  const INVENTED = 'field_invented_tomorrow'
  check('fixture: the field really is unclassified', NODE_HASH_NEUTRAL_FIELDS.includes(INVENTED), false)
  const before = node(RED_NODE_ID)
  const after = { ...before, [INVENTED]: 'some value' }
  const r = drift([before], [after])
  check('verdict', r.verdict, 'HASH-MOVING')
  check('the verdict names the unknown field', r.changes.map(describeDrift), [`${RED_NODE_ID} [${INVENTED}]`])

  // Removing a field is the same question from the other side.
  const stripped = node(RED_NODE_ID)
  delete stripped.compute_capability
  check('removing an unlisted field also refuses', drift([node(RED_NODE_ID)], [stripped]).verdict, 'HASH-MOVING')
}

// ── 14. STRUCTURAL — additions, removals, and the mixed diff. ────────────
// The mixed case is the one that matters: an allowlisted field travelling
// alongside a hash-moving one must not rescue the diff, and must not appear in
// the verdict as though it were the cause.
heading(14, 'node added / node removed / allowlisted field mixed with compute_proof -> HASH-MOVING')
{
  const a = node(order.nodes[0])
  const b = node(order.nodes[1])
  check('node added', drift([a], [a, b]).changes.map((c) => c.kind), ['node-added'])
  check('node removed', drift([a, b], [a]).changes.map((c) => c.kind), ['node-removed'])

  const before = node(RED_NODE_ID)
  const after = {
    ...before,
    description: `${before.description} (reworded in the same diff)`,
    compute_proof: bump(before.compute_proof),
  }
  const r = drift([before], [after])
  check('verdict', r.verdict, 'HASH-MOVING')
  check('names compute_proof only, not the allowlisted description', r.changes.map(describeDrift), [`${RED_NODE_ID} [compute_proof]`])
}

// ── 15. CHAINS UNAFFECTED — and the two classifiers stay distinct. ───────
// SHARD-DRIFT-CHAINS-1 folded chains into this verdict on purpose: a chain-only
// semantic edit is vendored content and must not read HASH-NEUTRAL. The node
// allowlist did not touch that path, so a chain description edit — which
// classifyAssembly AUTO-LANDS as verdict (a) — still reads HASH-MOVING here.
// Asserting both on the SAME pair is what keeps the two from being conflated.
heading(15, 'chain edits still HASH-MOVING (SHARD-DRIFT-CHAINS-1 untouched), even where classifyAssembly auto-lands')
{
  const n = node(order.nodes[0])
  const after = chain('aml-programme')
  const before = clone(after)
  before.description = before.description.replace('Full receipted run', 'Full audited run')
  if (before.description === after.description) {
    console.error('  ✗ fixture stale: aml-programme no longer carries the post-121758de wording')
    failures++
  }
  const d = drift([n], [n], [before], [after])
  check('chain copy-only edit -> HASH-MOVING', d.verdict, 'HASH-MOVING')
  check('reported as a chain change', d.changes.map((c) => c.kind), ['chain-changed'])
  check('same pair is AUTO-LAND for classifyAssembly', classifyAssembly(...pair([before], [after], [n], [n])).verdict, 'AUTO-LAND')

  const structural = clone(after)
  structural.steps = (structural.steps ?? []).slice(0, 1)
  check('chain structural edit -> HASH-MOVING', drift([n], [n], [after], [structural]).verdict, 'HASH-MOVING')
  check('chain removal -> HASH-MOVING', drift([n], [n], [after], []).changedIds, ['aml-programme'])
  check('chain addition -> HASH-MOVING', drift([n], [n], [], [after]).changedIds, ['aml-programme'])
}

// ── 16. The node allowlist is the contract — pin it, exclusions included. ─
// Case 10's counterpart. The exclusions are pinned as explicitly as the members
// because they are the half that fails closed: `url` is excluded for the same
// reason composer_url is guarded rather than allowlisted, and appending any of
// these three would silently widen what auto-lands with no other gate noticing.
heading(16, 'node hash-neutral allowlist is exactly the four inert fields (url / mandate_type / wave stay out)')
{
  check('NODE_HASH_NEUTRAL_FIELDS', [...NODE_HASH_NEUTRAL_FIELDS].sort(), [
    'cited_clause_digest',
    'description',
    'display_name',
    'standards_basis',
  ])
  for (const excluded of ['url', 'mandate_type', 'wave']) {
    check(`${excluded} is NOT on the allowlist`, NODE_HASH_NEUTRAL_FIELDS.includes(excluded), false)
  }
  check('the list is frozen', Object.isFrozen(NODE_HASH_NEUTRAL_FIELDS), true)

  // CLEAN is a real state here too: no diff at all is HASH-NEUTRAL with nothing
  // reported, never confused with "everything was allowlisted".
  const n = node(order.nodes[0])
  const r = drift([n], [clone(n)], [], [])
  check('identical artifacts -> HASH-NEUTRAL, zero changes', [r.verdict, r.changes.length], ['HASH-NEUTRAL', 0])

  // An unparseable side claims no verdict at all (SO #34c: absence is a third
  // state, never a green).
  check('unparseable input claims no verdict', classifyDrift('{not json', '{}').verdict, null)
}

/* ══════════════════════════════════════════════════════════════════════════
 * CASES 17-24 PROVE PART 4: --land-structural=<ROW-ID> (ASSEMBLE-LAND-STRUCTURAL-1)
 *
 * The REDs here are the deliverable, not a by-product. Case 20 is the
 * load-bearing one: it runs the SHIPPED SCRIPT as a real child process with a
 * genuinely CI-shaped environment and asserts it still refuses. That is the
 * property the whole design rests on — a mechanism an unattended workflow can
 * reach is the blanket --land-chains declined on 2026-08-22.
 * ═══════════════════════════════════════════════════════════════════════════ */

const ASSEMBLER = resolve(REPO, 'scripts/assemble-chaingraph.mjs')

// Runs the REAL script in a REAL child process with a REAL environment.
// isolatedChildEnv (scripts/_git-env-lib.mjs) filters to a fixed allowlist that
// contains NO CI key and NO GIT_* key, so "CI" and "not CI" are both produced
// deliberately here and the result is identical on a workstation and on a
// GitHub runner. That determinism is why the CI assertions below hold in both.
function runAssembler(args, envExtra = {}) {
  try {
    const stdout = execFileSync(process.execPath, [ASSEMBLER, ...args], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: isolatedChildEnv(envExtra),
    })
    return { code: 0, out: stdout, err: '' }
  } catch (e) {
    return { code: e.status ?? -1, out: e.stdout ?? '', err: e.stderr ?? '' }
  }
}

// ── 17. The row id is REQUIRED, and an attached value cannot eat a flag. ──
heading(17, '--land-structural argv parse: bare / empty / malformed / duplicated all carry an error, only a well-formed id passes')
{
  check('absent', parseLandStructural(['--check']).present, false)
  check('bare flag has no row id', parseLandStructural(['--land-structural']).rowId, null)
  check('bare flag errors', /REQUIRED, never optional/.test(parseLandStructural(['--land-structural']).error ?? ''), true)
  check('empty value errors', /REQUIRED/.test(parseLandStructural(['--land-structural=']).error ?? ''), true)
  check('whitespace-only value errors', parseLandStructural(['--land-structural=   ']).rowId, null)
  check('malformed value errors', /malformed sanctioning row id/.test(parseLandStructural(['--land-structural=yes']).error ?? ''), true)
  check('duplicated flag errors', /given 2 times/.test(parseLandStructural(['--land-structural=A-1', '--land-structural=B-2']).error ?? ''), true)
  check('well-formed id passes', parseLandStructural(['--land-structural=ART99-GHOST-CLEANUP-1']), {
    present: true, rowId: 'ART99-GHOST-CLEANUP-1', error: null,
  })

  // A space-separated value would let `--land-structural --check` swallow the
  // next flag as a row id. The `=` form makes that impossible by construction.
  const swallowed = parseLandStructural(['--land-structural', '--check'])
  check('space-separated form does NOT consume the next flag as an id', swallowed.rowId, null)
}

// ── 18. The id pattern is also the path-traversal guard. ─────────────────
heading(18, 'ROW_ID_PATTERN accepts real board ids and rejects every path-shaped string')
{
  for (const good of ['ASSEMBLE-LAND-STRUCTURAL-1', 'ART99-GHOST-CLEANUP-1', 'CHAIN-FV-L2-COPY-1', 'A-1']) {
    check(`accepts ${good}`, ROW_ID_PATTERN.test(good), true)
  }
  // The id is interpolated into a filesystem path, so these are security cases,
  // not tidiness cases.
  for (const bad of [
    '../../board/done/X-1', 'X-1/../../y-1', '..', '/etc/passwd', 'C:\\board\\done\\X-1',
    'lower-case-1', 'NO-TRAILING-NUMBER', 'X 1', '', 'X-1;rm -rf /', '*',
  ]) {
    check(`rejects ${JSON.stringify(bad)}`, ROW_ID_PATTERN.test(bad), false)
  }
}

// ── 19. CI detection, as a pinned truth table over an env object. ────────
heading(19, 'detectCI truth table — set means CI, and false/0/empty mean not CI')
{
  check('empty env is not CI', detectCI({}).isCI, false)
  check('CI=true is CI', detectCI({ CI: 'true' }), { isCI: true, signals: ['CI'] })
  check('CI=1 is CI', detectCI({ CI: '1' }).isCI, true)
  check('GITHUB_ACTIONS=true is CI', detectCI({ GITHUB_ACTIONS: 'true' }).signals, ['GITHUB_ACTIONS'])
  check('GITHUB_RUN_ID alone is CI', detectCI({ GITHUB_RUN_ID: '17' }).signals, ['GITHUB_RUN_ID'])
  check('a real Actions env reports both', detectCI({ CI: 'true', GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '17' }).signals, ['CI', 'GITHUB_ACTIONS', 'GITHUB_RUN_ID'])
  // CI=false is how a caller says "not CI"; honouring it keeps the signal
  // meaning what the ecosystem means by it.
  check('CI=false is not CI', detectCI({ CI: 'false' }).isCI, false)
  check('CI=0 is not CI', detectCI({ CI: '0' }).isCI, false)
  check('CI= (empty) is not CI', detectCI({ CI: '' }).isCI, false)
  check('an unrelated variable is not CI', detectCI({ HOME: '/home/tim', EDITOR: 'vi' }).isCI, false)
  check('the signal list is frozen', Object.isFrozen(CI_ENV_SIGNALS), true)
  check('GitHub Actions keys are on the list', ['CI', 'GITHUB_ACTIONS', 'GITHUB_RUN_ID'].every((k) => CI_ENV_SIGNALS.includes(k)), true)
}

// ── 20. ⛔ THE LOAD-BEARING RED — the REAL script, a REAL child process, a
// REAL CI environment. Not a mocked variable, not an exported predicate called
// with a fake argument: process.env of a separate node process. ─────────────
heading(20, 'REAL detection path: the shipped script under a CI environment REFUSES the flag and writes nothing')
{
  const before = [CG_PATH, META_PATH].map((p) => readFileSync(p, 'utf8').length)

  const ci = runAssembler(['--land-structural=ASSEMBLE-LAND-STRUCTURAL-1'], {
    CI: 'true', GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '424242', GITHUB_WORKFLOW: 'Derived Artifacts Regen',
  })
  check('exits non-zero (1, not the ordinary refusal 0)', ci.code, 1)
  check('refusal names the flag', ci.err.includes('REFUSED --land-structural'), true)
  check('refusal names CI as the reason', ci.err.includes('this is a CI environment'), true)
  check('refusal quotes the detected signals', ci.err.includes('CI, GITHUB_ACTIONS, GITHUB_RUN_ID, GITHUB_WORKFLOW'), true)
  check('refusal states it is human-only', ci.err.includes('HUMAN-ONLY'), true)
  check('nothing was written', /Wrote |stamped/.test(ci.out), false)
  check('the board was never even consulted', ci.out.includes('sanctioned by board row'), false)
  check('chaingraph.json and chaingraph.meta.json are untouched', [CG_PATH, META_PATH].map((p) => readFileSync(p, 'utf8').length), before)

  // THE DISCRIMINATOR. Without this, "it refused" proves nothing — a script
  // that refused everything would pass the assertion above. Same flag, same
  // process, CI scrubbed, deliberately malformed id: the refusal must change
  // to the id complaint, which is only reachable PAST the CI check.
  const notCI = runAssembler(['--land-structural=not-a-row-id'])
  check('non-CI: exits 1 for a DIFFERENT reason', notCI.code, 1)
  check('non-CI: the CI branch did not fire', notCI.err.includes('this is a CI environment'), false)
  check('non-CI: it is the malformed-id branch', notCI.err.includes('malformed sanctioning row id'), true)

  // CI outranks everything: the same malformed id under CI still reports CI.
  const ciMalformed = runAssembler(['--land-structural=not-a-row-id'], { CI: 'true' })
  check('CI outranks the id check', ciMalformed.err.includes('this is a CI environment'), true)

  // And the flag is write-mode only — a sanction cannot ride along on --check.
  const onCheck = runAssembler(['--check', '--land-structural=ASSEMBLE-LAND-STRUCTURAL-1'])
  check('--check refuses the flag', [onCheck.code, onCheck.err.includes('write-mode only')], [1, true])
}

// ── 21. The sanctioning row must EXIST, in a state that names someone. ───
heading(21, 'board lookup: claimed/ and done/ sanction, queued/ does not, and no board at all refuses (SO #34c)')
{
  // A throwaway board fixture: real directories, real files, real existsSync —
  // driven through the same functions the runner uses, with no env override
  // surface added to production code to make it testable.
  const tmp = mkdtempSync(resolve(tmpdir(), 'acg-'))
  try {
    const board = resolve(tmp, 'ws', 'board')
    for (const d of ['queued', 'claimed', 'done']) mkdirSync(resolve(board, d), { recursive: true })
    writeFileSync(resolve(board, 'STANDING-ORDERS.md'), '# fixture board\n')
    writeFileSync(resolve(board, 'queued', 'QUEUED-ROW-1.md'), 'q\n')
    writeFileSync(resolve(board, 'claimed', 'CLAIMED-ROW-1.md'), 'c\n')
    writeFileSync(resolve(board, 'done', 'DONE-ROW-1.md'), 'd\n')
    const worktreeScripts = resolve(tmp, 'ws', '.wt', 'some-row', 'scripts')
    mkdirSync(worktreeScripts, { recursive: true })

    check('sanction states are exactly claimed and done', [...BOARD_SANCTION_DIRS], ['claimed', 'done'])
    check('found from a repo root', findBoardRoot(resolve(tmp, 'ws', 'repo'), { levels: 2 }), board)
    check('found from inside a .wt worktree (the normal case)', findBoardRoot(worktreeScripts, { levels: 4 }), board)

    // The marker file is what makes it a board — a bare directory named "board"
    // must not be mistaken for one.
    const decoy = resolve(tmp, 'decoy', 'board')
    mkdirSync(decoy, { recursive: true })
    check('a board/ without STANDING-ORDERS.md is not a board', findBoardRoot(resolve(tmp, 'decoy'), { levels: 0 }), null)
    check('no board above the tree at all', findBoardRoot(resolve(tmp, 'nothing', 'here'), { levels: 0 }), null)

    check('claimed/ sanctions', resolveSanctionRow('CLAIMED-ROW-1', board).state, 'claimed')
    check('claimed/ is ok', resolveSanctionRow('CLAIMED-ROW-1', board).ok, true)
    check('done/ sanctions', [resolveSanctionRow('DONE-ROW-1', board).ok, resolveSanctionRow('DONE-ROW-1', board).state], [true, 'done'])

    // ⛔ RED: queued means nobody claimed it, so it names no responsible party.
    const queued = resolveSanctionRow('QUEUED-ROW-1', board)
    check('queued/ does NOT sanction', queued.ok, false)
    check('queued/ is told apart from missing, and says how to fix it', /still in queued\/.*Claim it first/s.test(queued.reason), true)

    // ⛔ RED: a well-formed id naming nothing.
    const missing = resolveSanctionRow('NO-SUCH-ROW-1', board)
    check('a row that does not exist refuses', [missing.ok, missing.state], [false, null])

    // ⛔ RED: absence is a third state, never a green (SO #34c).
    const noBoard = resolveSanctionRow('CLAIMED-ROW-1', null)
    check('no board => refuse, never assume', noBoard.ok, false)
    check('and it says why', noBoard.reason.includes('cannot be verified to exist'), true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  // The live board is reachable from the real tree when there is one. Both
  // outcomes are legitimate (CI checkouts carry no board), so this asserts the
  // type, not a value — it is the wiring that is under test.
  const live = findBoardRoot(REPO)
  check('findBoardRoot returns a path or null against the real tree', live === null || existsSync(resolve(live, 'STANDING-ORDERS.md')), true)
}

// ── 22. ⛔ NO AUTOMATION PATH MAY REACH THE FLAG. ────────────────────────
// The CI env check is defeatable by whoever controls the env (it is documented
// as such in assemble-chaingraph.mjs). This is the other half: our own CI can
// never be the thing that defeats it, because wiring the flag into a workflow
// reds this gate before that workflow ever runs.
heading(22, 'no workflow in .github/workflows passes --land-structural')
{
  // Enumerated with `git ls-files`, never a directory walk (SO #52) — this
  // workspace holds dozens of live worktrees and a recursive walk would read
  // other sessions' branches.
  const workflows = gitSync(['ls-files', '--', '.github/workflows'], { cwd: REPO })
    .split('\n').map((s) => s.trim()).filter(Boolean)
  check('workflow files were actually enumerated', workflows.length > 0, true)
  const offenders = workflows.filter((f) => readFileSync(resolve(REPO, f), 'utf8').includes('--land-structural'))
  check(`none of the ${workflows.length} workflow files passes the flag`, offenders, [])
}

// ── 23. ⛔ AUTO-LAND IS NOT WIDENED BY ONE CASE. ─────────────────────────
// The flag lives in the RUNNER, downstream of the verdict. classifyAssembly
// takes no sanction parameter and cannot be talked into one, so copy-only and
// additive diffs land exactly as ruling 48 has them and a structural diff is
// still REFUSED by the classifier even while a human is overriding it.
heading(23, 'copy-only and additive-auto are unchanged; no option name makes the classifier auto-land a structural edit')
{
  // ONE COPY-ONLY, QUOTED: aml-programme's description reword (121758de).
  const copyAfter = chain('aml-programme')
  const copyBefore = clone(copyAfter)
  copyBefore.description = copyBefore.description.replace('Full receipted run', 'Full audited run')
  const copyOnly = classifyAssembly(...pair([copyBefore], [copyAfter]))
  check('copy-only chain edit still AUTO-LANDs', copyOnly.verdict, 'AUTO-LAND')
  check('and is still classed chain-copy-edit on description', copyOnly.allowed.map(describeChange), ['chain-copy-edit aml-programme [description]'])

  // ONE ADDITIVE-AUTO, QUOTED: a chain absent from committed, present in assembled.
  const added = chain('ap2-x402-cart-correlation')
  const additive = classifyAssembly(...pair([], [added]))
  check('purely additive new chain still AUTO-LANDs', additive.verdict, 'AUTO-LAND')
  check('and is still classed chain-added', additive.allowed.map(describeChange), ['chain-added ap2-x402-cart-correlation'])

  // The allowlist itself did not gain a member.
  check('COPY_ONLY_CHAIN_FIELDS is still exactly the two prose fields', [...COPY_ONLY_CHAIN_FIELDS], ['description', 'title'])

  // ⛔ RED: the classifier has no sanction parameter and honours no invented
  // option. A structural edit is REFUSED however it is asked.
  const structAfter = clone(copyAfter)
  structAfter.steps = (structAfter.steps ?? []).slice(0, 1)
  check('classifyAssembly takes exactly two required parameters', classifyAssembly.length, 2)
  for (const opts of [
    undefined,
    { landStructural: 'ASSEMBLE-LAND-STRUCTURAL-1' },
    { sanction: true, rowId: 'ASSEMBLE-LAND-STRUCTURAL-1', force: true },
    { targetExists: () => true },
  ]) {
    const r = classifyAssembly(...pair([copyAfter], [structAfter]), opts)
    check(`structural edit REFUSED with opts=${JSON.stringify(opts ?? null)}`, [r.verdict, r.refusals[0].kind], ['REFUSED', 'chain-structural-edit'])
  }
}

// ── 24. The refusal text, the sanction text, the printed diff, the stamp. ─
heading(24, 'refusalLine is byte-unchanged; sanctionLine names the row; the diff prints both sides; the stamp appends')
{
  const after = chain('aml-programme')
  const structural = clone(after)
  structural.steps = (structural.steps ?? []).slice(0, 1)
  const r = classifyAssembly(...pair([after], [structural]))
  const [refusal] = r.refusals

  // The no-flag refusal a session sees is EXACTLY what it was before this row.
  check('refusalLine still ends with the sentence that names the human row',
    refusalLine(refusal, { annotate: false }).endsWith('chaingraph.json was NOT written; this diff needs an explicit human ASSEMBLE/LAND row.'), true)
  check('refusalLine still opens REFUSED, not SANCTIONED', refusalLine(refusal, { annotate: false }).startsWith('REFUSED  chaingraph assembly REFUSED — chain-structural-edit aml-programme [steps]'), true)

  // The sanctioned line keeps the refusal reason — a human override does not
  // change the classifier's verdict, and the log must not pretend it did.
  const sl = sanctionLine(refusal, 'ASSEMBLE-LAND-STRUCTURAL-1')
  check('sanctionLine names the change', sl.startsWith('SANCTIONED  chain-structural-edit aml-programme [steps]'), true)
  check('sanctionLine names the authorising row', sl.includes('human ASSEMBLE/LAND row ASSEMBLE-LAND-STRUCTURAL-1'), true)
  check('sanctionLine still carries the refusal reason', sl.includes(refusal.reason), true)

  // The FULL diff: the field that moved, with both values, not a summary.
  const diff = formatStructuralDiff({ nodes: [], chains: [after] }, { nodes: [], chains: [structural] }, r.refusals).join('\n')
  check('diff names the changed field', diff.includes('field "steps"'), true)
  check('diff labels both sides', diff.includes('--- committed ---') && diff.includes('+++ assembled +++'), true)
  check('diff carries the committed step count, not a summary', diff.includes(JSON.stringify(after.steps, null, 2)), true)
  check('diff carries the assembled value too', diff.includes(JSON.stringify(structural.steps, null, 2)), true)

  // A removal prints the whole object that is about to stop existing.
  const removal = classifyAssembly(...pair([after], []))
  const removalDiff = formatStructuralDiff({ nodes: [], chains: [after] }, { nodes: [], chains: [] }, removal.refusals).join('\n')
  check('a chain removal prints the full committed object', removalDiff.includes('REMOVED chain — full committed object:'), true)
  check('and the object itself', removalDiff.includes(JSON.stringify(after, null, 2)), true)

  // The stamp: shape, append-only, and where it lands in the file.
  const entry = sanctionEntry('ASSEMBLE-LAND-STRUCTURAL-1', 'claimed', r.refusals, new Date('2026-08-23T12:00:00Z'))
  check('entry shape', entry, {
    row: 'ASSEMBLE-LAND-STRUCTURAL-1',
    row_state: 'claimed',
    landed_utc: '2026-08-23T12:00:00.000Z',
    sanctioned: ['chain-structural-edit aml-programme [steps]'],
  })

  const meta0 = { _comment: 'c', order: { nodes: [], chains: [] }, raw: { header: 'h' } }
  const meta1 = buildSanctionStamp(meta0, entry)
  check('the ledger lands right after _comment', Object.keys(meta1), ['_comment', 'structural_landings', 'order', 'raw'])
  check('the first stamp is the only entry', meta1.structural_landings, [entry])
  check('the rest of meta is carried through untouched', [meta1.order, meta1.raw], [meta0.order, meta0.raw])
  check('the input object is not mutated', 'structural_landings' in meta0, false)

  const entry2 = sanctionEntry('ART99-GHOST-CLEANUP-2', 'done', [], new Date('2026-08-24T00:00:00Z'))
  const meta2 = buildSanctionStamp(meta1, entry2)
  check('append-only: the earlier entry survives verbatim', meta2.structural_landings, [entry, entry2])
  check('key order is stable across repeated stamps', Object.keys(meta2), ['_comment', 'structural_landings', 'order', 'raw'])

  // Nothing here depends on _comment existing.
  check('meta without _comment gets the ledger first', Object.keys(buildSanctionStamp({ order: {} }, entry)), ['structural_landings', 'order'])

  // The live meta file has no ledger yet — this row proves the path and leaves
  // no entry behind (its own GREEN proof is reverted; see the PR body).
  check('chaingraph.meta.json parses and round-trips through the stamp builder',
    Object.keys(buildSanctionStamp(JSON.parse(readFileSync(META_PATH, 'utf8')), entry)).slice(0, 2), ['_comment', 'structural_landings'])
}

if (failures > 0) {
  console.error(`\n✗ assemble-chaingraph.selftest: ${failures} assertion(s) failed.`)
  process.exit(1)
}
console.log('\n✓ assemble-chaingraph.selftest: classifier proved on every verdict — auto-land, refuse, clean — and --land-structural proved human-only (CI refusal exercised on the real script, in a real child process, with a real CI environment).')
