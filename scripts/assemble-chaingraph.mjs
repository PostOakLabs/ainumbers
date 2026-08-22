#!/usr/bin/env node
/**
 * scripts/assemble-chaingraph.mjs — generates chaingraph/chaingraph.json from
 * its shards (chaingraph/graph/nodes/*.json, chaingraph/graph/chains/*.json,
 * chaingraph.meta.json). chaingraph.json is a COMMITTED GENERATED artifact,
 * same pattern as kernels/index.mjs — consumers (generate.mjs vendor copy,
 * worker, gates, runtime pages) keep reading it unchanged.
 *
 * New waves write shard files directly (chaingraph/graph/nodes/<tool_id>.json
 * + chaingraph/graph/chains/<name>.json) and append their id/name to
 * chaingraph.meta.json's order.nodes/order.chains — NEVER push into the
 * monolith. Run this script to regenerate chaingraph.json afterward.
 *
 * Modes:
 *   node scripts/assemble-chaingraph.mjs           # writes chaingraph.json
 *   node scripts/assemble-chaingraph.mjs --check   # verify only, exit 1 on drift
 *   node scripts/assemble-chaingraph.mjs --enroll  # append any node shard on
 *                                                   # disk missing from
 *                                                   # order.nodes, then write
 *                                                   # (ASSEMBLE-MAINSIDE-ENROLL-1;
 *                                                   # what the main-side regen
 *                                                   # workflow runs)
 *   node scripts/assemble-chaingraph.mjs --refusal-status
 *                                                   # exit 3 if the pending
 *                                                   # shard diff is REFUSED
 *                                                   # class (see PART 2 below)
 *
 * ── THE THREE VERDICTS (ASSEMBLE-CHAIN-CLASSIFY-1, 2026-08-22) ─────────────
 *
 * Write mode runs UNATTENDED from .github/workflows/derived-artifacts-regen.yml
 * after every push to main, so it must decide, on the change itself and never
 * on who is asking, whether a diff may land without a human reading it.
 *
 *   (a) AUTO-LAND — COPY-ONLY CHAIN EDIT. An existing chain whose ONLY
 *       differing top-level fields are in COPY_ONLY_CHAIN_FIELDS below:
 *
 *           description   title
 *
 *       and NOTHING else. Every other chain field — `name` (identity),
 *       `domain` (taxonomy/grouping), `composer_url` (a resolvable link
 *       target), `steps` (membership, order, handoff prose and gates),
 *       `branches`, `regulatory_refs`, `regulatory_basis_*`, `spec_version`,
 *       `wave`, `id`, `export_capability` — is STRUCTURAL by definition and
 *       falls to (c). The list is an ALLOWLIST, so a chain field invented
 *       tomorrow is refused until someone deliberately classifies it.
 *
 *       CONSEQUENCE, STATED SO A READER CAN PREDICT THE VERDICT: because
 *       `steps` is not on the allowlist, a chain's steps/edges/order/node
 *       membership must be deep-equal for (a) to apply, and a diff that
 *       reworded a description AND moved a step is (c), not (a). Prose that
 *       lives inside `steps` (a step's `handoff`) is NOT copy-only — chain
 *       formal verification reads handoffs, so they are graph content.
 *
 *   (b) AUTO-LAND — PURELY ADDITIVE NEW CHAIN. A chain `name` absent from the
 *       committed artifact and present in the assembled one. It modifies and
 *       removes nothing by construction.
 *
 *   (c) REFUSE — EVERYTHING ELSE. Explicitly: any structural chain
 *       modification (per (a)), any chain removal or rename, and any node
 *       removal or rename. These still require an explicit human
 *       ASSEMBLE/LAND row. This half of the guard did not weaken.
 *
 *   Node ADDITIONS and node CONTENT changes auto-land, exactly as they did
 *   before this classifier existed — a node-only diff is unaffected.
 *
 *   COMPOSITION: a diff is AUTO-LAND only when EVERY change in it is
 *   independently (a), (b) or an allowed node change. One refusal refuses the
 *   whole write — assembly splices the full shard set, so there is no way to
 *   write "just the allowed part" without also writing the refused part.
 *
 * ── PART 2: A REFUSAL IS NEVER A SILENT GREEN ─────────────────────────────
 *
 * Before this row, a refusal printed a notice and exited 0. `Derived Artifacts
 * Regen` therefore reported SUCCESS on 7+ consecutive commits while writing
 * nothing, and main stayed red on a 2-byte wording drift nobody could see the
 * cause of. A workflow that can decline to act and still report success turns
 * a loud failure into an invisible one.
 *
 * So every refusal now emits a GitHub `::error` annotation naming the refused
 * chain/node and the reason, and `--refusal-status` — a separate, recomputed
 * check the workflow runs as its LAST step — exits 3 so the run's own
 * conclusion reads FAILURE. Write mode itself still exits 0 on a refusal, on
 * purpose: derived-artifacts.mjs --regen stops at the first non-zero generator,
 * so failing there would leave every OTHER shared artifact stale as well. The
 * refusal must be loud, not contagious.
 *
 * CANONICAL ORDER (CS-2, replaces CS-1's migration-mode byte-parity glue):
 * nodes are emitted sorted by tool_id, chains sorted by name, both via a
 * numeric-aware natural sort (so "art-9" < "art-10" < "art-100", not
 * lexical). order.nodes/order.chains in chaingraph.meta.json are the SET of
 * shard ids to include — a future WU only needs to append its id there;
 * this script re-sorts at assembly time regardless of array position, so
 * append order never affects the emitted order. Separators between elements
 * are uniform (",\n    " between elements, "\n  " after the last) since
 * shard formatting is already normalized — no more per-position separator
 * array. meta.raw.header/betweenNodesAndChains/footer (the fixed wrapper
 * text: $schema, version, metadata block, closing brace) are unchanged by
 * this flip — only node/chain ORDER and inter-element whitespace changed.
 *
 * CANONICAL SHARD FORMAT (SHARD-DRIFT-CLASSIFY-1): a node shard's
 * `compute_images` array and siblings COMPACT to one line
 * (`"compute_images": [{...}]`, not one key/element per line) — every
 * pre-ZK shard already looks like this. This assembler splices shard text
 * VERBATIM (readShard/joinShards above), so shard format IS artifact
 * format: a shard written multi-line ships multi-line into chaingraph.json
 * and immediately drifts against this rule. Match an existing compact
 * shard, don't reformat after the fact.
 *
 * Self-test: scripts/assemble-chaingraph.selftest.mjs (imports
 * classifyAssembly() below and drives it over the real historical diffs this
 * classifier exists to sort — RED and GREEN cases both).
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const CG_PATH = resolve(root, 'chaingraph/chaingraph.json')
const NODES_DIR = resolve(root, 'chaingraph/graph/nodes')
const CHAINS_DIR = resolve(root, 'chaingraph/graph/chains')
const META_PATH = resolve(root, 'chaingraph/chaingraph.meta.json')

/** Exit code for "I declined to write" — distinct from 1 (drift/error). */
export const REFUSAL_EXIT_CODE = 3

