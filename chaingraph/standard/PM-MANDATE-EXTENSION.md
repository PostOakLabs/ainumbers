# `pm:*` Prediction/Event-Market Provenance Extension — Registration Proposal

**Status: INFORMATIVE.** This document is the registration record and ADR for the normative addition in
[`SPEC.md`](SPEC.md) §5.1. It defines no vocabulary of its own — §5.1 is the normative text — and
conformance with OCG v0.4 does not depend on anything below beyond what §5.1 already states. This
document exists so the "why," the source scoping, the Corda-tripwire review, and the illustrative
payloads have one place to live, per the repo's existing pattern (`SCITT-MAPPING.md` is the same shape:
an informative companion to a normative SPEC.md section).

**Anchor:** `LLM resolution ideas/SECO-OCG-Prediction-Market-Scoping.md` §3–§4.1 (the ratified scoping;
Tim endorsed the provenance-only breakdown 2026-08-13) + this repo's CONTRACT.md §A3.5 mandate_type
registration convention (which points to SPEC.md §5 as the normative taxonomy — Amendment A5).

---

## 1. What this registers

Seven new `mandate_type` values, under a `pm:` `tool_id` prefix, for prediction/event-market lifecycle
provenance: `market_definition`, `trade_order`, `trade_execution`, `position_update`,
`resolution_evidence`, `resolution_certificate`, `settlement`. Full field tables and normative text are
in `SPEC.md` §5.1 — not restated here.

## 2. What this does NOT register

