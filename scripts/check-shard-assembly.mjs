#!/usr/bin/env node
/**
 * scripts/check-shard-assembly.mjs — ASSEMBLE-COVER-1 gate (nodes),
 * extended by CHAINORDER-GATE-1 to cover chain shards too.
 *
 * Detects UNASSEMBLED SHARDS: a file in chaingraph/graph/nodes/*.json whose
 * tool_id, or chaingraph/graph/chains/*.json whose chain name, is absent
 * from the assembled chaingraph/chaingraph.json node/chain set. Node case is
 * the failure class ASSEMBLE-LAND-3 (missed art-386) and ASSEMBLE-LAND-5
 * (missed art-407) both hit. Chain case is CHAINORDER-GATE-1: PACKS-MUNI-1
 * (PR #1062) and PACKS-SEC16-1 (PR #1063) both merged with their chain shard
 * present but absent from chaingraph.meta.json's order.chains, so
 * assemble-chaingraph.mjs never picked them up — every gate stayed green
 * because nothing enumerated chain shard files against the assembled set.
 * Only a later, unrelated land row (PACKS-ASSEMBLE-LAND-2) noticed by
 * chance. This gate closes that: same detection this file already ran for
 * nodes, now run for chains too.
 *
 * NODE-REGISTRATION-GAP-1 (2026-08-15): six kernel-row lands (art-595,
 * art-615, art-616, art-618, art-619, art-620) each wrote a node shard file
 * but never appended its id to chaingraph.meta.json's order.nodes, so
 * assemble-chaingraph.mjs never included them — verify-counts.mjs stayed
 * green throughout because it derives every sentinel FROM chaingraph.json,
 * which agreed with itself while disagreeing with the filesystem. THIS gate
 * is the one that can see that class, so it is now promoted BLOCKING (see
 * switch below) — advisory-only let six nodes leak silently across five
 * separate lands. Also adds the REVERSE direction: a chaingraph.json node
 * whose shard file is missing from disk (registry entry with no backing
 * shard) — previously unchecked; confirmed clean at promotion time but a
 * future hand-edit of chaingraph.json could introduce it.
 *
 * ⚠ Node case is BLOCKING as of NODE-REGISTRATION-GAP-1. Chain case stays
 * ADVISORY (GATE-FREEZE, Tim 2026-07-18) since no chain-leak incident has
 * been measured — a chain shard whose CGSHARD row is mid-flight is EXPECTED
 * to be unassembled, and this gate cannot yet distinguish mid-flight from
 * stale for chains. If a chain-leak incident is ever measured, promote that
 * half the same way node case was promoted here.
 *
 * TO FLIP THE CHAIN CHECK BLOCKING (only once a chain-leak incident is
 * measured): change `const CHAINS_BLOCKING = false` below to `true`. No
 * other code changes needed — it is already wired into preflight.mjs's
 * GATES array.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SHARD-GATE-PRE-ASSEMBLE-1 (2026-08-15) — BRANCH AWARENESS.
 *
 * The node promotion above was correct and the waiver emptying that followed
 * it (NODE-REG-UNBLOCK-1) was correct, but composed they made every
 * BRAND-NEW shard row RED BY CONSTRUCTION on its own branch: the shard file
 * exists, chaingraph.json does not list it yet, and writing chaingraph.json /
 * chaingraph.meta.json / running assemble-chaingraph.mjs are ALL forbidden to
 * a class-K shard row (RIDER-KERNEL.md, STANDING-ORDERS #6 and #35). The row
 * could not satisfy the gate without breaking its own fence, so DISE-SEG-K-1
 * (PR #1281) and DISE-SEG-K-2 (PR #1282) both pushed with `--no-verify` under
 * SO #27 — and `--no-verify` was becoming the standing path for an entire row
 * class, which switches the pre-push hook off for everything else those
 * pushes carry.
 *
 * The distinction this gate now draws, from git rather than from any field a
 * shard writes about itself (SO #34: recompute from the primary source, never
 * read the claim off the artifact under test):
 *
 *   - shard file ABSENT from the base ref (origin/main) ⇒ it has never been
 *     published, so nothing downstream can be relying on it. It is a
 *     mid-flight shard awaiting its ASSEMBLE-LAND. Reported PENDING-ASSEMBLE,
 *     loudly, and NOT a failure.
 *   - shard file PRESENT on the base ref and still unregistered ⇒ this is the
 *     original NODE-REGISTRATION-GAP-1 leak, the one that cost six nodes.
 *     Still RED. Unchanged, unweakened, and the only reason the pending case
 *     can be exempted at all is that it is provably disjoint from this one.
 *
 * TWO GUARDS keep the exemption from eating the check it is carved out of:
 *
 *   (1) FAIL CLOSED ON AN UNRESOLVABLE BASE (SO #34c — a missing result is a
 *       distinct state, never a green one). If git is unavailable, the repo
 *       is not a git checkout, no base ref resolves, or the base tree reads
 *       back empty, NOTHING is exempted: every unassembled node shard is RED
 *       exactly as before this change. A shallow CI checkout therefore gets
 *       the strict pre-2026-08-15 behaviour, not a free pass.
 *   (2) NO EXEMPTION ON AN ASSEMBLING BRANCH. If the branch's own commits (or
 *       its working tree) modify chaingraph.json or chaingraph.meta.json, the
 *       branch IS the assembler — ASSEMBLE-LAND, or a local merge of a batch
 *       of shard PRs. For it, "not on main yet" is not an excuse but a
 *       description of the job it is holding: an unregistered shard on an
 *       assembling branch is RED. This closes the window branch awareness
 *       would otherwise open, because the assembling push is precisely the
 *       push that puts a shard onto main. Derived over merge-base..worktree,
 *       so a branch that has merely fallen behind main is NOT mistaken for an
 *       assembler.
 *
 * Override for an unusual checkout: `--base-ref <ref>`, or the environment
 * variable SHARD_ASSEMBLY_BASE_REF. This NAMES the ref to compare against; it
 * cannot suppress anything, because a shard present at that ref is still RED.
 * Deliberately NOT a persisted waiver list and deliberately NOT a per-shard
 * `--expect-pending` escape — NODE-REG-UNBLOCK-1 spent a whole row emptying
 * the last waiver set, and a flag a row passes to quiet a blocking gate is
 * the same object with a shorter lifetime.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Set diff logic lives in lib-shard-order.mjs (pure, unit-tested against a
 * reproduction of the PACKS-SEC16-1 case — see lib-shard-order.test.mjs) so
 * the same function backs both the node check (unchanged behavior) and the
 * chain check. The branch-awareness split is proven end to end against real
 * throwaway git repositories in check-shard-assembly.test.mjs.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SHARD-SCHEMA-PARITY-1 (2026-08-21) — SCHEMA CONFORMANCE, THE PRODUCER/
 * CONSUMER GATE SPLIT.
 *
 * The checks above answer "is this shard registered and assembled?" — they
 * say nothing about whether the shard itself is a VALID v0.4 node object.
 * art-662's shard carried a `pageless` key; the v0.4 schema is
 * `additionalProperties:false` on the node object
 * (standard/openchain-graph-v0.4.schema.json $defs.node), so assembling it
 * produced an invalid chaingraph.json — but this gate, and every other
 * PR-side check, stayed green, because none of them validated a shard
 * against the schema assembly itself applies. The producer gate (this file)
 * accepted what the consumer gate (assemble-chaingraph.mjs + schema-
 * validate.mjs, run against the ASSEMBLED chaingraph.json) rejects.
 *
 * THE FIX: every node shard on disk is validated against $defs.node by
 * shelling to `standard/schema-validate.mjs --shard <path>` (added by this
 * same row) — never a second copy of the fragment or the validator engine
 * (SO #34: a gate may not read its expectation from a copy; recompute it
 * from the primary source, which is openchain-graph-v0.4.schema.json,
 * loaded fresh by schema-validate.mjs on every invocation). This is the
 * SAME reuse pattern check-node-complete.mjs already uses for identity (a)
 * and registration (b): shell to the canonical checker, no second impl.
 *
 * SCHEMA CONFORMANCE IS BRANCH-UNAWARE, DELIBERATELY: a shard that violates
 * the schema is wrong the moment it exists on disk, whether it is mid-flight
 * (PENDING-ASSEMBLE) or already landed — unlike the registration axis above,
 * there is no state in which an unvalidated shard is "expected." So this
 * check runs over every id in nodeShardIds, unconditionally, and is
 * BLOCKING with no advisory phase and no waiver mechanism (a schema
 * violation has no legitimate mid-flight reading to wait out).
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP). git is shelled to
 * the same way the rest of this tree shells to it — same trust tier as node.
 *
 * Usage: node scripts/check-shard-assembly.mjs [--base-ref <ref>]
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { gitEnv } from './_git-env-lib.mjs'
import { findUnlistedShards } from './lib-shard-order.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const NODES_BLOCKING = true // NODE-REGISTRATION-GAP-1: promoted from advisory.
const CHAINS_BLOCKING = false // ← Flip to true once a chain-leak incident is measured.

// SHARD-SCHEMA-PARITY-1: schema conformance below is BLOCKING, unconditionally,
// with no waiver mechanism — see the header comment.
const SCHEMA_VALIDATE_PATH = resolve(root, 'chaingraph/standard/schema-validate.mjs')
const SCHEMA_PATH_REL = 'chaingraph/standard/openchain-graph-v0.4.schema.json'

// EMPTY, AND THAT IS THE POINT — the waiver is fully discharged (NODE-REG-UNBLOCK-1, 2026-08-15).
//
// HISTORY, kept so the mechanism is not mistaken for dead code. NODE-REGISTRATION-GAP-1 found six
// unregistered shards in the sweep that promoted this gate to blocking; only 2 (art-616, art-618)
// registered clean. The other 4 each tripped a DIFFERENT non-baselineable hard gate that that row's
// fence forbade crossing, so they were waivered HERE, by name, with the blocking gate stated per
// node — never a silent baseline:
//   - art-615, art-619: catalog-parity.mjs "url page missing on disk" (no chaingraph/<id>.html).
//   - art-595: FV-COVERAGE-GATE-1, floor digest no longer matched the live kernel.
//   - art-620: FV-COVERAGE-GATE-1, no __proptests__ floor file at all.
// NODE-REG-UNBLOCK-1 cleared all four blockers for real (pages authored, digest re-stamped from
// kernel bytes after re-executing the floor green, missing floor authored) and registered all four,
// removing each entry only once its own blocker was fixed. 609/609 shards are now assembled.
//
// KEEP THIS SET EMPTY. An entry here suppresses a BLOCKING gate, so adding one is a real reduction
// in coverage: it is legitimate only for a shard whose blocker is a named, non-baselineable hard
// gate that the adding row's fence genuinely forbids crossing, and it must be paired with an owning
// board row that will remove it. ⛔ A waiver with no owning row is how a temporary exception becomes
// permanent — that is exactly the drift this row existed to undo.
//
// ⚠ SHARD-GATE-PRE-ASSEMBLE-1 did NOT re-populate this set and did not need to: the mid-flight-shard
// case it fixed is DERIVED from git, per shard, per run, and expires by itself the moment the shard
// reaches the base ref. A derived distinction cannot go stale the way a written-down name does.
const PAGE_BLOCKED_WAIVER = new Set([])

const NODES_DIR = resolve(root, 'chaingraph/graph/nodes')
const CHAINS_DIR = resolve(root, 'chaingraph/graph/chains')
const CG_PATH = resolve(root, 'chaingraph/chaingraph.json')

const NODES_DIR_REL = 'chaingraph/graph/nodes'
const CG_REL = 'chaingraph/chaingraph.json'
const META_REL = 'chaingraph/chaingraph.meta.json'

// ── git helpers ───────────────────────────────────────────────────────────
// Each returns null / false rather than throwing, so an environment without
// git degrades to the strict pre-branch-awareness behaviour (guard 1) instead
// of crashing the gate.

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      env: gitEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

function gitOk(args) {
  try {
    execFileSync('git', args, { cwd: root, env: gitEnv(), stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function parseBaseRefArg(argv) {
  const i = argv.indexOf('--base-ref')
  if (i !== -1 && argv[i + 1]) return { ref: argv[i + 1], why: '--base-ref' }
  const eq = argv.find((a) => a.startsWith('--base-ref='))
  if (eq) return { ref: eq.slice('--base-ref='.length), why: '--base-ref' }
  if (process.env.SHARD_ASSEMBLY_BASE_REF) {
    return { ref: process.env.SHARD_ASSEMBLY_BASE_REF, why: 'SHARD_ASSEMBLY_BASE_REF' }
  }
  return null
}

// Candidate base refs, most authoritative first. GITHUB_BASE_REF is set on a
// pull_request event; it only helps when the checkout actually fetched that
// branch (fetch-depth: 0), and when it did not, resolution fails and guard
// (1) takes over.
function baseRefCandidates() {
  const explicit = parseBaseRefArg(process.argv.slice(2))
  if (explicit) return [explicit]
  const out = [{ ref: 'origin/main', why: 'default' }]
  if (process.env.GITHUB_BASE_REF) {
    out.push({ ref: `origin/${process.env.GITHUB_BASE_REF}`, why: 'GITHUB_BASE_REF' })
  }
  return out
}

// Shard ids present in `dirRel` at `ref`, recomputed from the git object
// store — never read from the working tree, which is the thing under test.
function shardIdsAtRef(ref, dirRel) {
  const out = git(['ls-tree', '--name-only', ref, '--', `${dirRel}/`])
  if (out === null) return null
  const ids = out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.json'))
    .map((l) => l.slice(l.lastIndexOf('/') + 1, -'.json'.length))
  // An empty listing means we resolved something that is not this repo's main
  // line (or a tree with no shard directory at all). Treat that as
  // unresolvable rather than as "no shard has ever been published" — the
  // latter reading would exempt every shard in the tree at once.
  return ids.length === 0 ? null : new Set(ids)
}

function resolveBase() {
  const attempted = []
  if (!gitOk(['rev-parse', '--is-inside-work-tree'])) {
    return { base: null, attempted, reason: 'not a git work tree (or git unavailable)' }
  }
  for (const cand of baseRefCandidates()) {
    const sha = git(['rev-parse', '--verify', '--quiet', `${cand.ref}^{commit}`])
    if (!sha) {
      attempted.push(`${cand.ref} (${cand.why}) — ref does not resolve`)
      continue
    }
    const ids = shardIdsAtRef(cand.ref, NODES_DIR_REL)
    if (!ids) {
      attempted.push(`${cand.ref} (${cand.why}) — resolved, but ${NODES_DIR_REL}/ is empty at that ref`)
      continue
    }
    const when = (git(['log', '-1', '--format=%cI', cand.ref]) || '').trim()
    return {
      base: { ref: cand.ref, why: cand.why, sha: sha.trim().slice(0, 12), when, ids },
      attempted,
      reason: null,
    }
  }
  return { base: null, attempted, reason: 'no candidate base ref resolved' }
}

// Guard (2). "Is this branch doing assembly work?" — measured over
// merge-base..working-tree so a branch that has merely fallen behind main
// (and therefore carries an older chaingraph.json) is not mistaken for one
// that is rewriting it.
function branchIsAssembling(baseRef) {
  const mb = git(['merge-base', baseRef, 'HEAD'])
  if (!mb) return true // cannot tell ⇒ assume assembler ⇒ no exemption.
  return !gitOk(['diff', '--quiet', mb.trim(), '--', CG_REL, META_REL])
}

// ── shard sets on disk vs assembled ───────────────────────────────────────

function shardIdsOnDisk(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort()
}

const nodeShardIds = shardIdsOnDisk(NODES_DIR)
const chainShardIds = shardIdsOnDisk(CHAINS_DIR)

// ── schema conformance (SHARD-SCHEMA-PARITY-1) ─────────────────────────────
// Every node shard on disk, validated against $defs.node — the same fragment
// assembly validates against, loaded fresh from the schema file by
// schema-validate.mjs on every call, never a second copy here.
function checkShardSchema(id) {
  const shardPath = resolve(NODES_DIR, `${id}.json`)
  try {
    execFileSync('node', [SCHEMA_VALIDATE_PATH, '--shard', shardPath], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return null
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).toString().trim()
    return { id, detail: out }
  }
}

const schemaFailures = nodeShardIds.map(checkShardSchema).filter(Boolean)

const graph = JSON.parse(readFileSync(CG_PATH, 'utf8'))
const assembledNodeIds = graph.nodes.map((n) => n.tool_id)
const assembledChainNames = graph.chains.map((c) => c.name)

function describeUnassembled(dir, ids) {
  return ids.map((id) => {
    let label = '(unreadable)'
    try {
      const shard = JSON.parse(readFileSync(resolve(dir, `${id}.json`), 'utf8'))
      label = shard.mcp_name ?? shard.name ?? '(no name field)'
    } catch {
      // shard itself is malformed — still report the id
    }
    return { id, label }
  })
}

const allUnassembledNodeIds = findUnlistedShards(nodeShardIds, assembledNodeIds)
const waivedNodeIds = allUnassembledNodeIds.filter((id) => PAGE_BLOCKED_WAIVER.has(id))
const candidateNodeIds = allUnassembledNodeIds.filter((id) => !PAGE_BLOCKED_WAIVER.has(id))
const unassembledChainIds = findUnlistedShards(chainShardIds, assembledChainNames)
const waivedNodes = describeUnassembled(NODES_DIR, waivedNodeIds)
const unassembledChains = describeUnassembled(CHAINS_DIR, unassembledChainIds)

// Reverse direction (nodes only, NODE-REGISTRATION-GAP-1): a chaingraph.json
// node whose shard file is absent from disk — a registry entry with no
// backing shard. Chains carry no reverse check (no incident measured yet).
// NOT branch-aware, deliberately: assembly cannot proceed at all without the
// file, so there is no mid-flight reading of this state.
const nodeShardIdSet = new Set(nodeShardIds)
const orphanedNodeIds = assembledNodeIds.filter((id) => !nodeShardIdSet.has(id)).sort()

// ── branch-aware split of the unassembled node shards ─────────────────────
// Consulted only when there is something to classify, so the common clean run
// costs no git at all.

let pendingNodeIds = []
let leakedNodeIds = candidateNodeIds
let baseNote = null

if (candidateNodeIds.length > 0) {
  const { base, attempted, reason } = resolveBase()
  if (!base) {
    baseNote =
      `check-shard-assembly: BASE REF UNRESOLVED (${reason}) — FAILING CLOSED, no shard is treated as ` +
      `mid-flight (SO #34c: a missing result is a distinct state, never a green one).` +
      (attempted.length ? `\n  attempted: ${attempted.join('; ')}` : '') +
      `\n  Pass --base-ref <ref> (or set SHARD_ASSEMBLY_BASE_REF) if this checkout names its main line differently.`
  } else if (branchIsAssembling(base.ref)) {
    baseNote =
      `check-shard-assembly: base ${base.ref} @ ${base.sha}${base.when ? ` (${base.when})` : ''} — but this ` +
      `branch MODIFIES ${CG_REL} or ${META_REL}, so it is an ASSEMBLING branch and gets NO mid-flight ` +
      `exemption: registering every shard it carries is exactly its job (SHARD-GATE-PRE-ASSEMBLE-1 guard 2).`
  } else {
    pendingNodeIds = candidateNodeIds.filter((id) => !base.ids.has(id))
    leakedNodeIds = candidateNodeIds.filter((id) => base.ids.has(id))
    baseNote =
      `check-shard-assembly: branch-aware split against ${base.ref} @ ${base.sha}` +
      `${base.when ? ` (${base.when})` : ''}, resolved via ${base.why}; ${base.ids.size} node shard(s) published there.`
  }
}

const pendingNodes = describeUnassembled(NODES_DIR, pendingNodeIds)
const unassembledNodes = describeUnassembled(NODES_DIR, leakedNodeIds)

// ── report ────────────────────────────────────────────────────────────────

if (waivedNodes.length > 0) {
  console.log(`check-shard-assembly: ${waivedNodes.length} node shard(s) under an explicit PAGE_BLOCKED_WAIVER (see top of this file) — informational, not a failure:`)
  for (const { id, label } of waivedNodes) {
    console.log(`  - ${id}  (mcp_name: ${label})`)
  }
}

if (baseNote) console.log(baseNote)

if (pendingNodes.length > 0) {
  console.log(`check-shard-assembly: PENDING-ASSEMBLE — ${pendingNodes.length} node shard(s) present on this branch but ABSENT from the base ref, so they are mid-flight shards awaiting ASSEMBLE-LAND, not a registration leak:`)
  for (const { id, label } of pendingNodes) {
    console.log(`  - ${id}  (mcp_name: ${label})  [new on this branch]`)
  }
  console.log('check-shard-assembly: PENDING-ASSEMBLE is INFORMATIONAL, and it is not a pass for the shard itself — ASSEMBLE-LAND must still append the id(s) to chaingraph.meta.json order.nodes and re-run scripts/assemble-chaingraph.mjs. The moment such a shard reaches the base ref unregistered, this gate turns RED on it.')
}

if (
  unassembledNodes.length === 0 &&
  unassembledChains.length === 0 &&
  orphanedNodeIds.length === 0 &&
  schemaFailures.length === 0
) {
  const accountedFor = nodeShardIds.length - waivedNodes.length - pendingNodes.length
  console.log(`check-shard-assembly: OK — all ${accountedFor}/${nodeShardIds.length} node shard(s) (excluding ${waivedNodes.length} waived, ${pendingNodes.length} pending-assemble) and ${chainShardIds.length} chain shard(s) are present in the assembled chaingraph.json, every assembled node has a backing shard, and all ${nodeShardIds.length} node shard(s) on disk validate against $defs.node in ${SCHEMA_PATH_REL}.`)
  process.exit(0)
}

let nodesFailed = false

if (schemaFailures.length > 0) {
  nodesFailed = true
  console.log(`check-shard-assembly: ${schemaFailures.length} node shard(s) FAIL v0.4 schema validation against $defs.node in ${SCHEMA_PATH_REL} (SHARD-SCHEMA-PARITY-1 — this is the producer/consumer gate split: assembly would reject these too):`)
  for (const { id, detail } of schemaFailures) {
    console.log(`  - ${id}:`)
    for (const line of detail.split('\n')) console.log(`      ${line}`)
  }
}

if (unassembledNodes.length > 0) {
  nodesFailed = true
  console.log(`check-shard-assembly: ${unassembledNodes.length} node shard(s) not yet in the assembled chaingraph.json:`)
  for (const { id, label } of unassembledNodes) {
    console.log(`  - ${id}  (mcp_name: ${label})`)
  }
}
if (orphanedNodeIds.length > 0) {
  nodesFailed = true
  console.log(`check-shard-assembly: ${orphanedNodeIds.length} node(s) registered in chaingraph.json with NO backing shard file:`)
  for (const id of orphanedNodeIds) {
    console.log(`  - ${id}`)
  }
}
if (unassembledChains.length > 0) {
  console.log(`check-shard-assembly: ${unassembledChains.length} chain shard(s) not yet in the assembled chaingraph.json — this is EXPECTED for a shard whose land is still in flight, not necessarily a defect:`)
  for (const { id, label } of unassembledChains) {
    console.log(`  - ${id}  (name: ${label})`)
  }
}
console.log('check-shard-assembly: if none of these are mid-flight CGSHARD rows, an ASSEMBLE+LAND pass was missed (node case) or chaingraph.json was hand-edited (orphan case) — see board/STANDING-ORDERS.md #6.')

if (schemaFailures.length > 0) {
  console.log('check-shard-assembly: FAILING — schema case is BLOCKING, unconditionally, no waiver (SHARD-SCHEMA-PARITY-1). Fix the shard itself (drop the unknown property / add the missing required field) — this is not a registration or assembly-ordering issue.')
  process.exit(1)
}
if (nodesFailed && NODES_BLOCKING) {
  console.log('check-shard-assembly: FAILING — node case is BLOCKING (NODE-REGISTRATION-GAP-1). Append the id(s) to chaingraph.meta.json order.nodes and re-run scripts/assemble-chaingraph.mjs, or add the missing shard file.')
  process.exit(1)
}
if (unassembledChains.length > 0 && CHAINS_BLOCKING) {
  process.exit(1)
}

console.log('check-shard-assembly: exiting 0 (chain case advisory; node case clean or its BLOCKING switch is off).')
process.exit(0)