/**
 * Verdict (a)'s allowlist: the ONLY chain top-level fields whose change may be
 * auto-landed. Reader-facing prose and nothing else. Deliberately does NOT
 * include `composer_url`: a URL is a machine-resolvable link target, not
 * wording, and admitting it would make the rule "prose, plus one URL field",
 * which is a carve-out rather than a line a reviewer can predict.
 */
export const COPY_ONLY_CHAIN_FIELDS = Object.freeze(['description', 'title'])

const CHECK = process.argv.includes('--check')
const ENROLL = process.argv.includes('--enroll')
const REFUSAL_STATUS = process.argv.includes('--refusal-status')

// ASSEMBLE-COVER-1 advisory: report node shards on disk that order.nodes
// doesn't include yet — a mid-flight CGSHARD row is EXPECTED here, so this
// only informs, never fails the assembler.
function reportUnassembledShards(orderNodes) {
  const onDisk = readdirSync(NODES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
  const known = new Set(orderNodes)
  const extra = onDisk.filter((id) => !known.has(id))
  if (extra.length > 0) {
    console.log(`assemble-chaingraph: ${extra.length} node shard(s) on disk not in chaingraph.meta.json order.nodes (expected if mid-flight): ${extra.join(', ')}`)
  }
}

const naturalSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare

// ASSEMBLE-MAINSIDE-ENROLL-1: enrolment must happen BEFORE assembly, in the
// same main-side job — a node shard present on disk whose id is absent from
// order.nodes was previously assembled into nothing (art-662, PR #1412).
// APPEND-ONLY: order.nodes is an order manifest, so new ids go on the end,
// natural-sorted among themselves for determinism; existing entries are
// never reordered or removed here (that stays an explicit ASSEMBLE/LAND
// row's job — see the refusal logic below for removals/chain edits).
// meta.json round-trips byte-identically through JSON.stringify(meta, null, 2)
// (verified against the live file before this was written), so this is a
// safe whole-object rewrite, not a risky text splice.
function enrollMissingNodes(meta) {
  const onDisk = readdirSync(NODES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
  const known = new Set(meta.order.nodes)
  const missing = onDisk.filter((id) => !known.has(id)).sort(naturalSort)
  if (missing.length === 0) return
  console.log(`assemble-chaingraph: enrolling ${missing.length} node shard(s) into order.nodes: ${missing.join(', ')}`)
  meta.order.nodes = [...meta.order.nodes, ...missing]
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8')
}

// SHARD-DRIFT-CLASSIFY-1: chaingraph.json stores no literal "execution_hash"
// field — it's computed at runtime by _hash.mjs from a node's content. But
// that hash is a pure function of the content, so two byte-differing
// chaingraph.json files carry the SAME hash set iff every node's PARSED
// content is deep-equal. Canonicalize (sort keys recursively) so a pure
// formatting difference (the only kind CS-2 shard compaction produces)
// never registers as a content change.
export function canon(value) {
  if (Array.isArray(value)) return value.map(canon)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = canon(value[k])
      return acc
    }, {})
  }
  return value
}