No oracle, no consensus mechanism, no settlement rail, no matching engine, no smart contract, no wallet,
and no AINumbers-operated market of any kind. The scoping document's §3 scope-decision chart ruled all of
that **out of scope** for AINumbers — it requires persistent backend infrastructure, a validator network,
on-chain deployment, and (for the SECO resolver specifically) ML inference as a consensus-critical
component, each of which violates a non-negotiable constraint of this repo (client-side only, zero PII,
deterministic rule-based logic only, no backend infrastructure — `board/STANDING-ORDERS.md` #0). This
registration is the two items the scoping document's §6 recommended next step actually asks AINumbers to
build: the `pm:*` schema entries (this document + SPEC.md §5.1) and, as a separately gated future row, the
OCG Artifact Builder/Validator showcase tool (`PM-ARTIFACT-VALIDATOR-1`, gated on this row per its board
entry — not built here).

`board/STANDING-ORDERS.md`'s SWOT ruling ("no events/escrow") stands: this registers a format. No copy in
this document, in SPEC.md §5.1, or in any future AINumbers page may read as AINumbers offering market
infrastructure, event contracts, or resolution services.

## 3. Why an ADR (Nygard form)

### Decision
Prediction-market resolution artifacts (evidence, certificates, settlement) will be represented as
OpenChainGraph `pm:*` mandate types — an extension of the existing, general-purpose provenance standard —
rather than as a bespoke, market-specific schema.

### Status
Accepted (this document + SPEC.md §5.1).

### Context
The source scoping material (`SECO-OCG-Prediction-Market-Scoping.md`, consolidating four upstream
documents: a SECO build spec, an architecture blueprint, and two research reports) proposed a
five-layer system — trading frontend, provenance layer, oracle layer, blockchain settlement, and a
wallet — for a browser-based, OCG-anchored prediction market. §3 of that document sorted every layer
against this repo's actual constraints. Only the provenance layer survived the sort: a hash-linked record
of market lifecycle events (definition → order → trade → position → evidence → resolution → settlement)
that is deterministic, client-side-computable, and carries no PII. Everything else in the source
material — consensus, ML inference, custody, on-chain deployment — is either infrastructure this repo
cannot host or a different discipline entirely (distributed systems, smart-contract security, ZK
engineering).

A second question the scoping document raised (§4.1's own "neutrality check"): the source material's OCG
schema draft was inherited from a Polymarket-clone lineage — on-chain collateral, `did:key` identity,
binary `YES`/`NO` outcomes — and that framing is a narrower bet than the provenance format needs to be.
Kalshi-style regulated, fiat-settled, KYC'd markets have no representation in a schema built that way;
even the largest on-chain venues remain small relative to off-chain regulated volume, so a schema
tightly coupled to on-chain mechanics is a durability bet on a niche that may not grow much further.

### Decision drivers
1. **§0 SURVIVES-THE-MAINTAINER.** A format that only a live oracle/settlement stack can produce or
   consume is not something this repo can ship — OCG artifacts are self-contained and offline-verifiable
   by design; a `pm:*` artifact must be too.
2. **Durability across market designs.** The schema should describe the same lifecycle whether the
   underlying venue is on-chain/crypto-native or off-chain/regulated-fiat, and whether the market is
   binary or multi-outcome — not assume one shape and require a fork for the other.
3. **No new provenance primitive needed.** OCG already has the exact mechanism this problem needs: §16
   `audit_signature` / §23 `input_attestations` for absorbing an external, non-deterministic process's
   output as a trusted input without OCG itself needing to compute or verify that process's internals.
   This is the same relationship OCG already has with any external oracle, any external KYC check, any
   external signed attestation — SCITT services included (`SCITT-MAPPING.md` documents that same pattern
   for a different external system).

### Alternatives considered
- **A bespoke prediction-market schema, outside OCG.** Rejected: duplicates §4's hash discipline, §16's
  signature binding, and §23's external-attestation pattern for no gain — a market lifecycle event is
  structurally the same kind of thing every other OCG artifact already is (a hash-linked decision record
  with an optional external attestation), and a bespoke format would need to reinvent all three from
  scratch with no additional expressiveness.
- **Extend the schema narrowly around on-chain, binary-outcome mechanics (the source material's
  as-drafted shape).** Rejected per the §4.1 neutrality check above — ships a schema that structurally
  cannot represent a regulated, fiat-settled, multi-outcome market, betting the extension's relevance on
  one segment of the space.
- **Model resolution as something OCG computes** (e.g., an OCG artifact whose `output_payload` *is* the
  resolved outcome, derived by OCG-internal logic). Rejected: resolution is inherently an external,
  non-deterministic judgment (evidence gathering, consensus, or a regulator's determination) — modeling
  it as an OCG computation would either be dishonest about what OCG actually verified, or would require
  OCG to become non-deterministic itself, which breaks §4's entire hash-integrity model. §23 already
  exists precisely so OCG never has to make this tradeoff.

### Consequences
- **Positive:** the `pm:*` extension costs zero new machinery — no new hash scheme, no new signature
  format, no new gate, no `chaingraph_version` bump. Any existing OCG verifier already knows how to check
  a `pm:*` artifact's `execution_hash`, and — if it implements §16/§23 — already knows how to check its
  resolution attestation.
- **Positive:** the schema is reusable by any future resolver design (SECO-style committee, a regulated
  resolution desk, a single trusted data source) without a schema change, because `resolution_method` is
  a string field, not a structural commitment to one resolver architecture.
- **Negative / accepted tradeoff:** because OCG treats resolution as an external attested input rather
  than computing it, a `pm:*` artifact chain proves *what was recorded and by whom it was attested* —
  it does not and cannot prove that the underlying resolution process (whatever it was) was itself
  correct or Byzantine-fault-tolerant. That property lives entirely outside this extension, in whatever
  resolver a future, separately-scoped team builds. This document does not claim otherwise.

## 4. Corda-tripwire language review (required, `board/STANDING-ORDERS.md` memory reference)

Explicit review pass over §5.1 and this document for "accept" / "finality" / operative-settlement /
ordering-or-matching-duty language, per the estate's standing Corda-tripwire discipline:

- **"accept" / "finality":** zero occurrences describing what OCG does with a resolution or a
  settlement, in either §5.1 or this document. §5.1's own text states this as a normative prohibition,
  not merely an absence.
- **"settlement" scope:** §5.1 states explicitly that `pm:settlement`'s `output_payload` is a
  **verify-only payout recompute** — the prescribed arithmetic over an already-resolved outcome and the
  recorded positions — and names both failure modes it is not: not an operative transfer of funds, not
  an ordering or matching duty, spec-only or otherwise.
- **Resolution as external input:** §5.1 states the `resolution_certificate` artifact's outcome is a
  claim OCG *records*, never one OCG *computes*, entering via §16 `audit_signature` / §23
  `input_attestations` exactly as any other external oracle's output would.

Result: zero accept/finality/operative-settlement language found; the two structural safeguards
(verify-only settlement, resolution-as-external-input) are stated as normative text in §5.1 itself, not
merely as an intent recorded here.

## 5. Version reconciliation

The source scoping document's §4.1 table was drafted against "v0.5." This repo's `chaingraph.json`
`spec_version` (the version of record, `spec-version-consistency.mjs`) was `0.8.13` at the time of this
registration; §5.1 registers against the **current** SPEC.md, labeled as a `v0.8.24` text pass in §14,
per `board/STANDING-ORDERS.md` #22 (spec/CONTRACT edits ride ordinary WUs, gated by the §15 conformance
suite — no version fork, no separate per-row approval). No envelope change: `chaingraph_version` stays
`"0.4.0"` (the "Frozen v0.4" envelope-semantics ruling, unaffected by this addition), and the record
`spec_version` of `chaingraph.json` is untouched by this pass — consistent with every prior SPEC-TEXT
PASS in §14's changelog (v0.8.14 through v0.8.23 each left the record version unmoved until a
coordinated K landing bumps it).

## 6. Hash discipline

Every `pm:*` artifact's `execution_hash` uses the single canonical lineage
(`chaingraph/kernels/_hash.mjs`, RFC 8785/JCS `cgCanon` over `{policy_parameters, output_payload}`) —
no ad-hoc canonicalization, per this repo's standing hash-discipline rule. `chain.parent_hashes` links
`trade_execution` artifacts to their parent `trade_order`s, and `resolution_certificate` artifacts to
their parent `resolution_evidence` artifact, using the existing, general `chain.parent_hashes` mechanism
— no `pm:*`-specific linking field was introduced. Mutable fields (timestamps, assigned ids) are excluded
from every `pm:*` artifact's hash preimage, per the unmodified §4 rule.

## 7. Regulatory note (informational only — not legal advice, not a go/no-go)

The CFTC has issued advisories and pursued enforcement actions against prediction markets; even a
technically decentralized resolution/settlement system may attract regulatory attention. This note is
carried forward from the source scoping document's §5.6 as an informational flag for whichever team, if
any, eventually builds an oracle or settlement layer that consumes this provenance format — it is not
legal advice, and it is not a recommendation for or against building that layer. AINumbers documents the
risk; it does not adjudicate it.

## 8. Illustrative payloads

Non-functional examples of artifact shape only — no consensus logic runs, no market exists. Each follows
the standard OCG envelope (`tool_id`, `mandate_type`, `policy_parameters`, `output_payload`,
`execution_hash`); `execution_hash` values below are illustrative placeholders, not computed digests.

### 8.1 `pm:evidence_root` (`resolution_evidence`)

```json
{
  "tool_id": "pm:evidence_root",
  "mandate_type": "resolution_evidence",
  "chaingraph_version": "0.4.0",
  "policy_parameters": {
    "attester_signatures": [
      { "signer_ref": "resolver-committee-7f3a", "sig": "base64:..." }
    ],
    "evidence_hash": "sha256:9f1c2e...",
    "resolution_method": "SECO"
  },
  "output_payload": {
    "evidence_root": "sha256:9f1c2e..."
  },
  "execution_hash": "sha256:ILLUSTRATIVE-0000000000000000000000000000000000000000000000000000000000"
}
```

### 8.2 `pm:resolver` (`resolution_certificate`)

```json
{
  "tool_id": "pm:resolver",
  "mandate_type": "resolution_certificate",
  "chaingraph_version": "0.4.0",
  "policy_parameters": {
    "evidence_root_execution_hash": "sha256:ILLUSTRATIVE-0000000000000000000000000000000000000000000000000000000000"
  },
  "output_payload": {
    "outcome": "outcome_b",
    "rationale": "Evidence root confirms the named condition resolved to outcome_b per the market's stated resolution_source_profile."
  },
  "chain": {
    "parent_hashes": [
      "sha256:ILLUSTRATIVE-0000000000000000000000000000000000000000000000000000000000"
    ]
  },
  "audit_signature": {
    "signatures": [
      { "keyid": "did:key:z6MkExampleResolverKeyNotReal000000000000000000000", "sig": "base64:..." }
    ]
  },
  "execution_hash": "sha256:ILLUSTRATIVE-1111111111111111111111111111111111111111111111111111111111"
}
```

Both examples are illustrative artifact shape only, matching the pattern already used for other showcase
payloads in this suite (e.g. the PayCode Decoder XML payload tab) — no oracle ran, no signature above
verifies against a real key, and no market referenced above exists.

## 9. Deliverables checklist (this row, `PM-OCG-SCHEMA-SPEC-1`)

- [x] Proposal drafted — seven `pm:*` mandate_type values, three agnosticism properties preserved
      (SPEC.md §5.1, this document §1–§2)
- [x] Corda-tripwire review — zero accept/finality/operative-settlement language, stated (§4)
- [x] Resolution modeled as external attested input per §16/§23 (§3, §5.1)
- [x] Version reconciled to current SPEC (0.8.13 record / v0.8.24 text-pass label), no envelope change (§5)
- [x] ADR fold-in — Nygard form (§3)
- [x] Illustrative payloads — `pm:evidence_root`, `pm:resolver` (§8)
- [x] CFTC note — informational only (§7)
- [ ] Standards-editor pass — result to be quoted in the board check-off
- [ ] PR # — to be added to the board check-off
