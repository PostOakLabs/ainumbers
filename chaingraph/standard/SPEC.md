---
title: OpenChainGraph Standard
spec_version: 0.6.0
status: NORMATIVE — Single Source of Truth
canonical: repo/chaingraph/standard/SPEC.md
machine_schema: openchain-graph-v0.4.schema.json
version_of_record: chaingraph.json#spec_version
last_reconciled: 2026-06-27
renders_to: openchain-graph-spec.html (hand-kept, guarded by spec-version-consistency.mjs)
mirrors_to: PostOakLabs/chaingraph (GitHub Pages, generated)
---

# OpenChainGraph Standard — v0.6.0

> **This file is the normative source of truth.** `openchain-graph-spec.html` renders it for the
> web; `CONTRACT.md` §A3 references it; `chaingraph.json` + kernels validate against
> `openchain-graph-v0.4.schema.json`; GitHub Pages mirrors it. When any of those disagree with
> this file, **this file wins** and the disagreement is a CI failure (`spec-version-consistency.mjs`,
> `schema-validate.mjs`). The version of record is `chaingraph.json.spec_version`.

> **Scaffolding note (migration):** the NORMATIVE CORE (§1, §4, §12, §13, §15) is authored here
> and is what the JSON Schema + CI gates bind to. The DESCRIPTIVE sections (§7–§11) are imported
> verbatim from the published `openchain-graph-spec.html` by `scaffold-spec.mjs --import`; they are
> marked `[IMPORT §N]` below until that runs. Run `scaffold-spec.mjs --verify` to confirm SPEC.md
> is semantically identical to the published spec except version strings.

## §0 Conformance language
"MUST", "MUST NOT", "SHOULD", "MAY" per RFC 2119. An implementation is **v0.4-conformant** iff it
(a) emits artifacts that validate against `openchain-graph-v0.4.schema.json`, and (b) passes every
gate in §15. Conformance is defined by the schema + the gates, not by prose alone.

## Versioning model (informative — disambiguation)
OpenChainGraph carries **layered version identifiers**, each answering a different question. They are
intentionally decoupled, following the in-toto/SLSA pattern in which **additive changes do not move the
wire identifier** (a SLSA `predicateType` URI resolves to the latest minor version without changing for
additive updates). No single one of these should be read as "the OpenChainGraph version."

| Identifier | Where it lives | Answers | Current | Bumps when |
|---|---|---|---|---|
| `spec_version` | `chaingraph.json` (the version of record) | which OCG **release** is this? | `0.6.0` | every release (additive or breaking) |
| `chaingraph_version` | every **artifact** envelope | which **schema** do I parse/validate this with? | `0.4.0` (frozen) | **only a breaking envelope change** |
| `@context` URL | the artifact (`…/context/v0.3/…`) | which JSON-LD **vocabulary** applies? | `v0.3` | only when the context vocabulary changes |
| `payloadType` `;version=` | `audit_signature` (the DSSE shell) | which **signing-envelope** shell? | `0.2` | only when the DSSE shell changes |