/** Deep value equality via the canonical form. undefined === undefined. */
function deepEqual(a, b) {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b))
}

/** Top-level field names whose values differ between two objects, sorted. */
function changedFields(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((k) => !deepEqual(before[k], after[k])).sort()
}

function byKey(arr, keyField) {
  return new Map((arr ?? []).map((x) => [x[keyField], x]))
}

/**
 * THE CLASSIFIER. Pure — takes two PARSED chaingraph objects, returns what the
 * write may land and what it must refuse. No disk, no env, no git, so the
 * self-test drives it directly over real historical diffs.
 *
 * @returns {{verdict: 'CLEAN'|'AUTO-LAND'|'REFUSED', allowed: object[], refusals: object[]}}
 *   `allowed` and `refusals` entries are { kind, key, fields?, reason? }.
 *   verdict is REFUSED if refusals is non-empty, CLEAN if nothing changed at
 *   all, AUTO-LAND otherwise.
 */
export function classifyAssembly(committedObj, assembledObj) {
  const allowed = []
  const refusals = []

  // ── Nodes, keyed tool_id. Additions and content changes auto-land (this is
  // the pre-existing behaviour, unchanged); removals and renames refuse. ──
  const cNodes = byKey(committedObj.nodes, 'tool_id')
  const aNodes = byKey(assembledObj.nodes, 'tool_id')
  for (const [id, node] of aNodes) {
    if (!cNodes.has(id)) allowed.push({ kind: 'node-added', key: id })
    else if (!deepEqual(cNodes.get(id), node)) allowed.push({ kind: 'node-modified', key: id })
  }
  for (const id of cNodes.keys()) {
    if (!aNodes.has(id)) {
      refusals.push({
        kind: 'node-removed',
        key: id,
        reason: 'node removal or rename — dropping or re-identifying a published node is out of scope for the unattended assembler',
      })
    }
  }

  // ── Chains, keyed name (chains carry no id). Additions auto-land (b);
  // copy-only edits auto-land (a); everything else refuses (c). ──
  const cChains = byKey(committedObj.chains, 'name')
  const aChains = byKey(assembledObj.chains, 'name')
  for (const [name, chain] of aChains) {
    if (!cChains.has(name)) {
      allowed.push({ kind: 'chain-added', key: name })
      continue
    }
    const before = cChains.get(name)
    if (deepEqual(before, chain)) continue
    const fields = changedFields(before, chain)
    const nonCopy = fields.filter((f) => !COPY_ONLY_CHAIN_FIELDS.includes(f))
    if (nonCopy.length === 0) {
      allowed.push({ kind: 'chain-copy-edit', key: name, fields })
    } else {
      refusals.push({
        kind: 'chain-structural-edit',
        key: name,
        fields: nonCopy,
        reason: `chain field(s) outside the copy-only allowlist (${COPY_ONLY_CHAIN_FIELDS.join(', ')}) changed: ${nonCopy.join(', ')}`,
      })
    }
  }
  for (const name of cChains.keys()) {
    if (!aChains.has(name)) {
      refusals.push({
        kind: 'chain-removed',
        key: name,
        reason: 'chain removal or rename — dropping or re-identifying a published chain is out of scope for the unattended assembler',
      })
    }
  }

  let verdict = 'AUTO-LAND'
  if (refusals.length > 0) verdict = 'REFUSED'
  else if (allowed.length === 0) verdict = 'CLEAN'
  return { verdict, allowed, refusals }
}

