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
 *       `domain` (taxonomy/grouping), `steps` (membership, order, handoff
 *       prose and gates), `branches`, `regulatory_refs`,
 *       `regulatory_basis_*`, `spec_version`, `wave`, `id`,
 *       `export_capability` — is STRUCTURAL by definition and falls to (c).
 *       The list is an ALLOWLIST, so a chain field invented tomorrow is
 *       refused until someone deliberately classifies it. `composer_url` is
 *       NOT on the list and never joins it; it has its own guarded path, (a2).
 *
 *       CONSEQUENCE, STATED SO A READER CAN PREDICT THE VERDICT: because
 *       `steps` is not on the allowlist, a chain's steps/edges/order/node
 *       membership must be deep-equal for (a) to apply, and a diff that
 *       reworded a description AND moved a step is (c), not (a). Prose that
 *       lives inside `steps` (a step's `handoff`) is NOT copy-only — chain
 *       formal verification reads handoffs, so they are graph content.
 *
 *   (a2) AUTO-LAND — GUARDED `composer_url` REPOINT (CHAIN-CLASSIFY-COMPOSER-URL-1,
 *       on Tim's ruling of 2026-08-22: "add composer_url to the allowlist when
 *       the target exists"). An existing chain whose ONLY differing top-level
 *       field is `composer_url`, AND whose new URL resolves to a file present
 *       in the tree being assembled.
 *
 *       READ IT AS A CONDITION, NOT AS AN ALLOWLIST ENTRY — that distinction
 *       is the whole of this verdict. COPY_ONLY_CHAIN_FIELDS is for fields
 *       whose change needs NO verification; a link target is precisely the
 *       field where a change CAN break something. So `composer_url` stays off
 *       that list and gets a guarded path instead: auto-land iff the new
 *       target exists, refuse otherwise, with a refusal that NAMES the missing
 *       path rather than reading as a generic structural edit.
 *
 *       The original exclusion reasoned that a URL is "a machine-resolvable
 *       link target, not wording". That reasoning is not overturned here — it
 *       is SATISFIED. Machine-resolvable is exactly what makes the guard
 *       possible: a machine can check the target, which is something it can
 *       never do for prose.
 *
 *       THE CHECK IS INJECTED, NEVER PERFORMED HERE. classifyAssembly stays
 *       pure — no disk, no env, no git — so the self-test drives it over real
 *       diffs; the caller passes `targetExists`. The DEFAULT predicate answers
 *       "absent" for every URL, so a caller that forgets to wire one gets the
 *       old refusal, never an unverified auto-land.
 *
 *       STRICTLY `composer_url` ALONE: a diff moving `composer_url` AND any
 *       other field — prose included — is (c). One field's guard must not
 *       become a door for a second field.
 *
 *       URL -> PATH REUSES THE ESTATE'S ONE TRANSFORM, the one
 *       scripts/check-chain-composer-urls.mjs (CHAINURL-GATE-1) already
 *       applies to every chain shard: strip the `https://ainumbers.co/`
 *       prefix, resolve the remainder against the repo root. A URL without
 *       that prefix cannot be mapped, and an unmappable URL refuses exactly
 *       like a missing file. There is no second convention.
 *
 *   (b) AUTO-LAND — PURELY ADDITIVE NEW CHAIN. A chain `name` absent from the
 *       committed artifact and present in the assembled one. It modifies and
 *       removes nothing by construction.
 *
 *   (c) REFUSE — EVERYTHING ELSE. Explicitly: any structural chain
 *       modification (per (a)), any `composer_url` repoint whose new target is
 *       missing or unmappable (per (a2)), any chain removal or rename, and any
 *       node removal or rename. These still require an explicit human
 *       ASSEMBLE/LAND row. This half of the guard did not weaken.
 *
 *   Node ADDITIONS and node CONTENT changes auto-land, exactly as they did
 *   before this classifier existed — a node-only diff is unaffected.
 *
 *   COMPOSITION: a diff is AUTO-LAND only when EVERY change in it is
 *   independently (a), (a2), (b) or an allowed node change. One refusal
 *   refuses the whole write — assembly splices the full shard set, so there is
 *   no way to write "just the allowed part" without also writing the refused
 *   part.
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
 * ── PART 3: THE DRIFT LABEL (HASH-NEUTRAL / HASH-MOVING) ──────────────────
 *
 * `--check` exits 1 on ANY drift, then prints WHICH KIND it is. That label is
 * advice to a human, not a gate: it tells a session whether the drift its PR
 * causes will be picked up by the unattended main-side regen, or whether it
 * needs an explicit ASSEMBLE/LAND row. A FALSE "hash-moving" is therefore not
 * cosmetic — NODE-DESC-CLAUSE-PIN-1 (PR #1470) checked off BLOCKED-complete and
 * cost a successor ASSEMBLE-LAND row on a five-node diff that moved no hash at
 * all (golden-parity clean, 2126 vectors / 637 nodes, zero execution_hash lines
 * in the shard diff). 599 of 633 live nodes still need a description-layer
 * touch for the enumeration audit, so every one of those hits it.
 *
 * WHAT THE LABEL MEANS. chaingraph.json stores no literal execution_hash; the
 * hash preimage is `{policy_parameters, output_payload}` and it lives in
 * FIXTURES AND RECEIPTS, never on a node object. So the question a node diff
 * actually asks is: can this field's change reach the hash, the kernel, the
 * registration identity, or the runtime envelope? For most fields the honest
 * answer is yes-or-unknown, and unknown must read HASH-MOVING.
 *
 * SO IT IS A CLOSED ALLOWLIST, NOT A PROJECTION. Projecting a node onto
 * `{policy_parameters, output_payload}` before comparing — the shape this rule
 * was first described as — is UNIMPLEMENTABLE: a node carries neither key, so
 * the projection is `{}` for every node and EVERY edit, `compute_proof` swaps
 * included, would classify hash-neutral. That is the exact inverse of the
 * intent. NODE_HASH_NEUTRAL_FIELDS below is built the way the chain side is
 * built instead (COPY_ONLY_CHAIN_FIELDS): a frozen list of fields whose change
 * is provably inert, with EVERYTHING ELSE REFUSING BY DEFAULT. A field added to
 * the schema tomorrow reads HASH-MOVING until someone deliberately classifies
 * it, and is NAMED in the printed verdict when it does.
 *
 * NODE ADDITION AND NODE REMOVAL ARE STRUCTURAL and stay HASH-MOVING whatever
 * their field content — they are decided on the key sets, before any field
 * comparison happens, so no allowlist entry can swallow them.
 *
 * CHAINS ARE UNAFFECTED. Chain drift keeps the whole-object comparison
 * SHARD-DRIFT-CHAINS-1 gave it: a chain-only semantic edit (steps, title,
 * domain) is vendored content and must not read HASH-NEUTRAL. The chain side's
 * finer three-verdict classification is classifyAssembly's job, above.
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

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
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
 * auto-landed WITHOUT ANY VERIFICATION. Reader-facing prose and nothing else.
 *
 * Deliberately does NOT include `composer_url`, and CHAIN-CLASSIFY-COMPOSER-URL-1
 * did not change that. The original reason still holds: a URL is a
 * machine-resolvable link target, not wording, and admitting it here would make
 * the rule "prose, plus one URL field" — a carve-out rather than a line a
 * reviewer can predict. What that reasoning also implies is what verdict (a2)
 * now uses: because the target IS machine-resolvable, the classifier can check
 * it. So `composer_url` gets a GUARDED path (auto-land iff the new target
 * exists) instead of an unconditional seat on this list. Appending it here
 * would drop the guard and is the one change this file must not accept.
 */
export const COPY_ONLY_CHAIN_FIELDS = Object.freeze(['description', 'title'])

/**
 * SHARD-DRIFT-HASH-NEUTRAL-1. The ONLY node top-level fields whose change may
 * read HASH-NEUTRAL in classifyDrift's label (PART 3 of the header). Built as a
 * CLOSED ALLOWLIST on the COPY_ONLY_CHAIN_FIELDS pattern, so anything absent —
 * including a field the schema gains tomorrow — reads HASH-MOVING by default.
 *
 * A field earns a seat only when BOTH hold: (1) its change is provably inert to
 * the execution hash, the kernel, the registration identity and the runtime
 * artifact envelope, and (2) there is a real, recurring reason to edit it, so
 * the seat buys something. (2) is why this list is shorter than the candidates
 * the row offered — an inert field nobody ever edits is pure risk surface.
 *
 * PER-MEMBER JUSTIFICATION — each one, not the list as a whole:
 *
 *   description        Reader-facing prose. Already the landed precedent on the
 *                      chain side (COPY_ONLY_CHAIN_FIELDS). No kernel reads it;
 *                      it is not in the hash preimage. Independently policed by
 *                      check-copy-hallmarks.mjs (CONTRACT §1.4), so admitting it
 *                      here removes no scrutiny. This is the field the
 *                      enumeration-audit sweep touches on 599 nodes.
 *
 *   display_name       The node analogue of chain `title`, which is already on
 *                      the chain allowlist. A presentation label: gen-canvas,
 *                      gen-chaingraph-hub and gen-agentic-payments-map render it
 *                      as a caption. It is NOT identity — `tool_id` is node
 *                      identity and `mcp_name` is registration identity, and
 *                      both stay HASH-MOVING below.
 *
 *   standards_basis    A provenance DECLARATION (implements_standard /
 *                      cites_informative / not_applicable), not compute input.
 *                      KERNEL-CITATION-CLASS-1 puts citations in node metadata
 *                      precisely BECAUSE they are outside the behaviour surface
 *                      — kernel source may not carry them at all. Its value is
 *                      validated independently by check-clause-digest.mjs
 *                      (CLAUSE-DIGEST-GATE-1) on every PR, so a wrong value reds
 *                      a dedicated gate rather than riding in on this label.
 *
 *   cited_clause_digest  Same class: a sha256 locator into
 *                      chaingraph/standard/clause-snapshot-registry.json. It
 *                      digests the CITED TEXT, never the computation, and the
 *                      same CLAUSE-DIGEST-GATE-1 resolves it against the
 *                      registry. Paired with standards_basis because the pinner
 *                      writes them together — splitting them would refuse the
 *                      exact diff this row exists to admit.
 *
 * DELIBERATELY EXCLUDED, with the reason, so nobody re-litigates them blind:
 *
 *   url                A machine-resolvable link target, not wording. The chain
 *                      side refused `composer_url` a seat on ITS allowlist for
 *                      exactly this reason and gave it a GUARDED path instead
 *                      (verdict (a2): auto-land iff the target exists).
 *                      classifyDrift is a pure two-text label with no existence
 *                      predicate wired into it, so no guard is available here —
 *                      and check-node-complete.mjs requires a node's url to
 *                      resolve. An unguarded seat would be the carve-out
 *                      CHAIN-CLASSIFY-COMPOSER-URL-1 declined to make.
 *
 *   mandate_type       Envelope taxonomy, not prose: it travels INTO the emitted
 *                      artifact (gen-canvas/gen-chain-runners put it on the
 *                      mandate object; gen-openapi declares it in the envelope
 *                      description). It is the node analogue of chain `domain`,
 *                      which the chain side classes structural.
 *
 *   wave               Inert to hash and behaviour, but it fails test (2): a
 *                      node's build cohort is set once by new-kernel.mjs and
 *                      never swept, while it does feed a published surface
 *                      (gen-euc-register). Zero benefit, non-zero surface.
 *
 *   Every other clause field (cited_clause_source, clause_retrieved_date,
 *   clause_snapshot_location, cited_clause_paragraphs, ...) — fail-closed by
 *   construction. Not listed is not a judgement that they matter; it is the
 *   default this list exists to preserve.
 */
export const NODE_HASH_NEUTRAL_FIELDS = Object.freeze([
  'cited_clause_digest',
  'description',
  'display_name',
  'standards_basis',
])

/**
 * The site's published origin. CHAINURL-GATE-1 (scripts/check-chain-composer-urls.mjs)
 * already maps a chain `composer_url` onto a repo path with exactly this
 * prefix-strip; verdict (a2) reuses it rather than inventing a second
 * convention, so the classifier and the gate can never disagree about where a
 * composer page lives.
 */
const SITE_URL_PREFIX = 'https://ainumbers.co/'

/**
 * URL -> repo-relative path, or null when the URL does not fit the one
 * transform (any other origin, a relative link, a non-string). null is NOT
 * "exists"; an unmappable target refuses exactly like a missing file.
 *
 * @param {unknown} url
 * @returns {string|null}
 */
export function composerUrlToRepoPath(url) {
  if (typeof url !== 'string' || !url.startsWith(SITE_URL_PREFIX)) return null
  const rel = url.slice(SITE_URL_PREFIX.length)
  return rel.length > 0 ? rel : null
}

/**
 * The LIVE existence predicate the runner injects into classifyAssembly. It
 * touches disk, which is why it lives out here and not inside the classifier:
 * the classifier stays pure and the self-test can drive it over real diffs.
 * "Present in the tree being assembled" is the whole question — the assembler
 * runs on the merged commit, so its working tree IS that commit.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function repoTargetExists(url) {
  const rel = composerUrlToRepoPath(url)
  return rel === null ? false : existsSync(resolve(root, rel))
}

/**
 * Verdict (a2)'s default: nothing resolves. A caller that forgets to wire a
 * predicate gets the pre-CHAIN-CLASSIFY-COMPOSER-URL-1 refusal, never an
 * unverified auto-land.
 *
 * @returns {boolean}
 */
const TARGET_ABSENT = () => false

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
 * @param {object} committedObj
 * @param {object} assembledObj
 * @param {{targetExists?: (url: unknown) => boolean}} [opts] verdict (a2)'s
 *   injected existence check: does this composer_url resolve to a file present
 *   in the tree being assembled? Defaults to "no", so an unwired caller
 *   refuses rather than auto-landing something it never verified.
 * @returns {{verdict: 'CLEAN'|'AUTO-LAND'|'REFUSED', allowed: object[], refusals: object[]}}
 *   `allowed` and `refusals` entries are { kind, key, fields?, reason? }.
 *   verdict is REFUSED if refusals is non-empty, CLEAN if nothing changed at
 *   all, AUTO-LAND otherwise.
 */
export function classifyAssembly(committedObj, assembledObj, { targetExists = TARGET_ABSENT } = {}) {
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

    // ── (a2) the guarded composer_url repoint. STRICTLY the only changed
    // field: `fields` (not `nonCopy`) is tested, so composer_url moving
    // alongside a description reword falls through to the structural refusal
    // below. One field's guard is not a door for a second field. ──
    if (fields.length === 1 && fields[0] === 'composer_url') {
      const url = chain.composer_url
      const rel = composerUrlToRepoPath(url)
      if (rel === null) {
        refusals.push({
          kind: 'chain-composer-url-unmappable',
          key: name,
          fields,
          reason:
            `composer_url repoint to ${JSON.stringify(url)} does not match the expected ` +
            `${SITE_URL_PREFIX} prefix, so no repo path can be derived and the target cannot be verified`,
        })
      } else if (!targetExists(url)) {
        refusals.push({
          kind: 'chain-composer-url-target-missing',
          key: name,
          fields,
          reason:
            `composer_url repoint to ${JSON.stringify(url)} whose target is NOT present in this commit — ` +
            `expected repo/${rel}. Build or land that page first and the repoint auto-lands`,
        })
      } else {
        allowed.push({ kind: 'chain-composer-url-repoint', key: name, fields })
      }
      continue
    }

    if (nonCopy.length === 0) {
      allowed.push({ kind: 'chain-copy-edit', key: name, fields })
    } else {
      // Naming (a2) here keeps a reader from concluding that the fix is to
      // append composer_url to the allowlist — it is not, and never will be.
      const guardHint = nonCopy.includes('composer_url')
        ? ' — composer_url auto-lands ONLY when it is the sole changed field AND its new target exists (verdict (a2)); moved alongside anything else it is structural'
        : ''
      refusals.push({
        kind: 'chain-structural-edit',
        key: name,
        fields: nonCopy,
        reason: `chain field(s) outside the copy-only allowlist (${COPY_ONLY_CHAIN_FIELDS.join(', ')}) changed: ${nonCopy.join(', ')}${guardHint}`,
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

// SHARD-DRIFT-HASH-NEUTRAL-1. Diffs the node arrays keyed tool_id and appends
// only the HASH-MOVING changes to `changes`.
//
// STRUCTURE FIRST, FIELDS SECOND — the order is load-bearing. Additions and
// removals are decided on the KEY SETS, before any field comparison runs, so a
// node appearing or disappearing is HASH-MOVING whatever its content and no
// allowlist entry can swallow it. A tool_id rename reaches here as both halves
// and reports both.
//
// For a node present on both sides, `changedFields` (canonical, key-order
// insensitive — so CS-2 shard reformatting still registers as no change) gives
// the differing top-level fields; the ones NOT on the frozen allowlist are what
// make it hash-moving. Filtering against the allowlist is what makes this
// fail-closed: an unrecognised field name simply is not in the list, so it
// survives the filter and is named in the verdict.
function diffNodes(committedArr, assembledArr, changes) {
  const cMap = byKey(committedArr, 'tool_id')
  const aMap = byKey(assembledArr, 'tool_id')
  for (const [id, after] of aMap) {
    if (!cMap.has(id)) {
      changes.push({ kind: 'node-added', key: id, fields: [] })
      continue
    }
    const moving = changedFields(cMap.get(id), after).filter((f) => !NODE_HASH_NEUTRAL_FIELDS.includes(f))
    if (moving.length > 0) changes.push({ kind: 'node-modified', key: id, fields: moving })
  }
  for (const id of cMap.keys()) {
    if (!aMap.has(id)) changes.push({ kind: 'node-removed', key: id, fields: [] })
  }
}

/** One-line summary of a drift entry: the key, plus the fields that moved it. */
export function describeDrift(c) {
  return c.fields?.length ? `${c.key} [${c.fields.join(', ')}]` : c.key
}

// Returns { verdict: 'HASH-NEUTRAL' | 'HASH-MOVING' | null, changedIds, changes }.
// verdict is null only on a JSON.parse failure (caller falls back to the
// plain DRIFT message, no verdict claimed). SHARD-DRIFT-CHAINS-1: folds
// .chains into the same verdict — a chain-only semantic edit (steps,
// title, domain) is vendored content too and must not read HASH-NEUTRAL.
// Chains have no `id` field (keyed `name`), so nodes and chains diff via
// separate maps rather than one shared map.
//
// SHARD-DRIFT-HASH-NEUTRAL-1 splits the two sides apart: nodes go through
// diffNodes (allowlist-aware, above), chains keep diffByKey's whole-object
// comparison EXACTLY as SHARD-DRIFT-CHAINS-1 wrote it. `changedIds` keeps its
// old shape and order (nodes then chains) for every existing reader; `changes`
// is additive and carries the field names the label is now able to name.
export function classifyDrift(committedText, assembledText) {
  let committedObj, assembledObj
  try {
    committedObj = JSON.parse(committedText)
    assembledObj = JSON.parse(assembledText)
  } catch {
    return { verdict: null, changedIds: [], changes: [] }
  }
  const changes = []
  diffNodes(committedObj.nodes ?? [], assembledObj.nodes ?? [], changes)
  const chainIds = []
  diffByKey(committedObj.chains ?? [], assembledObj.chains ?? [], 'name', chainIds)
  for (const name of chainIds) changes.push({ kind: 'chain-changed', key: name, fields: [] })
  const changedIds = changes.map((c) => c.key)
  return { verdict: changedIds.length === 0 ? 'HASH-NEUTRAL' : 'HASH-MOVING', changedIds, changes }
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

/**
 * Parses both sides and classifies; null when either side is unparseable. This
 * is the ONE place the live existence predicate is injected — every mode
 * (write, --check, --refusal-status) goes through here, so all three answer
 * verdict (a2) from the same working tree they are assembling.
 */
function classifyTexts(committedText, assembledText) {
  try {
    return classifyAssembly(JSON.parse(committedText), JSON.parse(assembledText), {
      targetExists: repoTargetExists,
    })
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
    const { verdict, changes } = classifyDrift(committed, assembled)
    if (verdict === 'HASH-NEUTRAL') {
      // The advice, not just the label. SHARD-DRIFT-HASH-NEUTRAL-1 routes the
      // description/declaration sweep here, and the pre-SO-#35 wording ("commit
      // chaingraph.json in THIS push") would have sent 599 sessions to write a
      // shared derived artifact from a PR. The single writer is the main-side
      // regen; this drift needs nothing from you.
      console.error('  HASH-NEUTRAL DRIFT — no hash can move here. The main-side derived-artifacts regen assembles and commits chaingraph.json after merge (SO #35 single writer). Do NOT regenerate it in this PR, do NOT check off BLOCKED-complete, do NOT stage an ASSEMBLE-LAND successor.')
    } else if (verdict === 'HASH-MOVING') {
      console.error(`  HASH-MOVING DRIFT — BLOCKED-complete per RUNBOOK -0.7; the ASSEMBLE-LAND lands it per -0.6. (${changes.length} change(s): ${changes.slice(0, 10).map(describeDrift).join('; ')}${changes.length > 10 ? '; ...' : ''})`)
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
