# SPEC-MANIFEST-APPLY — declarative desired-state apply / dry-run / check over `manifests/`

Row **MANIFEST-APPLY-1** (wave B, §3 B1 of `IMPL-PLAN-P0P1-UNILATERAL-2026-09-21.md`).
Spec-first per the row: this document is the desired-state source of truth for
`scripts/apply-manifests.mjs`; the script is its mechanical realization, not a second spec.
Attribution: apply/no-op/dry-run semantics inspired by grep.ai's `expert_apply`
(Parcha Labs, https://grep.ai) — ideas only, no code.

Measured at claim (2026-09-22, worktree off `5ec38ffc`): **1185** manifests under
`manifests/` (re-derived, SO #44 — the 586 figure was the `NNN-` prefixed subset; 586
files start with digits). **1185/1185 are byte-canonical** under the canonicalization
rule below (measured, `JSON.stringify(parse(t), null, 2) + '\n'` round-trip).

## 1. Desired-state source

The desired state of the manifest set is the conjunction of TWO invariants:

1. **FORM — canonical serialization.** Every `manifests/*.manifest.json` is byte-identical
   to `JSON.stringify(JSON.parse(text), null, 2) + '\n'`. This is the estate-wide
   "no hand-mangled bytes" invariant: any hand edit that does not round-trip canonically
   (different indent, reordered keys, trailing whitespace, single-line dump) is drift.
   Chosen because it is objective, value-preserving, and measured true for the entire
   corpus at ship time — the gate starts at equilibrium and only ever reports *new* rot.
2. **CONTENT — the declarative overlay `scripts/manifests.desired.json`.** Explicit
   desired values the estate declares for manifest key paths:

   ```jsonc
   {
     "_comment": "…",
     "policies": [                       // estate-wide rules
       { "id": "rule-id",
         "when": { "requires": ["category"], "omit": ["mcp_name"] },  // key-presence selector
         "set":  { "key": value }        // assignments applied when selector matches
       }
     ],
     "files": {                          // per-file assignments (batch ergonomics)
       "<manifest filename>": { "set": { "key": value } }
     }
   }
   ```

   A file drifts on a rule when the key's current value deep-differs from the declared
   value (a missing key drifts too). This is the grep.ai `expert_apply` shape: apply is
   an **idempotent no-op** once the desired state is satisfied, and every mode is
   expressible without touching the file (dry-run).

**Why the overlay ships EMPTY (`policies: []`, `files: {}`) — measured, not laziness.**
Every content invariant the estate already wants is already owned and enforced elsewhere,
and a second writer would violate SO #35 (single writer per artifact family):

- `input_schema` blocks — owned by `gen-input-schemas.mjs` (`--check` gate, MANIFEST-SCHEMA-BACKFILL-1).
- `input_example` / `output_example` / `example_execution_hash` / `author` / `license` /
  `mcp_tool_definition.annotations` — owned by `gen-manifest-examples.mjs` (MANIFEST-EXAMPLES-ANNOTATIONS-1).
- whole-file drafts at node creation — owned by `generate-node-manifest.mjs` (MFSTGEN-1, node-local).
- shape/required/types — owned by `check-manifest-schema.mjs` against
  `chaingraph/schemas/manifest.schema.json` (`oneOf`: `toolManifest` | `chaingraphNodeManifest`).

Rejected seed rules, with the measurement that killed each (so the next session reads a
decision, not an omission):

- *`ap2_export` explicit-boolean on the 10 node manifests missing the key* — the
  `chaingraphNodeManifest` schema branch has **`additionalProperties: false`** and does not
  list `ap2_export`; setting it would make all 10 match **neither** `oneOf` branch and
  manufacture 10 schema violations (consumers `gen-openapi.mjs:88` `?? false` and
  `regen_catalog.py:152` `get(..., False)` already equate absent ≡ false, so nothing is
  bought). On the `toolManifest` branch the key is schema-required — a restatement, not a rule.
- *`execution.function_name` required when `execution` present* — 31 real violations, but
  the desired value is unknowable (apply must never invent a function name).
- *`prefill` ⟺ `bridge_version` pairing (§2.4)* — 18 real one-sided cases; forcing
  `prefill: true` would flip runtime bridge behavior on tools whose pages may not implement it.
- *explicit `pii_transmitted` on tool manifests* — 877 of 1175 lack the key (sparse
  opt-in by design); mass-setting would be 877-file churn on served data.
- *`chaingraph_version` / `spec_version` pinning* — only 13 manifests carry the keys at all.

The overlay gains an entry the day a row declares a real batch change through it —
declare → `--dry-run` → review the plan → apply → the same declaration becomes the
drift gate's teeth forever after. That workflow is the row's "manifest ergonomics" deliverable.

**Scope fences honored:** this tool READS `manifests/` and the overlay only. It never
reads the node graph (so `check-derived-fanout-coverage.mjs` has no classification
obligation), never writes `chaingraph/chaingraph.json` (single-writer), never touches
kernels or fixtures.

## 2. Diff algorithm over the manifest set

Per file, in natural-sorted filename order, the plan is computed as:

1. **Parse.** Unparseable ⇒ drift entry `{kind: "parse"}` — never repairable by apply
   (a repair would be authored content, not a declared delta).
2. **Form.** `canonical = JSON.stringify(doc, null, 2) + '\n'`; `text !== canonical` ⇒
   drift entry `{kind: "form"}`. Repair would rewrite every line ⇒ apply REFUSES (§3).
3. **Overlay rules.** For each matched policy / per-file entry and each declared key path:
   deep-compare current value vs desired ⇒ drift entry `{kind: "set", path, desired}`.
   Selector match is evaluated against the CURRENT document; a policy whose own `set`
   does not make its selector stop matching is refused at overlay load (fixpoint
   discipline — a rule that can never be satisfied would red the gate forever).
4. **Equilibrium.** A file with zero drift entries is a no-op in every mode (grep.ai
   idempotency), byte-verified: apply writes nothing for it.

The set-level plan is the union of per-file entries. `--check` and `--dry-run` never
mutate; they differ only in exit code and output detail.

## 3. Minimal-delta JSON edit discipline

For a file with ≥1 `set` entry, apply:

1. Requires the FORM invariant to already hold (`parse(text)` re-serializes to `text`).
   If not, the write would reformat untouched lines — a **whole-file rewrite** — and is
   REFUSED with the file named, exactly like the blind whole-file regeneration the row
   premise calls out. Repair path: restore canonical bytes via the owning writer.
2. Mutates the parsed document in place: assignment to an existing key preserves its
   insertion position; new keys append. No template, no regeneration, no reordered output.
3. Serializes once with the canonical rule and verifies value-safety before writing:
   the parsed result must deep-equal the expected document (mutation confined to the
   declared paths), and the textual diff must touch only lines within the declared
   keys' line spans. `apply` refuses (exit 2) if either check fails.
4. Writes only files whose bytes actually change; prints one line per written file with
   the changed key paths.

## 4. Drift gate + baseline story

Gate identity **MANIFEST-APPLY-GATE-1**, wired as ONE line in `scripts/preflight.mjs`
(full suite; `--check` default mode = red on hand-drift). Semantics:

- **Baseline** `scripts/manifest-apply-baseline.json`:
  `{ "_comment": …, "drift": { "<filename>": ["<path>", …] } }` — the drift set known at
  ship time, absorbed so pre-existing rot does not red the estate. Loaded through
  `scripts/ratchet-baseline.mjs` (RATCHET-BASELINE-LOADER-1): a deleted, corrupt or
  key-damaged baseline is a **hard RED** (MISSING-FILE / INVALID-JSON / MISSING-KEY /
  NAN-KEY / BAD-LIST-KEY), never a silent pass.
- **Drift beyond the baseline is RED** — new hand-drift is never absorbable. The
  baseline is a down-only ratchet: `--update-baseline` is its sole writer, recomputes
  the live drift set, silently PRUNES entries that no longer drift, and REFUSES (exit 1,
  entries named) to add any entry that is not already present. A new violation is fixed
  with apply, never absorbed. At ship the pass absorbed **zero** entries (form invariant
  measured 1185/1185, overlay empty) — the baseline pins `{}`.
- **RED-then-GREEN** (demonstrated live, transcripts in the PR): plant hand-drift in a
  real manifest → `--check` RED naming file/class → apply repairs the declared delta
  (or the planted form-drift is refused and restored) → `--check` GREEN. The gate's
  paired controls live in `apply-manifests.mjs --self-test` (tmp-dir fixtures: form-drift
  detection, whole-file-rewrite refusal, minimal one-key apply, idempotent second apply,
  baseline absorb/prune, raise refusal, deleted-baseline hard RED, overlay fixpoint refusal).

## 5. Writer registry (for SO #35 bookkeeping)

`apply-manifests.mjs` is a WRITER of `manifests/*.manifest.json`, keyed to the overlay:
it writes only assignments declared in `scripts/manifests.desired.json`, only in apply
mode, never wholesale. It does not read the node graph; the one `chaingraph.json` string
in its header is the fence statement, which the source-text classifier
(`check-derived-fanout-coverage.mjs`) nevertheless matches — so the script is declared
**EXCLUDED** in `scripts/derived-artifacts.mjs` with that measured reason. Its CI route
is `scripts-verify.yml`'s full preflight, declared in `PREFLIGHT_ONLY`
(`check-workflow-gate-parity.mjs`) per the ART220 / gen-manifest-examples precedent.

## 6. Worker regen (same-push rule)

No manifest bytes change at ship (empty overlay, zero drift, demonstrations reverted) ⇒
served data unchanged ⇒ **no worker regen owed**. Any FUTURE apply that changes manifest
content re-runs the same-push question; consumers measured absent ≡ false for the
considered classes (`gen-openapi.mjs:88`, `regen_catalog.py:152`) as of this spec.