/** One-line human summary of an allowed/refused change entry. */
export function describeChange(c) {
  const fields = c.fields?.length ? ` [${c.fields.join(', ')}]` : ''
  return `${c.kind} ${c.key}${fields}`
}

/**
 * PART 2's loud signal. A GitHub workflow command when running under Actions
 * (so the refusal surfaces as an annotation on the run), a plain line
 * otherwise. Annotations are single-line by construction — no reason string
 * here contains a newline, so no %0A escaping is needed.
 */
export function refusalLine(change, { annotate }) {
  const msg =
    `chaingraph assembly REFUSED — ${describeChange(change)}: ${change.reason}. ` +
    'chaingraph.json was NOT written; this diff needs an explicit human ASSEMBLE/LAND row.'
  return annotate ? `::error title=chaingraph assembly refused::${msg}` : `REFUSED  ${msg}`
}

function emitRefusals(refusals, { annotate }) {
  for (const r of refusals) console.log(refusalLine(r, { annotate }))
}

const IN_ACTIONS = process.env.GITHUB_ACTIONS === 'true'

// Diffs one committed/assembled array pair keyed by `keyField`, appending
// changed keys to `changedIds`. Shared by nodes (keyed tool_id) and chains
// (keyed name — chains carry no id) so the two never share one map.
function diffByKey(committedArr, assembledArr, keyField, changedIds) {
  const cMap = new Map(committedArr.map((x) => [x[keyField], JSON.stringify(canon(x))]))
  const aMap = new Map(assembledArr.map((x) => [x[keyField], JSON.stringify(canon(x))]))
  for (const [id, text] of aMap) {
    if (cMap.get(id) !== text) changedIds.push(id)
  }
  for (const id of cMap.keys()) {
    if (!aMap.has(id)) changedIds.push(id)
  }
}

// Returns { verdict: 'HASH-NEUTRAL' | 'HASH-MOVING' | null, changedIds }.
// verdict is null only on a JSON.parse failure (caller falls back to the
// plain DRIFT message, no verdict claimed). SHARD-DRIFT-CHAINS-1: folds
// .chains into the same verdict — a chain-only semantic edit (steps,
// title, domain) is vendored content too and must not read HASH-NEUTRAL.
// Chains have no `id` field (keyed `name`), so nodes and chains diff via
// separate maps (diffByKey) rather than one shared map.
function classifyDrift(committedText, assembledText) {
  let committedObj, assembledObj
  try {
    committedObj = JSON.parse(committedText)
    assembledObj = JSON.parse(assembledText)
  } catch {
    return { verdict: null, changedIds: [] }
  }
  const changedIds = []
  diffByKey(committedObj.nodes, assembledObj.nodes, 'tool_id', changedIds)
  diffByKey(committedObj.chains, assembledObj.chains, 'name', changedIds)
  return { verdict: changedIds.length === 0 ? 'HASH-NEUTRAL' : 'HASH-MOVING', changedIds }
}