**The rule that ties them together:** every additive layer (§13.11 `vc`, §16 proof, §17 build_identity,
§18 compute_proof) is hash-excluded and rides under `audit_signature`, so it does **not** move
`chaingraph_version`; a v0.6 artifact therefore still validates under the frozen
`openchain-graph-v0.4.schema.json`. So **`chaingraph_version` is the schema version (the "parse me with
this" number), not the standard release** — the release is `spec_version`. Renaming `chaingraph_version`
to a clearer `format_version` (or a self-describing type URI, in the in-toto style) would itself be a
breaking envelope change, because the envelope root is `additionalProperties:false`; it is therefore
reserved for a future major revision rather than done additively now.

## §1 Artifact envelope (NORMATIVE)
Every OpenChainGraph node tool and chain page MUST emit this envelope. Fields and types are fixed by
`openchain-graph-v0.4.schema.json#/$defs/artifact` (`additionalProperties:false`).

```json
{
  "@context": "https://ainumbers.co/chaingraph/context/v0.3/context.jsonld",
  "chaingraph_version": "0.4.0",
  "compute_mode": "server",
  "mandate_type": "<§4 taxonomy — see §5>",
  "tool_id": "<kebab-case>",
  "tool_version": "1.0.0",
  "generated_at": "<ISO 8601>",
  "buildType": "https://ainumbers.co/chaingraph/context/v0.2#WebCryptoSHA256",
  "execution_hash": "<SHA-256 over canonicalized policy_parameters + output_payload>",
  "chain": { "parent_hashes": [], "parent_tool_ids": [], "chain_depth": 0 },
  "policy_parameters": { "execution_backend": "server", "input_parameters": {} },
  "output_payload": {},
  "compliance_flags": [],
  "audit_signature": { "payloadType": "application/vnd.openchain.graph+json;version=0.2", "payload": "", "signatures": [] }
}
```

- `@context` is **not** version-locked to the spec number — the v0.3 context is valid under v0.4
  (export profiles are hash-excluded and add no PROV vocabulary). Gates MUST allowlist the v0.3
  context URL when checking version consistency.
- Root artifacts use `parent_hashes: []`, `chain_depth: 0`. A consuming stage copies each parent's
  `execution_hash` into `parent_hashes` and sets `chain_depth = max(parent depths) + 1`. Chain edges
  are hash citations, never editorial prose.

## §4 Execution hash (NORMATIVE — the integrity anchor)
`execution_hash` MUST be a **WebCrypto SHA-256** over the **RFC 8785 / JCS-canonical** JSON of
exactly `{ policy_parameters, output_payload }` and nothing else, produced by the single shared
canonicalizer **`kernels/_hash.mjs`** (browser tools inline it at build; the Worker imports it; both
byte-identical).

**FORBIDDEN** (enforced by `lint-forbidden-hash.mjs`): array-replacer canonicalization
(`JSON.stringify(x, Object.keys(x).sort())`), non-SHA-256 placeholders (`simpleHash`/djb2/FNV, any
string mislabeled `sha256:`), hashing a reduced object different from the stored `output_payload`, or
embedding the hash inside the hashed payload. Fold all decision inputs into `policy_parameters` so the
hash anchors them.

**Re-verifiability (MUST):** any party re-running a stage with the recorded `policy_parameters` MUST
recompute the identical `execution_hash`. This is asserted on the live deployed surface by
`hash-sweep.mjs` (§15) — not merely in the bundle.

## §5 mandate_type taxonomy
§4 internal taxonomy (recommended): `prompt_template, payment_mandate, payment_policy,
compliance_mandate, liquidity_mandate, capital_assessment, risk_control, settlement_mandate,
infrastructure_mandate, credit_assessment, treasury_mandate, account_mandate, model_governance,
attestation_mandate, cryptographic_mandate, aml_rule, risk_parameter`. This is an **internal
AINumbers taxonomy, not AP2 v0.2 vocabulary.** The schema treats `mandate_type` as a non-empty string
(NOT a hard enum): shipped nodes also use `agent_guardrail_mandate` (fit diagnostics) and `scheme_rule`,
and the enum is not CI-enforced. New tools SHOULD prefer a §4 type where one fits.

## §7 DCAT 3.0 Graph Index

The Graph Index (chaingraph.json) is the machine-discoverable catalog of a vendor's OpenChainGraph-conformant tools. v0.2 expresses it as a W3C DCAT 3.0 catalog, making it crawlable by data portals, regulatory reporting platforms, and semantic web processors — without removing any existing fields.

```
{
  "@context": {
    "dcat":  "http://www.w3.org/ns/dcat#",
    "ocg":   "https://ainumbers.co/chaingraph/context/v0.2#",
    "prov":  "http://www.w3.org/ns/prov#",
    "dct":   "http://purl.org/dc/terms/"
  },
  "@type":           "dcat:Catalog",
  "@id":             "https://ainumbers.co/chaingraph/chaingraph.json",
  "dct:title":       "AINumbers OpenChainGraph Suite",
  "dct:description": "48 Policy-Mandate-emitting, hash-anchored financial decision tools.",
  "dct:publisher":   { "@id": "https://postoaklabs.com", "dct:title": "Post Oak Labs" },
  "ocg:conformance_level": "L4",
  "ocg:mcp_endpoint": "https://mcp.ainumbers.co/mcp",

  "dcat:dataset": [
    {
      "@type":        ["dcat:Dataset", "ocg:DecisionTool"],
      "@id":          "ain:art-01",
      "dct:title":    "AP2 Mandate Chain Validator",
      "dct:description": "Validates AP2 mandate chain integrity with execution_hash.",
      "ocg:mandate_type": "ap2_mandate_chain_record",
      "ocg:consumes": [],
      "ocg:feeds":    ["ain:art-02", "ain:art-17"],
      "ocg:mcp_tool_name": "validate_ap2_mandate_chain",

      // Ed25519 signing key published here for artifact verification
      "ocg:signing_keys": [
        {
          "keyid":      "sha256:",
          "public_key": "",
          "valid_from": "2026-01-01"
        }
      ],

      // DCAT access service — MCP endpoint for this specific tool
      "dcat:accessService": {
        "@type":            "dcat:DataService",
        "dcat:endpointURL": "https://mcp.ainumbers.co/mcp",
        "dct:conformsTo":   "https://modelcontextprotocol.io/spec/2025-11-05"
      }
    }
    // ... one entry per tool ...
  ]
}
```

Graph Index as orchestration recipe

The ocg:consumes and ocg:feeds edges are the machine-readable map agents use to plan a full chain before calling anything. No existing standard provides this. DCAT gives the catalog a standard container and makes it crawlable by data portals; the ocg: namespace terms are what make it actionable by agents.
## §8 ISO 20022 Semantic Profile

v0.2 gave the provenance envelope a semantic standard (W3C PROV-DM). v0.3 gives the financial payload one. The ISO 20022 semantic profile is an optional, additive overlay that maps a curated subset of payload fields to ISO 20022 business elements and adopts the ISO external code lists by reference. It is minimal by design — amount, party, and agent fields only — and it never enters the execution_hash preimage (§2 is unchanged).

Aligned, not registered

OpenChainGraph is ISO 20022-aligned, not a registered ISO 20022 message. ISO 20022 is governed by the ISO Registration Authority / SWIFT. The iso20022: terms below are a crosswalk named after ISO 20022 business elements (ISO 20022 publishes no official JSON-LD vocabulary). Tools do not generate or transmit live ISO 20022 messages — they emit decision artifacts whose financial fields are interpretable by ISO 20022-native systems.

#### Published context URL: https://ainumbers.co/chaingraph/context/v0.3/iso20022-context.jsonld

```
{
  "@context": [
    "https://ainumbers.co/chaingraph/context/v0.3/context.jsonld",
    "https://ainumbers.co/chaingraph/context/v0.3/iso20022-context.jsonld"
  ],
  "chaingraph_version": "0.3.0",
  "tool_id": "ain:rca-03",
  "mandate_type": "compliance_mandate",
  "output_payload": {
    "instructed_amount": { "amount": "15000.00", "currency": "EUR" },  // ActiveCurrencyAndAmount · Ccy=ISO 4217
    "debtor":    { "party_name": "ACME SA",  "lei": "529900T8BM49AURSDO55" },  // ISO 17442
    "creditor":  { "party_name": "Beta GmbH", "lei": "391200X3K8N4WLB9AB12" },
    "debtor_agent":   { "bicfi": "DEUTDEFFXXX" },  // BICFI · ISO 9362
    "creditor_agent": { "bicfi": "BNPAFRPPXXX" },
    "settlement_date": "2026-11-23",  // IntrBkSttlmDt · ISO 8601
    "remittance_information": "INV-2026-0042"  // RmtInf
  }
}
```

### Field mapping

| OCG payload field | ISO 20022 business element | External code set |
| --- | --- | --- |
| amount | ActiveCurrencyAndAmount | — |
| currency | Ccy / CurrencyCode | ISO 4217 |
| country | CountryCode | ISO 3166-1 alpha-2 |
| debtor / creditor | Debtor / Creditor (PartyIdentification) | — |
| lei | OrganisationIdentification / LEI | ISO 17442 |
| debtor_agent / creditor_agent | DebtorAgent / CreditorAgent (FinInstnId) | — |
| bicfi | BICFI | ISO 9362 |
| iban | IBAN (CashAccount) | ISO 13616 |
| settlement_date | IntrBkSttlmDt | ISO 8601 |
| remittance_information | RmtInf | — |

Already in the suite

RCA-03 (verify_address_migration_batch) already validates ISO 20022 pacs.008 PostalAddress24 structured addresses for the SWIFT CBPR+ structured-address mandate (Nov 2026). The profile formalizes that usage into a declared crosswalk. A full practitioner walkthrough — code-list validators (ISO 4217/3166/9362/13616/17442) and a pacs.008 crosswalk — is in the ISO 20022 integration guide.
## §9 Party Identity — LEI & did:key

v0.3 formalizes two optional identity anchors that already appeared informally in the v0.2 guides. Both are optional; neither changes the hash preimage.

### did:key as the recommended keyid

The in-toto signature envelope's keyid (§4) SHOULD be a did:key identifier — a multicodec-prefixed, base58btc encoding of the raw Ed25519 public key (the z6Mk… form). This makes the signer self-describing and resolvable without a separate key registry, while remaining compatible with the Graph Index signing_keys lookup (§7).

### LEI for regulated party identity

A publisher or tool MAY carry an ISO 17442 Legal Entity Identifier. This binds an OpenChainGraph vendor — and, where relevant, the signing key — to a regulator-grade legal-entity anchor that banks, PSPs, and supervisors already consume. The LEI is the natural identity bridge between the §8 ISO 20022 profile (where debtor/creditor parties carry LEIs) and the §4/§5 signing identity.

```
{
  "publisher": {
    "name": "Post Oak Labs",
    "lei":  ""       // optional
  },
  "audit_signature": {
    "signatures": [
      { "keyid": "did:key:z6MkrJVnaZkeFzdQyMZu1cgjaeW7MoFaNKg4tLCf4g3kEhWh", "sig": "…" }
    ]
  }
}
```

Pairs with the agentic-identity tools

This aligns the provenance layer with the suite's KYA-OS / EUDI-wallet tools and the W3C Verifiable Credentials / DID ecosystem. See the Ed25519 and in-toto guides for key lifecycle and envelope details.
## §10 OKF Companion Bundle

v0.3 publishes an Open Knowledge Format (OKF) companion bundle — a directory of markdown concept files, one per Graph Index node — auto-generated from chaingraph.json. It is the narrative knowledge layer that complements the machine-readable DCAT catalog (§7): DCAT is the catalog an agent plans a chain from; OKF is the curated context an agent or human reads to learn what a tool means and when to use it.

Two layers, not two formats for one thing

OKF = context-in (knowledge read before acting). OpenChainGraph = provenance-out (the decision artifact produced and proven after acting). An OKF concept document is knowledge, never a decision artifact — it MUST NOT carry an execution_hash or audit_signature. The two are kept strictly separate.

```
okf/
├── index.md                 # root · progressive disclosure
├── log.md                   # generation history
├── mandate-types/
│   ├── index.md
│   └── .md
└── tools/
    ├── index.md
    └── .md         # one concept per live node; consumes/feeds → markdown links
```

Each concept carries OKF YAML frontmatter (type, title, description, resource, tags, timestamp); the node's consumes/feeds edges become markdown links between concepts, reproducing the graph. The bundle is regenerated on every Graph Index change and is fully reversible — nothing in OpenChainGraph's verification path depends on it. The generator and consumer walkthrough are in the OKF integration guide.

Maturity note

OKF is a v0.1 specification (published June 2026). It is adopted here as a companion artifact only. Tie nothing in artifact verification to it; treat the bundle as a generated, swappable discovery surface.
## §11 Profile Conformance

v0.3 introduced ISO 20022 alignment via an inline semantic_profile string token. v0.3.1 makes that conformance a first-class, machine-resolvable assertion using the W3C Profiles Vocabulary (PROF) and Content Negotiation by Profile: a profile is a dct:Standard published at a dereferenceable URI and declared with dct:conformsTo. This is fully additive — the execution_hash preimage is unchanged and semantic_profile tokens stay valid as registered aliases.

Uniform mechanism, truthful claims

Every node declares conformance the same way (dct:conformsTo), but only declares what it truthfully conforms to. ISO 20022 payment/party profiles are applied solely to nodes with the matching payload; a VaR engine or DORA classifier carries no ISO 20022 profile. Forcing a payment profile onto a non-payment node would be a false conformance claim, which this design avoids.

### Published profiles

| Token (alias) | Profile URI (dereferenceable) | Applies to |
| --- | --- | --- |
| iso20022:pacs.008-subset | https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld | Payment/settlement nodes (amount + parties + agents) — e.g. x402 settlement, VoP, ISO 20022 address. |
| iso20022:party-identification new | https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld | Party/issuer/legal-entity identity without a transaction (party_name + lei). Named after the ISO 20022 PartyIdentification element used in the REDA/ACMT families. |

### Token → URI registry

The authoritative token↔URI map is published at chaingraph-standard/profiles/registry.json (Content-Negotiation-by-Profile permits a short token alongside the mandatory URI). Each profile URI dereferences to a PROF prof:Profile document listing its schema (the v0.3 ISO 20022 context) and guidance resources.

```
{
  "@context": [
    "https://ainumbers.co/chaingraph/context/v0.3/context.jsonld",
    "https://ainumbers.co/chaingraph/context/v0.3/iso20022-context.jsonld"
  ],
  "chaingraph_version": "0.3.1",
  "ocg:semantic_profile": "iso20022:pacs.008-subset",        // token alias (retained)
  "dct:conformsTo": ["https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld"]  // authoritative, dereferenceable
}
```

Hash preimage unchanged

@context, ocg:semantic_profile, and dct:conformsTo are all outside the execution_hash preimage (sorted-key SHA-256 over {policy_parameters, output_payload}). A verifier correct for v0.1/v0.2/v0.3 computes identical hashes for v0.3.1 artifacts. See the profile-conformance guide.

## §12 Compute Binding (NORMATIVE — new in v0.4)
A `gpu:false` node MAY declare `compute_capability:"server"` and ship a registered server-side kernel
so an agent gets a verifiable artifact in one MCP round-trip.

- Kernel at `kernels/<tool_id>.kernel.mjs` exporting `compute(pp)`, `async buildArtifact(pp, opts)`,
  `meta`; registered in `kernels/index.mjs`; passes `kernel-hash-integrity.mjs` + `kernel-contract.test.mjs`.
- The artifact records dispatch in `compute_mode` (`"server" | "browser"`), excluded from the hash preimage.
- `gpu:true` nodes ignore `compute` and always delegate to the browser.
- **Every `gpu:false` node MUST have a kernel** (`kernel-coverage.mjs --strict`) — a missing kernel
  FAILS CI; it is never a silent skip (lesson of the Arc-kernel incident, §15).

### §12.5 artifact delta
v0.4 adds `chaingraph_version:"0.4.0"` (bumped from 0.3.x) and `compute_mode` to the v0.3.1 envelope.
The hash preimage definition is **unchanged** — a v0.4 artifact is verifiable by any v0.3 verifier
that ignores unknown fields.

## §13 Export Profiles (NORMATIVE — new in v0.4)
Generated, non-canonical renderings of an already-verified artifact, produced **after**
`execution_hash` and **excluded from the hash preimage**.

- Umbrella `chaingraph_export:<format>` — `xlsx | pdf | csv | xbrl | vc`. Each export MUST embed a metadata
  block (`tool_id`, `execution_hash`, `chaingraph_version`, `compute_mode`, signing `keyid` if present)
  + a link/QR to the canonical JSON; MUST NOT carry a new `execution_hash`; MUST be deterministic.
- MCP surface: a single read-only `export_artifact` tool (`readOnlyHint:true`), input = full artifact +
  `format` (+ `xbrl_taxonomy` for XBRL); returns standard base64 (not URL-safe) with correct MIME.
- Per-node discovery: `export_capability: ["xlsx","csv","pdf","xbrl:<taxonomy-id>"]`. Absent/`[]` ⇒
  JSON-only and still v0.4-valid. `export_artifact` MUST reject a `(tool, format)` not in the node's
  `export_capability`.
- XBRL: taxonomy-per-regime; EBA COREP own-funds + LCR/NSFR pilots; `ocg-ext:*` where no regulator
  taxonomy exists. **No fabricated taxonomy concepts** — each maps to a published element or an explicit
  `ocg-ext` element.

### §13.11 Verifiable Credentials profile (`vc`) — NORMATIVE, new in v0.4.1
`chaingraph_export:vc` renders a verified artifact as a [W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
*credential* (`application/vc+json`). It is a **base profile**: available on **every** node regardless of
`export_capability` (a lossless structural re-expression of the canonical artifact always exists), so a
node need not declare `vc`. Mapping (envelope → VC): `issued_by`→`issuer`, `mandate_type`+`output_payload`+
`policy_parameters`→`credentialSubject`, `valid_from`/`valid_until`→`validFrom`/`validUntil`. The VC
`@context` is `["https://www.w3.org/ns/credentials/v2", "<ocg vc context>"]` and `type` includes
`OpenChainGraphCredential`.
- The credential MUST carry an `ocg:hashAnchor` (`{type:"OpenChainGraphHashAnchor2026", digestMethod:"sha-256",
  executionHash, verify_url}`) that **re-states** the canonical `execution_hash`. It is an anchor, not a VC
  proof suite.
- The `vc` export MUST NOT mint a new `execution_hash` and MUST NOT add a securing `proof` — like every §13
  profile it is a **view, not a fact**; verification routes back to the canonical JSON artifact. A deployer
  needing a *secured* VC adds an enveloping JOSE/COSE or Data Integrity proof downstream (out of profile scope).
- Deterministic: every field derives from the artifact only (id = `urn:ocg:artifact:<bare-hash>`; no UUID, no
  wall-clock). The same artifact MUST render byte-identical bytes.

## §16 Proof Binding (NORMATIVE — new in v0.5)
A node or chain page **MAY** bind authenticity to a verified artifact by attaching a **W3C Data Integrity
proof** ([Data Integrity EdDSA Cryptosuites v1.0](https://www.w3.org/TR/vc-di-eddsa/), Rec 2025-05) at
`audit_signature.proof`. Proof Binding is OPTIONAL and holder-chosen; an artifact with no
`audit_signature.proof` is fully v0.5-conformant. It turns the §4 hash from *tamper-evidence* (recompute →
matches inputs) into *authenticated attestation* (a named key vouches for the artifact), filling the
§13.11 gap (the `vc` view mints no securing proof).

**§16.0 Home (NORMATIVE).** The proof lives at `audit_signature.proof` — NOT at artifact root and NOT
inside the DSSE-style `audit_signature.signatures[]` array. The artifact root is `additionalProperties:false`
in the frozen v0.4 schema (a root `proof` would make a signed artifact fail a v0.4 verifier), whereas
`audit_signature` tolerates added properties — so a signed v0.5 artifact still validates under the frozen
v0.4 schema. `signatures[]` keeps its separate DSSE/in-toto meaning (§9); §16 does not overload it.

A §16 proof object **MUST**:
- set `type:"DataIntegrityProof"`, `cryptosuite:"eddsa-jcs-2022"`, `proofPurpose:"assertionMethod"`;
- set `verificationMethod` to a **did:key** (§9) resolving to the signing Ed25519 public key;
- set `created` to an ISO-8601 instant and **MUST NOT** add any field to the §4 hash preimage;
- carry `proofValue` as the multibase-`z` base58btc Ed25519 signature over the §16.1 input, produced
  client-side via WebCrypto `Ed25519`;
- **MUST NOT** mint a new `execution_hash` and **MUST NOT** change `chaingraph_version` (stays `"0.4.0"`).

**§16.1 Proof input (canonical) — stock W3C Data Integrity.** The secured document is the **full artifact
with `audit_signature.proof` removed**. Generation follows the `eddsa-jcs-2022` pipeline verbatim: (1)
**Transform** — JCS-canonicalize (RFC 8785) the secured document and, separately, the proof options (the
proof object without `proofValue`); (2) **Hash** — SHA-256 each; (3) **Sign** — Ed25519 over
`SHA-256(proofOptions) ‖ SHA-256(document)`. Because `execution_hash` sits **inside** the secured document,
a whole-artifact signature transitively secures the §4 anchor. The JCS canonicalizer is the **same**
`kernels/_hash.mjs` `cgCanon` used by §4 (no second canonicalization path; the array-replacer forms
FORBIDDEN by §4 stay forbidden). Produced by the shared `kernels/_proof.mjs` (browser inlines it; Worker
imports it; byte-identical). Verification is reproducible offline: recompute `execution_hash` per §4, then
verify `proofValue` against the `verificationMethod` key over the same input — failure of either step fails
verification. A key referenced by `verificationMethod` **SHOULD** be published in Graph Index
`ocg:signing_keys` (§7) so a verifier resolves it without contacting the signer.

**§16.2 Privacy tradeoff (NORMATIVE caveat).** A §16 proof makes a run linkable to a key, eroding the
default zero-PII anonymous posture (which is itself a feature for some users). Proof Binding therefore
**MUST** default OFF and **MUST NOT** be auto-applied; a tool offering it **MUST** surface that signing
de-anonymizes the run. `zero_pii_verified` semantics are unchanged (inputs stay PII-free; the *signer*
becomes known).

**§16.3 Relation to §13.11.** A §16 proof secures the **canonical OCG artifact**, not the VC re-expression.
When that artifact is exported as a `vc` (§13.11), the `ocg:hashAnchor` routes a verifier back to the
canonical JSON where the §16 proof lives, so the secured artifact stays verifiable through the VC. A
deployer needing a `proof` **on the VC document itself** re-runs the same `eddsa-jcs-2022` pipeline over the
VC (a distinct proof, out of §16 scope).

**§16.4 Institutional issuer identity (informative).** For *ephemeral* / self-contained signing a
`did:key` is sufficient (and is the only CONTRACT-compatible option for a fully client-side tool — a private
key MUST NOT ship in client HTML/storage). A *stable institutional* issuer SHOULD instead anchor to
`did:web` over the publisher's domain with the private key held in an HSM/KMS and signing performed
server-side (e.g. the §12 compute path); `did:key` and `did:web` are interoperable `verificationMethod`
values under §16.1.

## §17 Kernel Identity Binding (NORMATIVE — new in v0.6)
A node MAY publish, and an artifact MAY record, the **content digest of the exact kernel that produced
it** — closing the §4 gap that `execution_hash` proves *"this output follows from these inputs by **some**
logic"* but does **not** pin *which* logic ran.

**§17.0 Home + digest.** The binding lives at `audit_signature.build_identity` (hash-excluded, like §16 —
keeps the frozen v0.4 root schema; an artifact without it is byte-identical to v0.5). It MUST carry:
- `kernel_digest` — a `sha256:`-prefixed digest produced by the shared **`kernels/_buildid.mjs`** over the
  kernel's canonical source bytes (the deployed `kernels/<tool_id>.kernel.mjs`, read UTF-8, **LF-normalized**,
  no trailing-newline trimming) via WebCrypto SHA-256 (browser inlines it; Worker imports it; byte-identical);
- `buildType` — the algorithm URI that produced the digest;
- OPTIONAL `source_ref` — a dereferenceable URL/commit pinning the source.

**§17.1 Publication + cross-check.** A node SHOULD publish its kernel digest in the Graph Index node field
`compute_images[]` (`{ system:"sha256-source", image_id:"sha256:…", valid_from }`). A verifier cross-checks
three values: `artifact.audit_signature.build_identity.kernel_digest` == the node's `compute_images[].image_id`
== `_buildid.digest(recomputed from source)`. Any mismatch FAILS the binding.

**§17.2 Strength (NORMATIVE honesty caveat).** §17 is an **advisory published claim**, *not* a cryptographic
proof of execution: it asserts which kernel **source** the publisher ran and lets a verifier confirm that
source's digest, but a dishonest server could record a digest different from the code it actually executed.
§17 strengthens tamper-evidence (the digest is in the secured set when §16 also applies) but does **not**, by
itself, *prove* the named kernel produced the output — that is §18's role. It MUST NOT alter `execution_hash`
or bump `chaingraph_version` (stays `"0.4.0"`).

## §18 Compute-Integrity Proof (NORMATIVE — new in v0.6)
A node MAY attach an OPTIONAL **zkVM compute-integrity proof** at `audit_signature.compute_proof`, turning the
§4 hash from *re-execute-to-verify* (a verifier must re-run the kernel with **cleartext** inputs) into a
**succinct proof of correct execution** a verifier checks **without re-execution** and, optionally, **without
seeing the inputs**. This is the §17 claim made cryptographic. It is OCG's analogue of the chained-verifiable-
computation goal in [Trusted Compute Units (arXiv:2504.15717)](https://arxiv.org/abs/2504.15717) — but
deliberately **software/cryptographic only: no TEE, no hardware enclave, no blockchain anchor** (OCG's
"registry" is the published Graph Index + `imageId`, never a chain). Compute-Integrity Proof is OPTIONAL and
holder-chosen; an artifact with no `audit_signature.compute_proof` is fully v0.6-conformant.

**§18.0 Home + object.** The proof lives at `audit_signature.compute_proof` (hash-excluded; keeps the frozen
v0.4 root schema). It MUST carry:
- `type:"ZkVmReceipt"`;
- `system` — the zkVM identifier (`"risc0" | "sp1" | "jolt" | …`); **system-agnostic** by design;
- `receiptFormat` — `"groth16-bn254"` (**RECOMMENDED**: a constant ~200-byte SNARK, verifiable in
  milliseconds in-browser/Worker/CI; the de-facto interop point both Risc0 and SP1 emit) or `"stark"`;
- `imageId` — the zkVM program identity (Risc0 ImageID / SP1 vkey) in `sha256:`-form, pinning the exact guest
  program (the cryptographic analogue of §17's `kernel_digest`);
- `seal` — the standard-base64 proof bytes;
- `journal` — the public outputs the guest committed; the journal's committed output **MUST** equal the
  artifact `output_payload` (the proof is *about* this artifact's output).

**§18.1 Verification — two paths, verifier's choice.** (a) **§4 recompute** — still valid when inputs are
public; OR (b) **receipt verification** — verify `seal` against `imageId`, valid even when inputs are withheld.
For `receiptFormat:"groth16-bn254"` OCG **ships a self-contained reference verifier** (`_computeproof.mjs`
`verifySeal`, vendored BN254 pairing math, **zero npm/runtime dep**): it reconstructs the named system's
ReceiptClaim digest from `(imageId, journal)`, derives the Groth16 public inputs, and checks the pairing against
the published verifying key — **chain-free** (preserving "no blockchain in the verify path") and **not
runtime-dependent on the prover vendor**. For `receiptFormat:"stark"` seal-verification stays **DELEGATED** to
the named system's vetted verifier (`risc0`/`sp1` `verify`), exactly as §4 delegates SHA-256 and §16 delegates
Ed25519 to WebCrypto. OCG's gate (`compute-proof.test.mjs`, §15) **verifies a real committed Groth16-BN254
receipt fixture** against its published `imageId` (green = a real proof verified, not structure-only) and checks
the **binding**: object structure, `imageId` ↔ Graph Index `compute_images`, journal ↔ `output_payload`, no new
`execution_hash`, `chaingraph_version` stays `"0.4.0"`.

**§18.2 Proving is off-band (NORMATIVE constraint).** zkVM **proving** needs a Rust toolchain and heavy compute;
it **MUST NOT** be claimed to run in the browser tool, the Cloudflare Worker (§12 compute path), or CI (the
proving cost is "multiple orders of magnitude" over native — arXiv:2504.15717). A `compute_proof` is produced
**offline** and attached; the live surfaces only **verify**. A node MUST NOT advertise in-browser proving.

**§18.3 Confidentiality + privacy (NORMATIVE).** When the receipt is used to **withhold** inputs,
`policy_parameters` MAY carry commitments/hashes in place of cleartext; then §4 recompute is **unavailable to
third parties** (only the input-holder can re-run) and the receipt becomes the sole verification path — a tool
in this mode MUST surface that to consumers. Like §16, attaching a `compute_proof` links the run to a published
`imageId` (and, where co-signed, a key), so it **MUST default OFF** and MUST NOT be auto-applied.

**§18.4 Relation to §16 / §17.** §17 = advisory claim of *which* kernel; §18 = cryptographic proof that *that*
program produced *this* output; §16 = a named key vouching for the whole artifact. They compose: a §18 receipt
MAY itself be covered by a §16 proof over the artifact. No layer mints a new `execution_hash` or bumps
`chaingraph_version`. This completes the OCG **strength-of-verifiable ladder**: L1 §4 hash (tamper-evidence) →
L2 §16 proof (authenticated attestation) → L3 §18 receipt (succinct compute-integrity, optionally confidential).

**§18.5 Deterministic guest-equivalent kernels (INFORMATIVE).** A §18 proof is produced by running the kernel in
a fixed zkVM guest (a pinned JS runtime), not in the browser's V8. Where a rule would otherwise depend on a V8
platform API whose result is locale- or environment-sensitive, or whose faithful in-guest port is infeasible to
prove, the kernel MUST use a **deterministic, fully specified replacement** with an explicitly documented scope,
and that same replacement MUST be used **identically on every surface** (compute kernel/guest, browser tool, and
Worker) so the rule's verdict is byte-identical everywhere and the proof binds the rule actually shown to users.
Three shipped instances: (a) locale-sensitive number formatting (`toLocaleString`) → a pinned `en-US` formatter
verified value-for-value against V8; (b) the ACP-R09 `https_url` rule → a deterministic ASCII **https-scheme +
non-empty-authority** check (faithful WHATWG URL parsing measured at ~5.4×10⁹ guest cycles, infeasible to prove;
"don't parse URLs in the zkVM" — a scheme allowlist — is the established best practice); (c) **transcendental
math** (`Math.exp/log/log2/sin/cos/pow`) → a shared pure-JS fdlibm port (`kernels/_detmath.bundle.mjs`, inlined
per kernel) called identically on every surface. Only `+ − × ÷ √` are IEEE-754 bit-portable; transcendental
accuracy is implementation-defined, so a kernel calling the engine's libm gets a different result under browser
V8, Worker V8, QuickJS, and the RV32IM guest. Moving all surfaces onto one pure-JS libm removes the engine from
the path, so the value users see equals the value proven. Unlike (a) and (b), which are output-preserving, (c) is
a deliberate **one-time re-baseline**: the new last-bit results differ from V8's `Math.*`, so the affected
kernels' `execution_hash` is re-pinned. This is a correctness improvement, not a compromise — it removes a latent
cross-engine nondeterminism (the same input could already hash differently across browsers). Such a replacement
defines its own conformance scope: it is the rule, not an approximation of a richer V8 behavior. Out-of-scope
aspects (for `https_url`: IDNA, IPv4-shorthand, IPv6, and full forbidden-host-code-point parsing; for `_detmath`:
last-ULP equivalence to any specific engine's `Math.*`) MUST be stated in the kernel and tool source so consumers
know exactly what the proof attests. A node whose deterministic in-guest proving cost is nonetheless prohibitive
(e.g. tens of thousands of transcendental calls in a Monte-Carlo loop) MAY carry the shared-libm replacement for
cross-surface determinism yet remain `compute_proof_ready:"deferred"` until a larger prover is available; the
replacement and the proof are independent.

## §14 Changelog
See `standard/CHANGELOG.md`. v0.6.0 = Kernel Identity Binding (§17) + Compute-Integrity Proof (§18, zkVM,
software-only) over v0.5.0. v0.5.0 = Proof Binding (§16) over v0.4.1.
v0.4.1 = Verifiable Credentials export profile (§13.11) over v0.4.0.
v0.4.0 = Compute Binding (§12) + Export Profiles (§13) over v0.3.1. The artifact envelope and hash
preimage are **unchanged** in v0.4.1 (export profiles are not part of the envelope) — artifacts continue
to emit `chaingraph_version:"0.4.0"` and remain valid under any v0.4 verifier.

## §15 Conformance gates (NORMATIVE — conformance-by-construction)
A v0.4 implementation MUST pass all of the following. **No normative rule above exists without a gate
here** — a rule with no wired gate is not part of the standard (the institutional fix for the
hash-remediation incident, where canonical `execution_hash` had no end-to-end gate that ran it live).

| Rule | Gate | When |
|---|---|---|
| §4 canonical execution_hash | `kernel-hash-integrity.mjs`, `lint-forbidden-hash.mjs`, `golden-parity.test.mjs` | validate |
| §12 every gpu:false node has a kernel (no silent skip) | `kernel-coverage.mjs --strict` | validate |
| §4 buildArtifact reproduces hash offline | `kernel-contract.test.mjs` | validate |
| §4 **live** re-verifiability of every deployed node | **`hash-sweep.mjs`** | post-deploy |
| Live server registers every expected mcp_name | **`verify-mcp-registered.mjs`** (Addendum A) | post-deploy |
| §1 envelope + node object well-formed | **`schema-validate.mjs`** (this schema) | validate |
| single version of record across surfaces | **`spec-version-consistency.mjs`** | validate |
| every surface count == chaingraph.json (Resources/Tools/Prompts) | **`surface-parity.mjs`** (Addendum A) | validate |
| every node `url` page + chain page exists (no orphans) | `catalog-parity.mjs` | validate |
| unique mcp_name (nodes+pilot+utility) | `check-tool-names.mjs` | validate |
| chain integrity | `validate-chains.mjs` | validate |
| /mcp handshake works | `smoke-mcp.mjs` | post-deploy |
| §13 export gate honored (incl. §13.11 `vc`: view-only, no new hash/proof, deterministic, base-profile) | `exporters/export.test.mjs` (unit) + `smoke-compute.mjs` (export round-trip) | validate + post-deploy |
| §16 proof: eddsa-jcs-2022 whole-artifact at `audit_signature.proof`, no new hash, no `chaingraph_version` bump, deterministic, offline-verifiable, default-off | `proof-binding.test.mjs` (unit: sign→verify round-trip + tamper-detect + determinism + backward-compat) | validate |
| §17 kernel identity binding: digest at `audit_signature.build_identity` ↔ Graph Index `compute_images` ↔ recomputed source, hash-excluded, no `chaingraph_version` bump | `kernel-identity.test.mjs` (unit: digest determinism + three-way cross-check + tamper-detect + backward-compat) | validate |
| §18 compute-integrity proof: object structure, `imageId` ↔ Graph Index `compute_images`, journal ↔ `output_payload`, no new hash, version stays 0.4.0, default-off; PLUS the shipped self-contained BN254 Groth16 verifier accepts a real receipt fixture and rejects a tampered seal / wrong journal (stark stays vendor-delegated per §18.1) | `compute-proof.test.mjs` (unit: binding + real-receipt verify + tamper-detect + backward-compat) | validate |
| every rule above has a gate (meta) | `spec-gate-coverage.mjs` | validate |

**Meta-rule:** a PR that adds a normative MUST to this file without a referenced gate in this table
fails `spec-gate-coverage.mjs`.
