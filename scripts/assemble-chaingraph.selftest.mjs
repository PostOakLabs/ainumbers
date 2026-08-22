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
 * Usage: node scripts/assemble-chaingraph.selftest.mjs   (exit 1 on any failure)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyAssembly,
  describeChange,
  refusalLine,
  composerUrlToRepoPath,
  repoTargetExists,
  COPY_ONLY_CHAIN_FIELDS,
  REFUSAL_EXIT_CODE,
} from './assemble-chaingraph.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const CHAINS_DIR = resolve(REPO, 'chaingraph/graph/chains')
const NODES_DIR = resolve(REPO, 'chaingraph/graph/nodes')
const META_PATH = resolve(REPO, 'chaingraph/chaingraph.meta.json')

const chain = (name) => JSON.parse(readFileSync(resolve(CHAINS_DIR, `${name}.json`), 'utf8'))
const node = (id) => JSON.parse(readFileSync(resolve(NODES_DIR, `${id}.json`), 'utf8'))
const clone = (o) => JSON.parse(JSON.stringify(o))

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
  const before = chain('agentic-checkout')
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
  const before = chain('agentic-checkout')
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
  const before = chain('agentic-checkout')

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

if (failures > 0) {
  console.error(`\n✗ assemble-chaingraph.selftest: ${failures} assertion(s) failed.`)
  process.exit(1)
}
console.log('\n✓ assemble-chaingraph.selftest: classifier proved on every verdict — auto-land, refuse, clean.')