function readShard(dir, id) {
  const text = readFileSync(resolve(dir, `${id}.json`), 'utf8')
  return text.endsWith('\n') ? text.slice(0, -1) : text
}

function joinShards(texts) {
  let joined = ''
  texts.forEach((text, i) => { joined += text + (i < texts.length - 1 ? ',\n    ' : '\n  ') })
  return joined
}

/**
 * Reads meta + every shard and returns the artifact text this run would emit.
 * Called by every mode, so `--refusal-status` RECOMPUTES the assembly from the
 * primary source (the shards) rather than trusting anything the write mode
 * said about itself (SO #34: a gate never reads the value it validates from
 * the artifact under test).
 */
function assembleFromShards(order, raw) {
  const nodeTexts = [...order.nodes].sort(naturalSort).map((id) => readShard(NODES_DIR, id))
  const chainTexts = [...order.chains].sort(naturalSort).map((name) => readShard(CHAINS_DIR, name))
  return raw.header + joinShards(nodeTexts) + raw.betweenNodesAndChains + joinShards(chainTexts) + raw.footer
}

/** Parses both sides and classifies; null when either side is unparseable. */
function classifyTexts(committedText, assembledText) {
  try {
    return classifyAssembly(JSON.parse(committedText), JSON.parse(assembledText))
  } catch {
    return null
  }
}

// ── Live run. Guarded so the self-test can `import` the pure classifier above
// without this script reading meta.json, assembling, or WRITING anything —
// same main-only guard scripts/check-gate-selftest-pairing.mjs uses. ────────
function main() {
const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))

if (!meta.raw) {
  console.error('assemble-chaingraph.mjs: meta.raw missing — header/footer wrapper text is required.')
  process.exit(1)
}

if (ENROLL && !CHECK && !REFUSAL_STATUS) enrollMissingNodes(meta)

const { order, raw } = meta
const assembled = assembleFromShards(order, raw)

if (REFUSAL_STATUS) {
  // The workflow's LAST step. Everything auto-landable has already been
  // written and committed by then, so this decides one thing only: does the
  // run's conclusion get to read green? A refusal means chaingraph.json is
  // still stale against its shards and no unattended write can fix it.
  let committed = ''
  try { committed = readFileSync(CG_PATH, 'utf8') } catch { /* first run */ }
  if (assembled === committed) {
    console.log('assemble-chaingraph --refusal-status: chaingraph.json matches its shards — nothing was refused.')
    process.exit(0)
  }
  const result = classifyTexts(committed, assembled)
  if (!result) {
    console.error('assemble-chaingraph --refusal-status: chaingraph.json or the assembled output failed to parse.')
    process.exit(1)
  }
  if (result.verdict === 'REFUSED') {
    emitRefusals(result.refusals, { annotate: IN_ACTIONS })
    console.log(
      `assemble-chaingraph --refusal-status: ${result.refusals.length} refused change(s) — ` +
      'chaingraph.json is STALE against its shards and the unattended assembler declined to write it. ' +
      'Exiting non-zero so this run cannot report success on a no-write.',
    )
    process.exit(REFUSAL_EXIT_CODE)
  }
  // Drift that is NOT refused-class means the write mode should have landed
  // it and did not — a distinct defect, also never a green.
  console.error(
    'assemble-chaingraph --refusal-status: chaingraph.json drifts from its shards but nothing was refused ' +
    `(${result.allowed.length} auto-landable change(s): ${result.allowed.slice(0, 5).map(describeChange).join('; ')}). ` +
    'The write step should have landed this — investigate rather than re-running.',
  )
  process.exit(1)
} else if (CHECK) {
  const committed = readFileSync(CG_PATH, 'utf8')
  if (assembled === committed) {
    console.log(`OK  chaingraph.json matches assembled output (${order.nodes.length} nodes, ${order.chains.length} chains).`)
    reportUnassembledShards(order.nodes)
    process.exit(0)
  } else {
    console.error('DRIFT  chaingraph.json does NOT match assembled output from shards.')
    console.error(`  committed length: ${committed.length}, assembled length: ${assembled.length}`)
    for (let i = 0; i < Math.min(committed.length, assembled.length); i++) {
      if (committed[i] !== assembled[i]) {
        console.error(`  first diff at byte ${i}:`)
        console.error(`  committed: ${JSON.stringify(committed.slice(Math.max(0, i - 30), i + 30))}`)
        console.error(`  assembled: ${JSON.stringify(assembled.slice(Math.max(0, i - 30), i + 30))}`)
        break
      }
    }
    const { verdict, changedIds } = classifyDrift(committed, assembled)
    if (verdict === 'HASH-NEUTRAL') {
      console.error('  HASH-NEUTRAL DRIFT — run the assembler and commit chaingraph.json in THIS push. Do NOT ride ASSEMBLE-LAND. Do NOT --no-verify.')
    } else if (verdict === 'HASH-MOVING') {
      console.error(`  HASH-MOVING DRIFT — BLOCKED-complete per RUNBOOK -0.7; the ASSEMBLE-LAND lands it per -0.6. (${changedIds.length} node(s) changed: ${changedIds.slice(0, 10).join(', ')}${changedIds.length > 10 ? ', ...' : ''})`)
    }
    // Additive: tells a reader whether the main-side regen will land this
    // drift on its own or hand it back for a human ASSEMBLE/LAND row.
    const result = classifyTexts(committed, assembled)
    if (result) {
      const detail = result.verdict === 'REFUSED'
        ? result.refusals.map(describeChange).join('; ')
        : result.allowed.slice(0, 5).map(describeChange).join('; ')
      console.error(`  ASSEMBLY VERDICT: ${result.verdict} — ${detail}`)
    }
    console.error('  Run `node scripts/assemble-chaingraph.mjs` (no --check) to regenerate, then commit chaingraph.json.')
    process.exit(1)
  }
} else {
  // ASSEMBLE-MAINSIDE-1 / ASSEMBLE-CHAIN-CLASSIFY-1: write mode runs unattended
  // from the main-side regen workflow, so it classifies the diff (see the three
  // verdicts in this file's header) and refuses the classes that still require
  // a human ASSEMBLE/LAND row. A refusal writes nothing and exits 0 so the rest
  // of the derived-artifact regen still runs — the non-success signal is
  // `--refusal-status`, which the workflow runs as its last step.
  let committed = ''
  try { committed = readFileSync(CG_PATH, 'utf8') } catch { /* first run, no committed file yet */ }

  if (assembled === committed) {
    console.log(`assemble-chaingraph: already up to date (${order.nodes.length} nodes, ${order.chains.length} chains).`)
    reportUnassembledShards(order.nodes)
    process.exit(0)
  }

  let refused = false
  if (committed) {
    const result = classifyTexts(committed, assembled)
    if (!result) {
      console.error('assemble-chaingraph: committed or assembled chaingraph.json failed to parse — refusing to write (cannot safety-check a malformed tree).')
      process.exit(1)
    }
    if (result.verdict === 'REFUSED') {
      refused = true
      emitRefusals(result.refusals, { annotate: IN_ACTIONS })
      console.log(
        `assemble-chaingraph: REFUSED — ${result.refusals.length} change(s) out of scope for the unattended assembler. ` +
        'No write, no commit. Run `node scripts/assemble-chaingraph.mjs --refusal-status` for the non-zero status this maps to.',
      )
    } else if (result.allowed.length > 0) {
      console.log(`assemble-chaingraph: AUTO-LAND — ${result.allowed.length} in-scope change(s): ${result.allowed.map(describeChange).join('; ')}`)
    }
  }

  if (!refused) {
    writeFileSync(CG_PATH, assembled, 'utf8')
    console.log(`Wrote ${CG_PATH} (${order.nodes.length} nodes, ${order.chains.length} chains).`)
  }
  reportUnassembledShards(order.nodes)
}
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
