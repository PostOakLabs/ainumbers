---
title: OpenChainGraph Standard
spec_version: 0.8.7
status: NORMATIVE — Single Source of Truth
canonical: repo/chaingraph/standard/SPEC.md
machine_schema: openchain-graph-v0.4.schema.json
version_of_record: chaingraph.json#spec_version
last_reconciled: 2026-07-02
renders_to: openchain-graph-spec.html (hand-kept, guarded by spec-version-consistency.mjs)
mirrors_to: PostOakLabs/chaingraph (GitHub Pages, generated)
---

# OpenChainGraph Standard — v0.8.1

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
| `spec_version` | `chaingraph.json` (the version of record) | which OCG **release** is this? | `0.8.0` | every release (additive or breaking) |
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
- OPTIONAL top-level `supersedes: ["sha256:…", …]` (new in v0.7) — execution_hashes of artifacts this
  artifact corrects or replaces. Declared at creation, INSIDE the hashed envelope (it is an assertion
  of the new artifact). There is NO reverse link and NO status registry (a registry is a backend);
  consumers discover supersession only from the newer artifact or a log scan (informative).

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

### §13.12 Selective-disclosure export (SD-JWT, RFC 9901) — NORMATIVE, new in v0.7
An implementation MAY export an artifact as an SD-JWT whose claims map deterministically from the
envelope — EXCEPT disclosure salts, which MUST be freshly CSPRNG-generated per export (the one
permitted nondeterminism; it is confined to the export and never touches the envelope or
`execution_hash`). ALWAYS-DISCLOSED (non-selectively-disclosable) claims: `execution_hash`,
`chaingraph_version`, `spec_version`, `compute_capability`, §17 kernel/build identity fields, all
outputs (`output_payload`), and timestamps. SELECTIVELY DISCLOSABLE: top-level input values only.
Signature: JWS (EdDSA) under the §16 signing key.

NORMATIVE limitation (MUST be stated by presenting UIs): a redacted export is NOT re-executable and
does NOT permit `execution_hash` recomputation; its verification yields (a) issuer-signature integrity
and (b) hash-binding of each disclosed claim. The full envelope remains the artifact of record.

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

**§16.5 Proof sets and endorsement chains (NORMATIVE, new in v0.7).** `audit_signature.proof` MAY be an
array. A parallel proof set (multiple independent signers over the same artifact) follows VC Data
Integrity 1.0 proof-set semantics. An ENDORSEMENT (countersignature approving a prior signature) MUST
use proof-chain semantics: the endorsing proof's `previousProof` references the id(s) of the proof(s) it
endorses, and verifiers MUST verify chained proofs in dependency order. No new cryptosuite:
eddsa-jcs-2022 throughout.

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

**§18.6 Deterministic-node proof profile — `ocg-p18-deterministic` (NORMATIVE, profile-scoped).** The base
standard keeps §18 OPTIONAL (an artifact with no `compute_proof` is fully v0.6-conformant). An implementation
MAY additionally declare conformance to the **deterministic-node proof profile**. Under it, **every
`status:"live"` node with `gpu:false` MUST** either (a) carry a `compute_proof` that verifies against its
published `imageId` (§18.1) — `type:"ZkVmReceipt"`, `receiptFormat` ∈ {`groth16-bn254`,`stark`}, the `imageId`
present in the node's Graph Index `compute_images`, and the `journal` committed output equal to `output_payload`
(§18.0) — OR (b) declare `compute_proof_ready:"deferred"` with a stated `deferral_reason`. A node with neither is
NON-CONFORMANT to the profile. A `gpu:true` node is **OUT OF SCOPE** of this profile: its compute is
heavy/parallel and its faithful in-guest proving cost is prohibitive (§18.2), so the profile neither requires nor
forbids a proof on it (a `gpu:true` node MAY still attach one voluntarily). The `gpu` flag is the profile's
determinism/cost boundary because it is already the published, gated signal for "kernel runs as a small
deterministic server compute" (the §15 kernel-coverage gate); the profile introduces no new taxonomy.
Conformance to this profile is machine-checked by `check-compute-proof-coverage.mjs` (coverage + binding-shape +
a downward-only ratchet on the deferred count); the cryptographic pairing check stays with
`compute-proof.test.mjs` (§15). Rationale (INFORMATIVE): a blanket §18 MUST is impossible — legitimate
heavy/nondeterministic-cost nodes cannot be proven at acceptable cost — while an all-OPTIONAL posture makes a
proof an unreliable, and therefore unusable, trust signal (a consumer cannot depend on a proof that "might" be
present). The profile is the middle path: a MUST exactly over the class where it is achievable, leaving the base
standard unchanged for external implementers and for nondeterministic nodes. Its endgame — zero `deferred` on
`gpu:false` — is the state "every deterministic live node carries a real compute-integrity proof"; the AINumbers
reference deployment conforms with zero deferrals.

> Informative: a narrated walkthrough of how the AINumbers reference deployment reached full §18.6 coverage (universal guest, the deferred set, and the cross-engine determinism gate) is at [chaingraph/zkvm-compute-integrity.html](../chaingraph/zkvm-compute-integrity.html).

## §20 Anchor Binding (NORMATIVE, OPTIONAL — new in v0.7)
An artifact MAY carry portable, offline-verifiable evidence that its `execution_hash` was included in a
transparency log or timestamp service by a point in time. Anchor evidence attaches at the OPTIONAL
top-level array `anchor_bindings`, which — like §16 `audit_signature` — is attached AFTER hashing and is
EXCLUDED from `execution_hash` scope. Each entry:

```json
{
  "type": "rfc3161-tst" | "opentimestamps" | "c2sp-tlog-proof-v1" | "scitt-receipt-rfc9942",
  "anchored_hash": "sha256:…",
  "log_origin": "<TSA URL / log origin string / calendar or service identifier>",
  "proof": "<base64 verbatim TST DER | base64 OTS proof | tlog-proof@v1 text | base64 COSE receipt>",
  "policy_oid": "…", "serial": "…", "gen_time": "…", "signer_cert_chain_b64": ["…"]
}
```

`anchored_hash` MUST equal the artifact's `execution_hash` — EXCEPT when a `merkle_inclusion` member is
present (§20.1), in which case `anchored_hash` is a Merkle ROOT and the artifact `execution_hash` is a
LEAF of that tree. The last four members (`policy_oid`, `serial`, `gen_time`, `signer_cert_chain_b64`)
are `rfc3161-tst` additional members — all REQUIRED for that type, absent otherwise.

Verification (per type): `rfc3161-tst` — RFC 3161 TimeStampToken verification: messageImprint matches
`anchored_hash`, CMS signature over TSTInfo valid, signer chains to a verifier-pinned TSA root, signing
cert carries critical EKU id-kp-timeStamping, genTime sane; the DER is stored VERBATIM (never
re-encoded) so `openssl ts -verify` remains possible independently, forever;
`opentimestamps` — standard OTS verification (complete proofs verify against Bitcoin block headers
alone); `c2sp-tlog-proof-v1` — the C2SP tlog-proof verification procedure (checkpoint
signature against the log's public key, cosignature policy per the verifier's trust policy, Merkle
inclusion proof for the leaf committing `anchored_hash`, `anchored_hash` == `execution_hash`);
`scitt-receipt-rfc9942` — COSE receipt verification per RFC 9942 (accepted as an evidence type
for interop; OCG implementations are NOT SCITT Transparency Services and SCRAPI is out of scope).
Multi-TSA redundancy across independent authorities/algorithms is RECOMMENDED per RFC 4998 (informative).
A verifier MUST reject a binding whose `anchored_hash` differs from the artifact's recomputed
`execution_hash` (or, under §20.1, whose reconstructed Merkle root differs from `anchored_hash`).
Multiple bindings MAY coexist (several logs, plus OTS).

### §20.1 Merkle inclusion — batch anchoring (NORMATIVE, OPTIONAL — new in v0.8)
A `rfc3161-tst` or `opentimestamps` binding MAY carry an OPTIONAL `merkle_inclusion` member so that ONE
timestamp covers MANY artifacts: the anchored value is the ROOT of an [RFC 6962](https://www.rfc-editor.org/rfc/rfc9162)
Merkle tree and each covered artifact's `execution_hash` is a LEAF. (The `c2sp-tlog-proof-v1` and
`scitt-receipt-rfc9942` types already carry their own inclusion proof inside `proof`, so they do NOT
use this member.)

```json
"merkle_inclusion": {
  "leaf": "<the artifact execution_hash>",
  "index": 0,
  "path": ["sha256:…", "…"],
  "tree_size": 6,
  "algorithm": "rfc6962"
}
```

When `merkle_inclusion` is present a verifier MUST: (1) confirm `merkle_inclusion.leaf` equals the
artifact's recomputed `execution_hash`; (2) reconstruct the tree root from `leafHash(leaf)` + `path`
using the RFC 6962 inclusion-proof procedure (the SAME `leafHash`/`nodeHash`/`rootFromInclusion` used by
the `c2sp`/`scitt` verifiers — no second Merkle implementation); and (3) require the reconstructed root
to equal the binding's `anchored_hash`. Any mismatch FAILS the binding. Absent this member, `anchored_hash`
== `execution_hash` directly (unchanged v0.7 behavior). `merkle_inclusion` rides OUTSIDE the
`execution_hash` preimage like the rest of `anchor_bindings`.

Semantics (NORMATIVE honesty): an anchor binding proves EXISTENCE of the artifact bytes by a time and
INCLUSION in the named log. It does not prove computational correctness (§18), authorship (§16), or
kernel identity (§17); the four are independent, composable claims. Because inclusion evidence is
SHA-256 Merkle data, anchor bindings retain their timestamp value even against a future signature
break (informative).

## §21 Chain Execution (NORMATIVE — new in v0.8)
Until v0.8 chain execution (`run_chain` / `composite_execution_hash`) was implementation-defined. §21
makes the **existing linear contract** normative (§21.1–§21.3, descriptive of shipped behavior) and adds
**decision gates** on top (§21.4). A chain is a `chaingraph.json` `chains[]` entry: `{ name, title?,
steps: [{ tool_id, handoff?, id?, gate? }] }`. Execution is deterministic, zero-PII, zero payload
logging. The reference surfaces are the Worker `run_chain` and the byte-identical embedded `runChain`;
both MUST produce the identical `composite_execution_hash` for the same chain + inputs.

### §21.1 Linear execution model (descriptive of shipped behavior)
Steps run in **array order**. For each step, by `tool_id`: an unknown node → status `unknown_node`; a
`gpu:true` node → `gpu_browser_only`; a node with no registered kernel → `no_kernel_browser_only`;
otherwise the kernel's `buildArtifact(policy_parameters, opts)` runs. `policy_parameters` for a step are
the caller-supplied `inputs[tool_id]`, else the vendored chain fixture, else `{}`; a kernel that throws
for missing required inputs yields status `input_required` (never a silent failure). A step that
produces an artifact has status `ok` and is a **RAN** step.

Parent threading: `opts.parent_hashes = [previous RAN step's execution_hash]` (or `[]` for the first RAN
step), `opts.parent_tool_ids` likewise, and `opts.chain_depth = <the step's zero-based array index>`.
Only a RAN step advances the "previous" pointer; a skipped/failed step does not. §17 `build_identity` and
§18 `compute_proof` are attached to a step artifact exactly as in the single-node compute path
(hash-excluded).

### §21.2 Composite preimage (NORMATIVE — the chain-level integrity anchor)
The chain emits ONE composite artifact whose `execution_hash` is the §4 canonical hash over exactly
`{ policy_parameters: composite_policy, output_payload: composite_output }`, computed over the **RAN
steps only** (steps with status `ok`), via the same `kernels/_hash.mjs` canonicalizer (no new hash path):

```
composite_policy = { compute_mode: "server", chain, chain_title, step_count: <#ran>, step_tool_ids: [<ran tool_ids>] }
composite_output = { chain, steps: [ { tool_id, mandate_type, execution_hash, output_payload } … per RAN step ] }
```

Per-step timestamps and `mandate_id`s are EXCLUDED from the preimage, so the composite hash is
reproducible. If no step ran, `composite_execution_hash` is `null` and no composite artifact is emitted.

### §21.3 Composite artifact
The composite artifact carries `chaingraph_version:"0.4.0"`, `compute_mode:"server"`,
`tool_id:"chaingraph/chains/<name>"`, `chain.parent_hashes = [<each RAN step execution_hash>]`,
`chain.parent_tool_ids = [<ran tool_ids>]`, `chain.chain_depth = <#ran>`, `policy_parameters =
composite_policy`, `output_payload = composite_output`. It re-verifies under §4 like any artifact.

### §21.4 Decision gates (NORMATIVE — new in v0.8)
A step MAY carry an OPTIONAL string `id` (defaults to `tool_id`; MUST be unique within a GATED chain) and
an OPTIONAL `gate` that routes control conditionally after the step runs:

```
gate = { input: <RFC 6901 pointer into THIS step's output_payload>,
         rules: [ { op, value?, next } … ],
         default: <step id | "end"> }
```

- `op` ∈ the **closed enum** `{ eq, neq, gt, gte, lt, lte, in, present, absent }`. Comparison is **strict
  — no type coercion**; `gt/gte/lt/lte` require FINITE numbers on both sides (a type-mismatched or absent
  operand simply does not match); `in` tests membership in a literal array; `present`/`absent` test
  existence only and carry no `value`. Existence is tested ONLY with `present`/`absent`; every other op
  requires the pointer to resolve.
- Rules are evaluated **first-match**. When none match, the REQUIRED `default` is taken — so a gate is a
  **total function** and an agent runs a gated chain end-to-end with no human in the loop.
- All `next`/`default` targets are **FORWARD-ONLY** (a later array index) or the literal `"end"`. Forward
  targets make the chain **acyclic and guaranteed-terminating** by construction. No loops, no backward
  jumps, no parallel branches, no human-in-the-loop gate type.
- A step evaluated to be jumped over gets status **`skipped_by_gate`** (distinct from `input_required` /
  `no_kernel_browser_only`). A step with no `gate` falls through **linearly** to the next array index. A
  gate is evaluated ONLY when its step produced output (`ok`); a step that did not run falls through
  linearly (no decision recorded).

**Hash binding — CONDITIONAL-PRESENCE (only when the chain defines ≥1 gate).** A chain with no gate is
pure linear and its `composite_execution_hash` is UNCHANGED from §21.2 — this is the single most
important compatibility rule (a golden-fixture freeze gate enforces it). When the chain has ≥1 gate, and
ONLY then, three members enter the composite preimage:

- `composite_policy.route_plan_digest` — bare-hex SHA-256 over the JCS-canonical (`kernels/_hash.mjs`,
  the ONE canonicalizer) full `steps[]` definition (the decision policy, including gates);
- `composite_output.decisions[]` — one record per EVALUATED gate: `{ step_id, input_pointer,
  observed_value, matched_rule_index, op, value, next }`, recomputable by a verifier from the recorded
  `output_payload`s (tamper-evident: mutate a decision or an observed value and the recompute fails);
- `composite_output.path_taken[]` — the ordered executed step ids.

These keys are absent for linear chains, so no linear chain's composite hash moves. The evaluator is ONE
pure ECMA-262 module (`kernels/_gateval.mjs`) — no expression language, no second canonicalizer — used
byte-identically on every executing surface.

## §22 Work Mandates (NORMATIVE — new in v0.8.1)
A **Work Mandate** is a signed OpenChainGraph artifact that delegates bounded authority: a principal
authorizes an agent to run a defined set of nodes/chains, under stated conditions, within a validity
window, with named escalation triggers. It is the "Authorize" step of the estate loop — authored once by a
human, then enforced deterministically on every run. §22 makes the mandate **format** and the
`compile_work_mandate` **I/O contract** normative (additive; `spec_version` 0.8.1). The escalation-record
lifecycle (open/close) and the `escalate` **evaluator semantics** are RESERVED here and specified in a
forthcoming revision (the escalation-record layer); §22 names them so no reader mistakes escalation
*execution* for shipping in this section.

This section changes NO frozen structure: `chaingraph_version` stays `0.4.0`, the §4 hash preimage is
unchanged, the v0.4 artifact envelope is untouched. `mandate_type: "work_mandate"` is an accepted value of
the EXISTING open `mandate_type` string (§5 — not a hard enum) — no envelope edit. The mandate DOCUMENT is a
separate schema `$def` (`workMandateDocument`), never the artifact envelope.

### §22.1 Mandate document (NORMATIVE)
A Work Mandate's authority lives in its `output_payload`, whose members are:
- `mandate_type` (envelope, §5): the literal `"work_mandate"`.
- `scope` (REQUIRED): `{ tool_ids: [string], chains: [string] }` — the nodes and chain names this mandate
  authorizes. At least one of the two arrays MUST be non-empty. A run that invokes a node/chain outside
  `scope` is unauthorized under this mandate.
- `conditions` (REQUIRED, MAY be empty): an array of threshold conditions, each `{ pointer, op, value }`,
  where `pointer` is an RFC 6901 JSON Pointer into a step's `output_payload`, `op` is drawn from the §21.4
  closed gate-op enum `{ eq, neq, gt, gte, lt, lte, in, present, absent }`, and `value` is the operand
  (absent for `present`/`absent`). A condition names the auto-approval envelope: the input, the test, the
  bound.
- `escalation_triggers` (REQUIRED, MAY be empty): an array of `{ pointer, op, value }` conditions in the
  same shape whose satisfaction routes the run to the reserved escalation target (§22.3) instead of
  continuing.
- `validity` (REQUIRED): `{ not_before, not_after }`, ISO 8601 instants. A run whose execution instant is
  outside `[not_before, not_after]` MUST be rejected (§22.5).
- `principal` (REQUIRED): `{ id }` — the authorizing party, a `did:key` or LEI (§9). The mandate's §16
  signature MUST be verifiable against this identity.
- `anchor` (OPTIONAL): a §20 anchor binding over the mandate hash (§22.2), for independent proof of when
  the mandate existed.

### §22.2 Signature and mandate hash (NORMATIVE)
A Work Mandate MUST carry a §16 `eddsa-jcs-2022` Data Integrity proof at `audit_signature.proof` over the
whole artifact. **An unsigned mandate is a DRAFT and is NOT enforceable** — the runtime (§22.5) MUST reject
a mandate with no valid signature. The mandate's own §4 `execution_hash` IS its identifier, the **mandate
hash**; wherever a run references "the mandate in force" it references this hash. The mandate hash is what a
receipt folds in (§22.5) so the receipt proves *which* policy governed the run.

### §22.3 Reserved escalation routing target (NORMATIVE — name only; evaluator semantics forthcoming)
§22 RESERVES the literal string `"escalate"` as a decision-gate routing target, beside the existing §21.4
`"end"`. A compiled mandate's escalation triggers become gate rules whose `next` is `"escalate"`. This
section reserves the NAME and its meaning ("route the run out of the automated path into the exception
path") only. The **evaluator semantics of `"escalate"`** — halting remaining steps, the
`skipped_by_escalation` status (distinct from `skipped_by_gate`), and the OPEN escalation record — are NOT
normative in this section; they are specified in **§22.8 (NORMATIVE, v0.8.2)** and implemented in its
`kernels/_gateval.mjs` update (the evaluator recognizes `"escalate"` as a terminal target there). A compiler
MAY emit `"escalate"` targets and a static validator MUST accept `"escalate"` as a **reserved forward
target** (not an unresolved step id). `"end"` remains the terminal target for the fully-automated path.

### §22.4 `compile_work_mandate` I/O contract (NORMATIVE)
`compile_work_mandate` is a deterministic `gpu:false` node that turns a mandate document into a §21.4
gated-chain configuration. It is the write side of the loop.

**INPUT** — the mandate document (§22.1) supplied as the node's `policy_parameters`
(`policy_parameters.input_parameters.mandate` = the mandate `output_payload`, plus the string
`policy_parameters.input_parameters.mandate_hash`). The compiler treats the mandate as data; it does NOT
verify the signature — that is the runtime's job (§22.5).

**OUTPUT** — `output_payload.chain_config` of exactly this shape:
```
chain_config = {
  steps: [ {
    tool_id,                       // REQUIRED
    id?,                           // OPTIONAL step id (defaults to tool_id; unique within the gated chain)
    handoff?,                      // OPTIONAL
    gate?: {                       // present iff this step carries >=1 condition/trigger
      input,                       // RFC 6901 pointer (a condition/trigger pointer)
      rules: [ { op, value?, next } … ],
      default                      // REQUIRED (total function, §21.4)
    }
  } … ]
}
```
Compilation rules (NORMATIVE, v0.8.1):
1. **Steps.** `scope.chains[0]` (if present) supplies the ordered `steps[]` skeleton; otherwise
   `scope.tool_ids` supplies steps in array order. Each `scope` step becomes one `chain_config` step, with
   `id` defaulting to `tool_id`.
2. **One gate per checkpoint step, one pointer per gate.** Every `conditions[]` / `escalation_triggers[]`
   entry addresses (via its `pointer`) the output of exactly one `scope` step — its **checkpoint step**.
   The compiler attaches a single gate to that step. §21.4 permits one gate per step and one `input`
   pointer per gate, so **all conditions and triggers on a given step MUST share one `pointer`**; if two
   entries on the same step name different pointers, that is a multi-pointer policy — NOT expressible as a
   single §21.4 gate — and the compiler MUST reject the mandate with `{ error: "multi_pointer_gate" }`,
   deferring to the forthcoming decision-table artifact (spec_version 0.9, reserved). This keeps the
   v0.8.1 compiler total and deterministic.
3. **Rules.** For a checkpoint step's gate, emit rules in this fixed order: first the step's
   `escalation_triggers` in mandate-array order, each `{ op, value, next: "escalate" }`; then the step's
   `conditions` in mandate-array order, each `{ op, value, next: <the next scope step's id, or "end" if
   the checkpoint is the last step> }`. `value` is omitted for `present`/`absent`.
4. **Default.** `default: "escalate"` — management-by-exception: a value matching no condition and no
   trigger routes to the human. (Escalation execution is forthcoming, §22.3; the compiled `"escalate"`
   target is nonetheless emitted and reserved-valid now.)
5. **Determinism / canonicalization.** Same mandate document → **byte-identical** `chain_config`, hence a
   hash-stable `execution_hash`. The compiler reads ONLY the mandate fields (no clock, no RNG, no
   environment); step order follows `scope`; rule order follows rule 3; and `execution_hash` is computed
   over `{ policy_parameters, output_payload }` via the ONE canonicalizer `kernels/_hash.mjs` (RFC 8785 /
   JCS `cgCanon`) — never a hand-built preimage.

**Worked example (authoritative target for the compiler fixture).** Mandate `output_payload`:
```
{
  "mandate_type": "work_mandate",
  "scope": { "tool_ids": [], "chains": ["loan-preflight"] },
  "conditions":          [ { "pointer": "/decision/approved", "op": "eq", "value": true  } ],
  "escalation_triggers": [ { "pointer": "/decision/approved", "op": "eq", "value": false } ],
  "validity":  { "not_before": "2026-07-06T00:00:00Z", "not_after": "2027-07-06T00:00:00Z" },
  "principal": { "id": "did:key:z6MkExampleAuthorizingPrincipalKey" }
}
```
where chain `loan-preflight` has steps `[assess_loan, record_outcome]` and `assess_loan`'s `output_payload`
carries `decision.approved`. The checkpoint step is `assess_loan` (it produces `/decision/approved`).
Compiled `chain_config`:
```
{
  "steps": [
    {
      "tool_id": "assess_loan",
      "id": "assess_loan",
      "gate": {
        "input": "/decision/approved",
        "rules": [
          { "op": "eq", "value": false, "next": "escalate" },
          { "op": "eq", "value": true,  "next": "record_outcome" }
        ],
        "default": "escalate"
      }
    },
    { "tool_id": "record_outcome", "id": "record_outcome" }
  ]
}
```
The trigger rule precedes the condition rule (rule 3, first-match); the condition continues to the next
scope step `record_outcome`; the default escalates.

### §22.5 Runtime binding (NORMATIVE — the contract; implemented in the runtime layer, not this section)
`run_chain` MAY accept an OPTIONAL `mandate` argument (the signed mandate artifact). When **absent**,
run_chain behavior and every composite/step `execution_hash` are BYTE-IDENTICAL to pre-mandate behavior
(the linear-hash-freeze invariant — mandate keys are conditional-presence, exactly the §21.4 discipline).
When **present**, the runtime MUST, before executing any step:
1. verify the mandate's §16 signature against `principal.id`; missing/invalid → structured rejection
   `{ error: "mandate_unsigned" | "mandate_bad_signature" }`, no steps run;
2. verify the execution instant is within `validity`; outside → `{ error: "mandate_not_yet_valid" |
   "mandate_expired" }`, no steps run;
3. verify the chain/nodes being run are within `scope`; outside → `{ error: "mandate_out_of_scope" }`.

On acceptance the runtime folds `mandate_hash` into EVERY step's `policy_parameters` and into
`composite_policy` as a CONDITIONAL-PRESENCE key `mandate_hash` (present iff a mandate governs the run). A
run with no mandate MUST NOT carry the key, so its composite hash is unchanged from §21.2/§21.4. A run WITH
a mandate carries `mandate_hash` in the preimage, so the receipt cryptographically proves which policy was
in force. This mirrors the §21.4 gate-key discipline exactly and is enforced by the linear-hash-freeze gate
(no-mandate hashes frozen) plus the runtime mandate-binding gate (with/without mandate → different composite
hashes, each stable). The implementation lands in the runtime layer (forthcoming); §22.5 is the contract it
MUST satisfy.

### §22.6 Vocabulary alignment (informative — aligned with, no dependency on)
Mandate field names align with adjacent agent-authority vocabularies so an implementer can map cleanly,
WITHOUT any runtime dependency on them (Rider R2):
- **Google AP2 mandates** (v0.2.0, donated to the FIDO Alliance): an AP2 Intent/Cart mandate is a bounded,
  signed grant of authority; the Work Mandate `scope` + `conditions` + `principal` + signature play the
  same role for arbitrary compute authority rather than payment authority. `principal` ≈ AP2 mandate
  issuer; the mandate hash ≈ AP2 mandate id.
- **OpenID AuthZEN AARP** (Agent Authorization draft): AARP's subject / resource / action request maps to
  `principal` (subject), `scope` (resource), and the authorized node/chain invocation (action);
  `conditions` / `escalation_triggers` express the obligation/advice layer AARP leaves to the policy
  decision point.
- **SCITT / RFC 9942 receipts**: a compiled-and-run mandate's composite receipt (mandate hash folded in) is
  the transparency "statement"; a §20 anchor over it is the SCITT-style "receipt". Naming is chosen so a
  future SCITT registration is a re-labelling, not a re-model.

### §22.7 Normative now vs forthcoming
- **NORMATIVE in v0.8.1 (this section):** the mandate document shape (§22.1); the signature requirement +
  mandate-hash identity (§22.2); the reservation of the `"escalate"` target NAME (§22.3); the
  `compile_work_mandate` I/O contract, compilation rules, determinism, and worked example (§22.4); the
  run_chain mandate-binding contract and its conditional-presence hash rule (§22.5).
- **NORMATIVE in v0.8.2 (§22.8):** the `"escalate"` evaluator semantics — `"escalate"` as a terminal target
  classified by the single-source `isTerminalTarget`/`isEscalationTarget` exports (the decision record
  UNCHANGED); the `skipped_by_escalation` runtime-halt contract; the OPEN escalation record with its
  deterministic, wall-clock-excluded record hash; and the countersigned closure contract via Anchorproof.
- **FORTHCOMING (reserved here; specified + implemented in a later revision):** the `run_chain` emit/halt
  implementation and the `verify_escalation_closure` utility (the escalation-record runtime layer); the
  exception-queue surface (human review); and the SEP-2322 / MCP-Tasks transport binding (§22.8.5).

### §22.8 Escalation records (NORMATIVE — new in v0.8.2)
This section makes normative the `"escalate"` **evaluator semantics**, the **open escalation record**, and
its **countersigned closure** — the escalation-record layer RESERVED by §22.3/§22.7. It is additive and
backward-compatible: it changes NO existing gate decision, NO frozen structure (`chaingraph_version` stays
`0.4.0`, the §4 preimage and the v0.4 artifact envelope are untouched), and every existing composite/step
`execution_hash` is byte-identical. It is TRANSPORT-AGNOSTIC (§22.8.5): escalation records and closures are
pure artifacts; nothing here depends on any transport.

**§22.8.1 Evaluator semantics of `"escalate"`.** `"escalate"` is a TERMINAL routing target beside `"end"`: a
decision-gate rule (or the `default`) whose `next` is `"escalate"` routes control OUT of the chain, exactly
like `"end"`, preserving every §21.4 invariant (graph-agnostic, forward-only, acyclic, total). It differs
from `"end"` in MEANING only — `"end"` = normal automated completion; `"escalate"` = the run leaves the
automated path into the exception path. The §21.4 evaluator (`kernels/_gateval.mjs`) returns the SAME
decision record for an escalate route as for any other route: `{ step_id, input_pointer, observed_value,
matched_rule_index, op, value, next }` with `next === "escalate"`. **No escalation field is added to the
decision record**, so the hashed `composite_output.decisions[]` is byte-identical to a non-escalating gate
and no composite hash moves. Escalation is a property of the decision's `next`, recovered by the
single-source classifiers the evaluator exports — `isTerminalTarget(next)` (`next === "end" || next ===
"escalate"`) and `isEscalationTarget(next)` (`next === "escalate"`). Every executing surface (run_chain, the
embedded runChain, the QuickJS guest, the composer pages) consults the evaluator, so terminal/escalation
classification is byte-parity across all four and no surface hard-codes the literal.

**§22.8.2 Runtime semantics (NORMATIVE contract — implemented in the runtime layer, not this section).**
When a gate decision routes to `"escalate"`, `run_chain` MUST: (a) record the triggering decision in
`composite_output.decisions[]` and the escalating step in `path_taken[]` exactly as §21.4 requires; (b) HALT
— run no further step; (c) give every not-yet-run step the status **`skipped_by_escalation`**, DISTINCT from
`skipped_by_gate` (a step jumped over by a normal forward route); and (d) attach an OPEN escalation record
(§22.8.3) to the composite. The composite `execution_hash` is still computed over RAN steps only (§21.2);
`skipped_by_escalation` steps, like any skipped step, do not enter the preimage. The emit/halt
implementation is the escalation-record runtime layer (forthcoming — the `run_chain` update), not this
section.

**§22.8.3 Open escalation record (NORMATIVE shape) + DETERMINISM.** An open escalation record has these
members:
```
escalation_record = {
  mandate_hash,   // present IFF the run was mandate-bound (§22.5); ABSENT otherwise
  decision,       // the §21.4 decision object that routed to "escalate" (verbatim)
  halted_steps,   // ordered array of the §21.4 step ids given skipped_by_escalation
  opened_at       // ISO 8601 instant the record was opened — WALL-CLOCK, hash-EXCLUDED
}
```
DETERMINISM (the load-bearing rule). `opened_at` is wall-clock and MUST NOT enter any hash preimage —
neither the composite/step `execution_hash` (§21.2 RAN-steps-only already excludes it) NOR the
escalation-record hash. The **escalation-record hash** is the §4 canonical hash (`kernels/_hash.mjs`, the ONE
canonicalizer, RFC 8785 / JCS `cgCanon` — never a hand-built preimage) over exactly the DETERMINISTIC
subset:
```
escalation_record_preimage = { mandate_hash?, decision, halted_steps }
```
`mandate_hash` is present iff the run was mandate-bound — the same conditional-presence discipline as §22.5,
so an unbound escalation's preimage OMITS the key (its hash is unchanged by mandate machinery). `opened_at`
and any other wall-clock or environment value are hash-EXCLUDED adjacent metadata, exactly as §20 anchor
bindings and §17/§18 identity are hash-excluded. Therefore the escalation-record hash is REPRODUCIBLE from
the recorded deterministic fields alone: a verifier recomputes it from `{ mandate_hash?, decision,
halted_steps }`, and the closure (§22.8.4) binds THAT hash. Two runs that escalate on identical inputs
produce the identical record hash regardless of when they ran.

**§22.8.4 Closure contract (NORMATIVE).** An open record CLOSES only via a **countersigned closure
artifact**: the escalation-record hash (§22.8.3) signed through Anchorproof `create_signature_envelope`
(passkey / JAdES, live on `anchor.ainumbers.co`). The closure references:
```
closure = {
  record_hash,   // the §22.8.3 escalation-record hash (bare-hex SHA-256) — the SIGNED value
  decision,      // approver decision ∈ { "approve", "reject" }
  anchor,        // §20 anchor binding produced by the envelope (timestamp / OTS / TSA)
  envelope       // the Anchorproof signature envelope (JAdES) whose signed payload IS record_hash
}
```
The envelope's signed payload IS `record_hash`; the binding between closure and record is that hash
equality, nothing softer. Closure VERIFICATION (`verify_escalation_closure`, a forthcoming utility) passes
IFF ALL hold: (1) Anchorproof `verify_signature_envelope` accepts `closure.envelope` (signature valid,
LTV/anchor intact); (2) the record hash recomputed from the open record's deterministic subset (§22.8.3)
EQUALS `closure.record_hash` (tamper-evident — mutate the decision, the halted steps, or the mandate binding
and the recompute diverges); and (3) `closure.decision` echoes an approver decision in `{ approve, reject }`.
Only a record whose recomputed hash matches a validly-countersigned closure is CLOSED; anything else stays
OPEN.

**§22.8.5 Transport-agnostic (NORMATIVE) — D3.** Escalation records and closures are ARTIFACTS with no
transport dependency. Delivering an open record to a human queue and returning the closure envelope is out
of band of this section. A binding to SEP-2322 / MCP-Tasks (asynchronous task transport) is a FORTHCOMING
worker rider, cited here as future; nothing in §22.8 depends on it.

**§22.8.6 Vocabulary alignment (informative — aligned with, no dependency).** The open-record ↔ closure pair
aligns with adjacent authority/receipt vocabularies WITHOUT any runtime dependency (Rider R2): the closure's
approver `decision` maps to an **OpenID AuthZEN AARP** access decision (permit/deny ≈ approve/reject) issued
by the human policy decision point the gate deferred to; and a countersigned closure over a record hash is a
**SCITT / RFC 9942** receipt-shaped statement (the record hash is the "statement", the Anchorproof envelope
plus its §20 anchor the "receipt") — named so a future SCITT registration is a re-labelling, not a re-model.

## §23 Input Attestations (NORMATIVE, OPTIONAL — new in v0.8.3)
The §4 `execution_hash` proves the artifact's computation over the inputs it was GIVEN; it says nothing
about whether those inputs were themselves authentic (the import-binding honesty caveat). §23 lets an
artifact carry portable, per-input evidence that a NAMED input was vouched for by an external source —
without changing what `execution_hash` means. Input evidence attaches at the OPTIONAL top-level array
`input_attestations`, which — like §16 `audit_signature` and §20 `anchor_bindings` — is attached AFTER
hashing and is EXCLUDED from `execution_hash` scope. **An artifact with zero attestations remains fully
conformant** (the honest caveat simply stays stated); attestations NEVER enter the preimage, so adding,
removing, or re-ordering them leaves every existing `execution_hash` byte-identical. Each entry:

```json
{
  "type": "vc-2.0" | "c2pa-manifest" | "rfc3161-snapshot" | "zktls",
  "pointer": "/input_parameters/<field>",
  "proof": { } | "<base64 | opaque proof payload>",
  "source_ref": "<issuer DID / URL / origin string naming who vouches>"
}
```

`pointer` is an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer evaluated **against
`policy_parameters`** (NOT the whole artifact) — it names WHICH input this entry attests. A verifier MUST
reject an entry whose `pointer` does not resolve to a value inside the artifact's `policy_parameters`. The
attested value is the resolved node; where a type binds a digest, that digest MUST equal the SHA-256 of the
canonical (§4 `cgCanon`) encoding of the resolved value. `source_ref` identifies the vouching source and is
informative to the trust decision, never a substitute for verifying `proof`.

### §23.1 Type phasing (NORMATIVE — D2)
Three types are VERIFIABLE NOW with already-shipped machinery; `zktls` is DEFINED here in prose with its
verification marked EXTERNAL (no vendored verifier ships — vendoring a TLSNotary-class verifier would break
the zero-dependency posture; it is revisited when a small stable verifier exists).

- **`vc-2.0` (verifiable now).** `proof` is a [W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
  credential whose `credentialSubject` binds the pointed-to input (by value or by its SHA-256 digest).
  Verification reuses the shipped §16 / §13.11 machinery: the credential's Data Integrity proof
  (`eddsa-jcs-2022`) — or an enveloping JOSE/COSE proof — MUST verify, AND the subject digest MUST equal the
  §4-canonical digest of the resolved input value. A `vc-2.0` entry that verifies is CONFIRMED.
- **`rfc3161-snapshot` (verifiable now).** `proof` is an RFC 3161 TimeStampToken (stored VERBATIM, base64
  DER) whose `messageImprint` is the SHA-256 of the pointed-to input value — a timestamped snapshot proving
  the input existed, unchanged, by the token's `genTime`. Verification reuses the SAME §20 `rfc3161-tst`
  verifier (messageImprint match, CMS signature, chain to a pinned TSA root, critical id-kp-timeStamping EKU,
  sane genTime) — **no second RFC 3161 implementation**. `messageImprint` MUST equal the resolved input's
  §4-canonical digest.
- **`c2pa-manifest` (verifiable now — structural).** `proof` is a [C2PA](https://c2pa.org/) manifest
  asserting provenance of the pointed-to input (typically a document or media input). Verification NOW is
  STRUCTURAL: the manifest parses, its claim signature is well-formed, and its hard-binding assertion digest
  MATCHES the resolved input's bytes/digest; full trust-chain evaluation of the signer is a link-out to a
  C2PA validator (the artifact carries the manifest verbatim so that remains possible). A `c2pa-manifest`
  entry passing structural checks is CONFIRMED-STRUCTURAL.
- **`zktls` (defined; EXTERNAL verification).** `proof` is a zkTLS / TLSNotary-class proof that the
  pointed-to input was served by the TLS origin named in `source_ref`. OCG ships NO verifier for it: a
  verifier reports a `zktls` entry as PRESENT with `verifiable: "external"` — structural fields checked, the
  cryptographic claim NEITHER confirmed nor refuted by OCG machinery — and MUST NOT present it as
  OCG-confirmed. It is reserved so the profile is stable when a vendorable verifier lands.

### §23.2 Verifier report (NORMATIVE)
A verifier reports per-input attestation status ALONGSIDE (never folded into) the `execution_hash` result.
For each `input_attestations` entry it emits `{ pointer, type, structural: "pass"|"fail",
verifiable: "verified"|"failed"|"external"|"n/a" }`: `structural` covers pointer resolution + digest binding
+ payload well-formedness; `verifiable` is the cryptographic verdict (`external` for `zktls`; `n/a` only when
a type carries no independent cryptographic check). The `execution_hash` verdict is COMPUTED INDEPENDENTLY of
attestation status — a failed or absent attestation NEVER changes the hash verdict, and a passing attestation
NEVER substitutes for it. NORMATIVE honesty: §23 attests INPUT provenance where sources support it; it does
not make an un-attested input trusted, does not prove computational correctness (§18), authorship (§16),
kernel identity (§17), or existence-in-time of the artifact (§20) — the claims are independent and
composable. A UI presenting attestations MUST keep the zero-attestation caveat visible.

### §23.3 Frozen-envelope invariance (NORMATIVE)
`input_attestations` is declared as an OPTIONAL top-level artifact property (exactly as §20 `anchor_bindings`
was), so `$defs/artifact.required`, the §4 preimage members, and `chaingraph_version` `0.4.0` are UNTOUCHED.
A verifier correct for v0.7/v0.8 computes an identical `execution_hash` for a v0.8.3 artifact and MAY ignore
`input_attestations` entirely. Any type whose binding would require folding attestation data INTO the preimage
is out of profile — attestations are adjacent evidence, never inputs to the hash.

## §24 Deterministic Compute Profile — `ocg-deterministic-compute` (NORMATIVE, profile-scoped — new in v0.8.4)
OCG's integrity model already assumes a kernel is a **pure, deterministic function of its inputs**: §4 makes the
output tamper-evident, §17 pins *which* kernel source ran, §18 proves *that* it ran, and §18.5 fixes the specific
cross-engine hazards a real deployment hit. This section adds **no new machinery**. It **names** the determinism
those layers already enforce as a single, citable profile — an implementation that already passes the §15 gate
suite already conforms — modeled on the **W3C WebAssembly 3.0 Deterministic Profile** (W3C Candidate
Recommendation, April 2026), which conforms an execution environment by *enumerating* every source of
nondeterminism and *fixing or banning* each one. The profile's value is a name a verifier, an auditor, or a
second implementer can point at: "OCG kernels run under a deterministic compute profile whose every escape hatch
is closed by a named, executable gate."

**§24.0 Scope.** The profile governs a kernel's `compute(policy_parameters) → output_payload` under §12: the
function whose result feeds the §4 preimage. It applies to the class §18.6 already delimits — every `gpu:false`,
`status:"live"` node (`gpu:true` nodes are out of scope for the same cost/parallelism reason as §18.6). It binds
the compute surfaces to **byte-identical output** for identical input across the browser tool, the Cloudflare
Worker (§12 server path), and the fixed zkVM guest (§18) — and, as VM-1 lands, the in-browser QuickJS VM that runs
the *same C interpreter family* as the §18 guest, so its outputs diff-check against the Worker rather than
introducing a fourth engine. Determinism here means **reproducible-bit**, not merely "same up to rounding":
the whole point of §4 is that one differing bit is a different `execution_hash`.

**§24.1 Enumerated nondeterminism sources (NORMATIVE — each fixed or banned).** A conforming kernel MUST NOT let
any of the following affect `output_payload`. Each row states the rule and the **existing** §15 gate that already
enforces it; the profile introduces no gate of its own.

| # | Source | Rule under this profile | Enforcing mechanism / §15 gate |
|---|---|---|---|
| D1 | **Non-finite floats** (`NaN`, `±Infinity`) | An `output_payload` MUST canonicalize under RFC 8785 / I-JSON, which forbids non-finite numbers; a kernel MUST either return finite output or reject its input cleanly, never emit a silent `NaN`. | §4 canonicalization (`kernel-hash-integrity.mjs`, `lint-forbidden-hash.mjs`, `golden-parity.test.mjs`) rejects non-finite numbers at hash time; the degenerate empty-input path is swept by `empty-input-finite.test.mjs`. |
| D2 | **Object / key iteration order** | Serialization MUST NOT depend on property insertion or enumeration order; the preimage is built by the one canonical RFC 8785 (JCS) sorter in `_hash.mjs`, never by hand. | §4 canonical `execution_hash` (`kernel-hash-integrity.mjs`, `golden-parity.test.mjs`); ad-hoc canonicalization trips `lint-forbidden-hash.mjs` ("Scheme E"). Chain-level order fixed by `gate-parity.test.mjs`. |
| D3 | **Transcendental math** (`Math.exp/log/log2/sin/cos/pow`) | Only `+ − × ÷ √` are IEEE-754 bit-portable; every transcendental MUST route through the shared pure-JS fdlibm port `kernels/_detmath.bundle.mjs` (inlined per kernel, never engine libm), so the value users see equals the value proven (§18.5(c)). | §4 cross-surface hash stability (`golden-parity.test.mjs`) + evaluator byte-parity (`gate-parity.test.mjs`); the re-baseline is frozen by the same golden fixtures. |
| D4 | **Wall-clock time** (`Date.*`, timers) | No `Date`, timestamp, or timer reading may enter `output_payload` or the §4 preimage. Time-bearing evidence (anchor `genTime`, escalation `opened_at`) is defined hash-EXCLUDED (§20, §22.8). The §18 guest disables `Date` at the intrinsic level (§18.5); VM-1 disables it identically. | §4 reproducibility (`golden-parity.test.mjs`, live `hash-sweep.mjs`); wall-clock exclusion of escalation records enforced by `linear-hash-freeze.mjs` / `gate-parity.test.mjs`. |
| D5 | **Randomness** (`Math.random`, CSPRNG) | No nondeterministic randomness may reach `output_payload`. `Math.random` is stubbed out of the §18 guest and the VM-1 prelude. The one CSPRNG in the standard (§13.12 SD-JWT salts) is confined to disclosure material that is EXCLUDED from the artifact hash. | §4 determinism (`golden-parity.test.mjs`); SD-JWT salt-as-sole-nondeterminism is pinned by `sd-export-roundtrip.test.mjs`. |
| D6 | **Locale / `Intl`** | No locale-sensitive formatting may affect `output_payload`. Locale-dependent number formatting routes through a pinned `en-US` formatter verified value-for-value against V8 (§18.5(a)); the §18 guest and the QuickJS-ng VM ship **no `Intl`** at all (a determinism gift, not a gap). | §4 cross-surface parity (`golden-parity.test.mjs`); the pinned formatter's equivalence is covered by the same golden fixtures. |
| D7 | **Environment / platform APIs** | Where a rule would otherwise depend on a V8 platform API whose result is environment-sensitive or infeasible to prove in-guest, the kernel MUST substitute a fully specified deterministic replacement used **identically on every surface**, with its out-of-scope aspects stated in source (§18.5). Network, filesystem, and ambient I/O are already forbidden by CONTRACT §0 (zero-fetch). | §18.5 replacements + §12 kernel-coverage (`kernel-coverage.mjs --strict`); cross-surface identity by `golden-parity.test.mjs` and, for gated chains, `gate-parity.test.mjs`. |

Rows D1–D7 are exhaustive over the escape hatches the Wasm 3.0 Deterministic Profile enumerates for a
JS/Wasm execution environment (float exceptions, memory/iteration nondeterminism, `NaN` bit-patterns, host calls,
clocks, entropy, locale). Any *future* source of nondeterminism admitted into the kernel model is a normative
change to this profile (see §24.2), not a silent addition.

**§24.2 Freeze clause (NORMATIVE — kernel-semantics immutability).** Modeled on the RISC-V base-ISA freeze
policy: **a ratified kernel-semantics version is never revised.** Once a profile version fixes the meaning of
D1–D7, that meaning is immutable for that version — a change that could alter any conforming kernel's
`output_payload` (for example, re-baselining `_detmath`, or admitting a new deterministic replacement that shifts
a last bit) MUST ship as a **new profile version** (`ocg-deterministic-compute@<n>`), never as an in-place
edit of an existing one. This is the discipline that lets `execution_hash` be a durable identifier: a receipt
minted under `@1` verifies bit-for-bit forever, because `@1`'s semantics can never move under it. A profile
version bump is additive (a new named profile alongside the old), exactly as §11 profiles compose; it never
mutates the frozen v0.4 envelope and never bumps `chaingraph_version` (stays `"0.4.0"`).

**§24.3 Conformance.** An implementation MAY declare conformance to `ocg-deterministic-compute@1` for its
`gpu:false` live kernel set. The declaration asserts exactly that rows D1–D7 hold — which, because each binds to
a gate already in §15, is **decided by the existing gate suite**: an implementation that is green on §4, §12,
§18.5/§18.6, and §21.4 parity is conforming, and one that is not, is not. The profile therefore adds a **name and
an enumeration**, not a new obligation; it deliberately introduces no §15 row of its own, riding the rows that
already prove D1–D7 (the meta-rule in §15 is satisfied because every requirement above cites an existing wired
gate). This mirrors §18.6, which layers a profile MUST over the class where it is achievable without adding
machinery to the base standard. The AINumbers reference deployment conforms: its `gpu:false` live set is green on
every cited gate.

**§24.4 Prior art (INFORMATIVE).** The enumerate-and-close method is the **W3C WebAssembly 3.0 Deterministic
Profile** (W3C CR, April 2026). The never-revise-a-ratified-version rule is the **RISC-V** frozen-base-ISA policy.
The precedent for proving a *deterministic JS/Wasm-class guest* inside a zkVM is **Cartesi** (a RISC-V zkVM
running a full deterministic guest); OCG differs by proving a single pinned kernel per receipt rather than a whole
machine image, and by carrying the proof as an OPTIONAL §18 attachment rather than a consensus artifact. A deeper
philosophical lineage — a frozen, total, deterministic instruction semantics as the foundation of a permanent
computational record (Nock, and Kelvin versioning counting *down* to a frozen `0`) — is noted only as motivation;
OCG cites the ratified engineering standards above as its normative models, not those systems.

**§24.5 Profile version `ocg-deterministic-compute@2` — WebCrypto subset split (NORMATIVE — new in v0.8.6).** `@1`
left D7 stated at the granularity "environment/platform APIs … substitute a deterministic replacement," which a
literal reader can over-read as banning **all** of WebCrypto — conflating two subsets that D5 and D7 already treat
differently. `@2` is a new profile version (per the §24.2 freeze clause — a new named profile **alongside** `@1`,
**never** an in-place edit of it) that keeps rows D1–D6 unchanged and **enumerates** the WebCrypto split inside D7:

- **ALLOWED — the deterministic subset, classed as fully-specified deterministic replacements under D7:**
  `crypto.subtle.digest` (SHA-256 / SHA-384), `crypto.subtle.importKey`, and `crypto.subtle.verify`. These are
  pure functions of their inputs — a fixed input yields a fixed output on any conformant implementation — so they
  satisfy D7's "used identically on every surface" requirement and MUST be **byte-identical across the browser
  tool, the Cloudflare Worker, and the in-browser QuickJS VM**. They carry no entropy and are not D5 randomness.
  An implementation MAY expose them to `compute`; where a surface cannot (the §18 zkVM guest ships no WebCrypto),
  that surface simply does not host the crypto-using kernels — it does not make the subset nondeterministic.
- **BANNED — the nondeterministic subset, D5 randomness:** `crypto.getRandomValues`, `crypto.subtle.generateKey`,
  and `crypto.subtle.sign` (fresh-key signing draws entropy). Under `@2` these MUST throw inside a conforming
  compute surface; a kernel that reaches for them MUST fail, never silently degrade an `output_payload` (the
  fail-don't-degrade doctrine). This is the same D5 randomness ban already stated for `Math.random`.

`@2` is additive and profile-scoped: it **moves no `execution_hash`** — every kernel's `output_payload` is
byte-identical to its `@1` value (the six previously VM-unrunnable kernels, art-55/124/129/189/190 crypto +
art-201 BigInt, produce the same bytes the Worker already produces), the frozen v0.4 envelope and the §4 preimage
are **UNTOUCHED**, and `chaingraph_version` stays `"0.4.0"`. Only `spec_version` bumps (→ 0.8.6). The AINumbers
reference deployment **re-declares its `gpu:false` live set as `ocg-deterministic-compute@2`-conforming**; receipts
minted under `@1` **verify under `@1` forever** (the freeze clause guarantees `@1`'s semantics never move under
them). Conformance is still decided by the existing §15 gate suite (§24.3) — `@2` adds the VM↔Worker byte-identity
of the deterministic WebCrypto subset to what those gates already check (`vm-parity-gate.mjs`), and no new §15 row.

## §25 Private-Input Profile — `ocg-private-input@1` (NORMATIVE, profile-scoped — new in v0.8.5)
§18.3 already permits a receipt to be used in an input-hiding mode: `policy_parameters` MAY carry a commitment in
place of cleartext, §4 recompute becomes unavailable to third parties, and the receipt is the sole verification
path. That paragraph states the *mode*; it does not pin the *declaration* (which input is private, under which
commitment) or the *commitment construction* — leaving the mode "specified and not yet exercised by a production
node" (white paper §6.4 + the "inputs in the clear at the base" caveat). §25 closes that gap: it names a
profile, `ocg-private-input@1`, that makes input-hiding **machine-declared and machine-checkable** so the three
flagship nodes (sanctions screen ⭐, RBC action-level, capital-ratio) can carry it as a first-class, gated claim.
It adds **no new integrity machinery** — the commitment binds through the §4 preimage and the §18 journal that
already exist. It adds a **declaration** (`private_inputs[]`), a **named hiding commitment scheme**
(`sha256-salted@1`), and a **verifier contract** (`validate_private_inputs`).

**§25.0 Declaration object (NORMATIVE).** An artifact MAY carry a top-level `private_inputs[]` array — a map
telling a verifier which `policy_parameters` locations hold commitments rather than cleartext, and under which
scheme. Like §16 `audit_signature`, §20 `anchor_bindings`, and §23 `input_attestations`, it is **attached and
EXCLUDED from `execution_hash` scope**: adding, removing, or re-ordering it leaves every existing
`execution_hash` byte-identical, and **an artifact with zero `private_inputs` entries is byte-identical to a
plain v0.8.4 artifact and fully conformant.** The binding force does NOT come from this array — it comes from the
commitment sitting inside `policy_parameters` (§25.2). The array is the machine-readable index that says "treat
these pointers as commitments." Each entry:

```json
{
  "pointer": "/input_parameters/<field>",
  "commitment": "sha256:<64-hex>",
  "commitment_scheme": "sha256-salted@1"
}
```

- `pointer` — an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer evaluated **against
  `policy_parameters`** (NOT the whole artifact, exactly as §23), naming WHICH input is private. A verifier MUST
  reject an entry whose `pointer` does not resolve to a value inside `policy_parameters`.
- `commitment` — a `sha256:`-prefixed digest: the hiding commitment to the private value (§25.1).
- `commitment_scheme` — the construction that produced `commitment`; `sha256-salted@1` is the sole scheme defined
  in this profile version. A verifier MUST reject an unknown scheme rather than treat it as opaque.

**§25.1 Commitment scheme `sha256-salted@1` (NORMATIVE — the crux).** A bare `SHA-256(cgCanon(input))` is
**NOT** admissible: for low-entropy inputs — booleans, small integers, a country/list-membership flag, a modest
enumerated set — an attacker precomputes the digest of every possible value and recovers the plaintext by table
lookup, which defeats hiding entirely. The commitment MUST therefore be **salted with a high-entropy secret held
by the prover**:

> `commitment = "sha256:" + hex( SHA-256( salt ‖ cgCanon(input_value) ) )`

where `salt` is a fresh **≥256-bit CSPRNG** value, `cgCanon` is the one canonicalizer of §4
(`kernels/_hash.mjs`), and `‖` is byte concatenation (`salt` bytes, then the UTF-8 bytes of the canonical
encoding of `input_value`). This construction is simultaneously:

- **Hiding** — with a 256-bit secret salt, a dictionary/precomputation attack over even a two-element input space
  is infeasible (the attacker would have to guess the salt; SHA-256 is a suitable commitment randomizer under the
  random-oracle assumption). This is the standard hash-based commitment, not a bare digest.
- **Deterministic given `(input, salt)`** — the same `(input_value, salt)` pair always yields the same
  `commitment`, bit-for-bit, and it is reproducible across every §24 surface because SHA-256 and `cgCanon` are
  already bit-portable there. Two verifiers holding the same `(input, salt)` recompute the same commitment.
- **risc0-private-input-bindable** — the guest reads BOTH `salt` and `input_value` over the zkVM **private-input
  channel** (not committed to the journal), recomputes `commitment` **inside the guest**, and commits the
  `commitment` (never the salt, never the plaintext) to the journal alongside `output_payload` (§25.3). The
  `imageId` therefore pins a program that provably tied *this commitment* to *this output*.

**Salt handling (NORMATIVE).** The `salt`:
1. MUST be freshly generated per `(artifact, private input)` and MUST NOT be reused — a reused salt over the same
   input yields the same commitment, leaking input equality across artifacts.
2. MUST NEVER appear in the artifact: not in `policy_parameters`, not in `output_payload`, not in the §4
   preimage, not in `private_inputs[]`, and not in the §18 `journal`. It is **disclosure material**, held only in
   the prover's private witness and, optionally, in an out-of-band disclosure package delivered to authorized
   verifiers — exactly the treatment §13.12 SD-JWT salts and §24 D5 already give CSPRNG material that is excluded
   from the hash. Because it never enters the artifact, salt exclusion is structural, not a rule a kernel must
   remember to apply.
3. lets an **authorized** verifier who holds `(salt, input_value)` recompute `SHA-256(salt ‖ cgCanon(input_value))`
   and confirm it equals the declared `commitment` — a full re-derivation of the commitment from the plaintext.
   A **public** verifier holds neither and relies solely on the proof (§25.4). Hiding is preserved against the
   public verifier; binding is fully re-checkable by the authorized one.

**§25.2 Plaintext-exclusion invariant (NORMATIVE — the profile's defining MUST).** For every `private_inputs[]`
entry, the value that `pointer` resolves to inside `policy_parameters` **MUST BE the entry's `commitment` string
itself** — the `sha256:`-prefixed digest — and **MUST NOT be the plaintext input value**. The plaintext NEVER
appears anywhere in `policy_parameters` or in any §4 preimage. Consequences that fall out of this one rule:
- the §4 `execution_hash` is computed over `{policy_parameters, output_payload}` in which the private slot holds
  the commitment, so **the hash binds the commitment, not the value**;
- the §18 groth16 `journal` commits that same commitment (§25.3), so **the proof binds the commitment, not the
  value**;
- there is no location, in-preimage or otherwise, from which a third party can recover the plaintext. A verifier
  that finds a pointed value which is not the declared `commitment` MUST FAIL the artifact (either the declaration
  is wrong or a plaintext has leaked into the preimage).

**§25.3 Proving and journal binding (NORMATIVE).** A profile-conforming artifact MUST carry a §18
`audit_signature.compute_proof` (`type:"ZkVmReceipt"`; `receiptFormat:"groth16-bn254"` RECOMMENDED). The guest
program named by `imageId`:
1. reads each private `input_value` and its `salt` over the zkVM private-input channel (never committed);
2. recomputes each `commitment = SHA-256(salt ‖ cgCanon(input_value))` in-guest and **commits every declared
   `commitment` to the journal**;
3. computes `output_payload` from the private inputs (and any public inputs) and **commits `output_payload` to
   the journal** (the existing §18.0 requirement that the journal's committed output equals `output_payload`).

The journal thus exposes only `{ commitments…, output_payload }` — the public result and the public commitments,
never the salt or the plaintext. Proving remains **off-band** (§18.2): the browser tool, the Worker, and CI only
**verify**. This is the risc0 private-input pipeline C1 builds against — the guest reads private witnesses,
emits the commitment, and never leaks it.

**§25.4 Verification — `validate_private_inputs` (NORMATIVE).** A verifier checks, in order, **without ever
seeing the plaintext**:
1. **Structural** — `private_inputs[]` is well-formed; each `pointer` is valid RFC 6901 and resolves into
   `policy_parameters`; each `commitment` matches `^sha256:[0-9a-f]{64}$`; each `commitment_scheme` is known
   (`sha256-salted@1`).
2. **Plaintext-exclusion (§25.2)** — the value at each `pointer` equals that entry's `commitment` string; any
   other value FAILS.
3. **Proof binds commitment** — a §18 `compute_proof` is present; its `journal` commits every declared
   `commitment`; `seal` verifies against `imageId` via the §18.1 self-contained BN254 Groth16 reference verifier;
   `imageId` is present in the node's Graph Index `compute_images`.
4. **Output binding** — `journal`'s committed output equals `output_payload` (§18.0).
5. A **public** verifier stops here: it has confirmed that *some* input, whose salted commitment is the declared
   value, produced this output under the pinned program — hiding intact. An **authorized** verifier additionally
   takes `(salt, input_value)` from the disclosure package, recomputes `SHA-256(salt ‖ cgCanon(input_value))`,
   asserts it equals `commitment`, and MAY re-run the kernel on `input_value` to reproduce `output_payload` —
   full re-verification against the plaintext.

"Commitment well-formed" for a public verifier is exactly steps 1 + 2 + 3: syntactically a `sha256:` digest,
seated in the preimage, and bound by a verifying proof. No step requires the plaintext.

**§25.5 Composition with §23 Input Attestations (NORMATIVE-informative).** Hiding and attesting are **orthogonal
and stack.** A §23 `input_attestation` MAY point at the same `policy_parameters` pointer as a `private_inputs[]`
entry to vouch for the committed input. Because §23 evaluates its digest binding against the **resolved value at
the pointer** — which, under §25.2, IS the commitment — the existing §23 rule already does the right thing
unchanged: the attestation vouches for the commitment (e.g. a `vc-2.0` credential whose subject binds the
`sha256:` commitment, or an `rfc3161-snapshot` whose `messageImprint` is the commitment), so a **public** verifier
confirms "this committed input was vouched for by `<source>`" without seeing the plaintext, while an **authorized**
verifier with the disclosure package re-derives the commitment from `(salt, plaintext)` and thereby ties the
attestation to the cleartext value. §25 needs no change to §23, and §23 needs no change to admit a private input:
one names WHICH input is private and proves the compute over its commitment; the other names WHO vouched for that
same committed input. The claims are independent and composable, as §23.2 already states of the whole ladder.

**§25.6 Frozen-envelope invariance (NORMATIVE).** `private_inputs` is declared as an OPTIONAL top-level artifact
property (exactly as §20 `anchor_bindings` and §23 `input_attestations` were), so `$defs/artifact.required`, the
§4 preimage members, and `chaingraph_version` `0.4.0` are UNTOUCHED. A verifier correct for v0.8.4 computes an
identical `execution_hash` for a v0.8.5 artifact and MAY ignore `private_inputs` entirely. The commitment lives in
`policy_parameters.input_parameters`, an already-open object, so seating a `sha256:` string where a plaintext
would otherwise sit is not a schema or envelope change. Any construction that would require folding salt or
plaintext INTO the preimage is out of profile — the salt is adjacent disclosure material, never an input to the
hash.

**§25.7 Conformance (profile-scoped).** An implementation MAY declare `ocg-private-input@1` for a node whose
sensitive input is committed under this profile. The declaration asserts §25.0–§25.4 hold for that node's
artifacts. Conformance is machine-checked by `validate-private-inputs.test.mjs` (§15): structural shape +
plaintext-exclusion (the pointed value is the commitment, never cleartext) + commitment-scheme validity + the
journal-commits-the-commitment binding, layered on the §18 pairing check that `compute-proof.test.mjs` already
runs. The freeze discipline of §24.2 applies to the commitment construction: `sha256-salted@1`'s meaning is
immutable; a different construction (a Pedersen/Merkle commitment, a different salt width, a different domain
separator) ships as `ocg-private-input@<n>`, never an in-place edit, so a private-input artifact minted under
`@1` re-verifies bit-for-bit forever. Like §18, the profile **defaults OFF**: a node MUST surface to consumers
that it withholds an input (§18.3), and MUST NOT auto-apply commitment mode.

## §HASHRES-1 Ledger hash-resolution contract (NORMATIVE, addressing-scoped — additive, lands as v0.8.7 at the coordinated record bump)
Defines how a §4 `execution_hash` (and any §16/§18-secured artifact addressed by it) is **dereferenced** at
`ledger.ainumbers.co/<execution_hash>`. This is an addressing contract over content the standard already
mints; it introduces **no new schema, no envelope change, and no new `execution_hash`** — the address IS the
existing hash.

**§HASHRES-1.0 Intrinsic-identifier framing (NORMATIVE).** Following **RFC 6920** (Naming Things with
Hashes), a dereference of `<execution_hash>` **MUST** return content whose recomputed §4 hash equals
`<execution_hash>` exactly, or **MUST** return **404** — the address **MUST NOT** resolve to a different
value than the one it names. The hash is a **location-independent intrinsic identifier** in the sense of
**ISO/IEC 18670 (SWHID)**: the hash is the name, so any mirror serving matching content is an equally valid
resolver and no resolver can substitute a different artifact under the same address without detection. This is
the §4 re-verifiability property (recompute then match) lifted to an addressing surface; the same
`kernels/_hash.mjs` `cgCanon` canonicalization applies, and the array-replacer forms FORBIDDEN by §4 stay
forbidden here.

**§HASHRES-1.1 Transparency-service alignment (informative).** OCG receipts map cleanly onto the **IETF SCITT**
model: an OCG receipt is like a signed statement, the Ledger like a transparency service, a §16/§18 proof like
the securing signature. When the SCITT receipt format (COSE) is finalized, the Ledger is positioned to emit
SCITT/COSE transparency receipts alongside its native OCG artifacts; this is a **forward-looking alignment
note, not an obligation to implement now**. (Design footnote, muse-not-citation: the hash-as-address,
resolver-returns-matching-content-or-nothing shape mirrors Urbit's scry namespace read; OCG owes it nothing
but the resemblance is noted.)

**§HASHRES-1.2 Scope (NORMATIVE).** §HASHRES-1 is normative **for the addressing/resolution contract only**.
It adds no field to any artifact, does not appear in the §4 preimage, and leaves `chaingraph_version` at
`"0.4.0"`. A deployment that serves no Ledger is fully conformant; a deployment that does serve one at the
`<hash>` address MUST honor the return-matching-content-or-404 rule above.

## §PQC-1 Post-quantum hybrid proofs (NORMATIVE, OPTIONAL — extends §16; additive, lands as v0.8.7 at the coordinated record bump)
Extends **§16 whole-artifact signing** to permit a **hybrid dual signature**: two W3C Data Integrity proofs
over the **same RFC 8785 (JCS) secured-document bytes** — the existing `eddsa-jcs-2022` proof (classical) plus
a **post-quantum ML-DSA** cryptosuite proof — so an artifact stays verifiable across the classical to PQ
transition. This SUPERSEDES and retires the previously-parked PQC-COSE detour (a COSE-envelope second signing
path): the second proof rides the **existing §16 Data Integrity pipeline and the §16.5 proof-array**, not a new
envelope.

**§PQC-1.0 Shape (NORMATIVE).** A hybrid signer uses the §16.5 **parallel proof set**: `audit_signature.proof`
is an array carrying (a) the `eddsa-jcs-2022` proof and (b) an ML-DSA-cryptosuite proof, **both over the same
§16.1 secured document** (the full artifact with `audit_signature.proof` removed, JCS-canonicalized by the
same `_hash.mjs` `cgCanon`). This is a **near-zero schema change** — the proof array is already permitted by
§16.5 — and **MUST NOT** mint a new `execution_hash` or move `chaingraph_version` (stays `"0.4.0"`).

**§PQC-1.1 Cryptosuite identifier (NORMATIVE, deferred binding).** The concrete ML-DSA cryptosuite id is
**TBD-on-registration**: an implementation **MUST** use the **W3C Data Integrity WG ML-DSA cryptosuite
identifier once registered**, and **MUST NOT** hardcode a provisional string (in particular the placeholder
`mldsa44-jcs-2026` is illustrative only and **MUST NOT** be emitted as if standardized). Until the WG id
registers, PQC-1 is a **reserved extension point**: the classical `eddsa-jcs-2022` proof alone remains fully
§16-conformant.

**§PQC-1.2 Verifier policy modes (NORMATIVE).** A verifier declares one of three policies over a hybrid
proof set: **`classical`** (require the `eddsa-jcs-2022` proof to verify), **`pq`** (require the ML-DSA proof
to verify), or **`both`** (require both). Each proof is verified independently under §16.1/§16.5 dependency
order; a policy is satisfied iff its required proof(s) verify. The §16.2 privacy caveat applies unchanged: a
hybrid proof still de-anonymizes the signer and MUST default OFF.

## §REVOKE-1 Receipt and key revocation (NORMATIVE, OPTIONAL — additive, lands as v0.8.7 at the coordinated record bump)
Adds an OPTIONAL way for a receipt or a signing key to advertise **revocation status** via the **W3C
BitstringStatusList** mechanism, so a verifier can learn that a previously-valid §16 key or a superseded
receipt has been revoked without contacting the signer out-of-band.

**§REVOKE-1.0 Home + reference (NORMATIVE).** A status reference lives under `audit_signature` (which tolerates
added properties, keeping the frozen v0.4 root schema — a receipt without it is byte-identical and fully
conformant) as a `credentialStatus`-shaped object per **W3C BitstringStatusList**: a `statusListCredential`
URL, a `statusListIndex`, and `type:"BitstringStatusListEntry"`. It is **hash-excluded** — it does **not**
enter the §4 preimage and does **not** move `chaingraph_version` (stays `"0.4.0"`). The published
BitstringStatusList credential is itself a §16-securable artifact.

**§REVOKE-1.1 Semantics (NORMATIVE).** To check revocation a verifier dereferences `statusListCredential`,
expands the bitstring, and reads the bit at `statusListIndex`: set means **revoked**. A receipt referencing a
revoked key or index MUST be treated as **unverified for the revoked purpose** even if its §16 signature is
cryptographically valid — revocation overrides signature validity. The three published BitstringStatusList
SDK test vectors are **reference only** (a verifier MUST NOT vendor them as a code path). Absence of a status
reference means "no revocation signal published," not "known-good."

## §SIDECAR Small conformance riders (informative + reserved invariants — additive, lands as v0.8.7 at the coordinated record bump)
Four small riders that clarify existing machinery without adding a new machine-checked obligation.

**§SIDECAR.0 Identity Sidecar pattern (informative).** In every OCG signing path the **LLM never touches the
private key**: an agent decides what to sign, but a **deterministic gate** (`_proof.mjs` in the browser, the
KMS/HSM-backed §12 compute path on the server) performs the actual signature. The key material and the signing
act are isolated in a deterministic sidecar beside the non-deterministic reasoner — which is why a §16 proof
attests the artifact, not the model run.

**§SIDECAR.1 Tiered conformance labels (informative, atop §15).** Three human-readable capability labels group
the §15 gates by what a verifier can do with an artifact, from weakest to strongest guarantee:
**`OCG-Verify`** — the §1/§4 gates hold (envelope well-formed, `execution_hash` recomputes); **`OCG-Execute`** —
additionally the §21 chain-execution + §22 mandate gates hold (a chain/mandate ran under its declared gates);
**`OCG-Prove`** — additionally a §18 compute-integrity proof verifies (correct execution proven without
re-execution). The labels are a naming atop the existing gate suite; they add **no new gate** and no normative
MUST beyond the gates they group.

**§SIDECAR.2 Resource-narrowing invariant (NORMATIVE, reserved for future multi-hop mandates).** When
delegated / multi-hop mandates are introduced (not shipped in this pass), a delegated mandate **MUST only
narrow, never broaden**, the resource scope it received: the child mandate's resource set MUST be a subset of
the parent's. This is stated now as the binding design invariant for that future work; §22 single-hop mandates
are unaffected.

**§SIDECAR.3 Prior art & acknowledgements (informative).** The §HASHRES-1 / §PQC-1 / §REVOKE-1 designs draw on
the **Vouch Protocol** (github.com/vouch-protocol/vouch, R. Gaddam; Apache-2.0) as design prior art,
acknowledged for the hash-addressing, hybrid-signing, and revocation-status patterns. Vouch is a **design
reference only, never a runtime dependency or vendored code path**. This joins the standard's existing citation
set: the W3C WebAssembly 3.0 Deterministic Profile (§24), the RISC-V freeze discipline (§24.2), RFC 9162
(Certificate Transparency), and KERI/vLEI (ISO 17442-3) where applicable.

## §14 Changelog
See `standard/CHANGELOG.md`. **v0.8.7 (2026-07-10 — the record `spec_version` bump landed at a coordinated
cross-surface step folded into the GD-1 reserve-disclosure-checker landing, so it did not collide with the
in-flight `chaingraph.json` single-writer build):** additive ML landing-pass riders — §HASHRES-1 (RFC 6920 / ISO 18670 SWHID Ledger hash-resolution
addressing contract; informative SCITT alignment), §PQC-1 (hybrid dual §16 Data Integrity proof over the same
JCS bytes = `eddsa-jcs-2022` + a TBD-on-registration ML-DSA cryptosuite, verifier policy modes classical/pq/both;
retires the parked PQC-COSE detour), §REVOKE-1 (OPTIONAL W3C BitstringStatusList receipt/key revocation reference
under `audit_signature`), and §SIDECAR small riders (Identity Sidecar pattern, tiered `OCG-Verify`/`OCG-Execute`/
`OCG-Prove` labels atop §15, the reserved resource-narrowing invariant for future multi-hop mandates, and the
Vouch Protocol prior-art acknowledgement). All additive: no envelope/hash/schema change, `chaingraph_version`
stays `0.4.0`, every existing `execution_hash` is byte-identical, and each new normative MUST binds to an
existing §15 gate. v0.8.6 = Deterministic Compute Profile `@2` (§24.5: a new profile version
`ocg-deterministic-compute@2` — a new named profile ALONGSIDE `@1` per the §24.2 freeze clause, never an in-place
edit — that keeps D1–D6 unchanged and ENUMERATES the WebCrypto split inside D7: ALLOWED as fully-specified
deterministic replacements = `crypto.subtle.digest` (SHA-256/384), `importKey`, `verify`, which MUST be
byte-identical across browser / Worker / QuickJS VM; BANNED as D5 randomness = `crypto.getRandomValues`,
`generateKey`, `sign` (fresh key), which MUST throw. Additive and profile-scoped: moves NO `execution_hash` — all
six previously-VM-unrunnable kernels (art-55/124/129/189/190 crypto + art-201 BigInt) emit the SAME bytes the
Worker already produces — the frozen v0.4 envelope and §4 preimage are UNTOUCHED, `chaingraph_version` stays
`0.4.0`, only `spec_version` bumps to 0.8.6. The reference deployment re-declares its `gpu:false` live set as
`@2`-conforming; `@1` receipts verify under `@1` forever). v0.8.5 = Private-Input Profile (§25: the NORMATIVE, profile-scoped
`ocg-private-input@1` — the machine-declared, machine-checked form of the §18.3 input-hiding mode. Adds the
OPTIONAL hash-excluded top-level `private_inputs[]` declaration (each entry = an RFC 6901 pointer into
`policy_parameters` + a hiding `commitment` + `commitment_scheme`), the `sha256-salted@1` commitment
`SHA-256(salt ‖ cgCanon(input))` with a ≥256-bit prover-held salt that is HIDING, DETERMINISTIC given
`(input,salt)`, and risc0-private-input-bindable, the plaintext-exclusion invariant — the pointed
`policy_parameters` value IS the commitment and the plaintext never enters any preimage, so the §4 `execution_hash`
and the §18 groth16 journal bind the commitment not the value — and the `validate_private_inputs` verifier that
checks {proof binds commitment} + {journal.output == output_payload} + {commitment well-formed} without the
plaintext, with an authorized-verifier path that re-derives the commitment from `(salt, input)`. §23 composition is
orthogonal (an attestation vouches for the committed input; hiding and attesting stack). Salt is disclosure
material EXCLUDED from the hash, exactly as §13.12/§24 D5 CSPRNG salts. Additive and profile-scoped: no envelope or
hash change — `$defs/artifact.required`, the §4 preimage, and `chaingraph_version` `0.4.0` are UNTOUCHED, a
zero-private-input artifact is byte-identical and fully conformant, and only `spec_version` bumps to 0.8.5). v0.8.4 = Deterministic Compute Profile (§24: the NORMATIVE, profile-scoped
`ocg-deterministic-compute@1` — a NAMING of the determinism §4/§12/§17/§18.5/§18.6/§21.4 already enforce, modeled
on the W3C WebAssembly 3.0 Deterministic Profile with a RISC-V-style freeze clause. It enumerates the seven kernel
nondeterminism sources D1–D7 — non-finite floats, iteration order, transcendental math, wall-clock time,
randomness, locale/`Intl`, environment/platform APIs — and binds each to the EXISTING §15 gate that already fixes
or bans it. It adds NO new machinery, NO §15 row, and NO obligation beyond what a §15-green implementation already
meets; it introduces no envelope or hash change, so `chaingraph_version` stays `0.4.0` and every existing
`execution_hash` is byte-identical. Only `spec_version` bumps to 0.8.4). v0.8.3 = Input Attestations (§23: the OPTIONAL hash-excluded top-level
`input_attestations[]` array — per-entry RFC 6901 pointer into `policy_parameters`, `vc-2.0` /
`c2pa-manifest` / `rfc3161-snapshot` verifiable now via shipped §16/§13.11/§20 machinery, `zktls` defined
with EXTERNAL verification per D2; zero attestations stays fully conformant; envelope + `chaingraph_version`
0.4.0 UNTOUCHED) over v0.8.2 (additive; no envelope/hash change — every existing `execution_hash` is
byte-identical, `input_attestations` is a new optional property alongside `anchor_bindings`). v0.8.2 = Escalation records (§22.8: the `"escalate"` evaluator semantics — a
terminal routing target beside `"end"`, classified by the single-source `isTerminalTarget` /
`isEscalationTarget` exports with the decision record UNCHANGED; the `skipped_by_escalation` runtime halt
contract; the open escalation record with its deterministic, wall-clock-excluded record hash; and the
countersigned closure contract via Anchorproof) over v0.8.1 (additive; no envelope/hash change — every
existing gate decision and composite `execution_hash` is byte-identical, `chaingraph_version` stays `0.4.0`,
the escalation record + closure are runtime artifacts, and `opened_at` is hash-excluded). v0.8.1 = Work Mandates (§22: the Work Mandate document format, the
`compile_work_mandate` mandate→gated-chain I/O contract, the reserved `"escalate"` routing target name, and
the run_chain mandate-binding contract) over v0.8.0 (additive; no envelope/hash change — `mandate_type:"work_mandate"`
is an accepted value of the existing open `mandate_type` string, the mandate document is a separate
`workMandateDocument` schema `$def`, `mandate_hash` is a conditional-presence runtime key, and
`chaingraph_version` stays `0.4.0`; escalation *execution* is reserved, not shipped). v0.8.0 = Chain Execution (§21: the shipped linear `run_chain` contract made
normative, plus forward-only decision gates with conditional-presence hash binding) + §20.1
`merkle_inclusion` (batch anchoring: exec_hash-as-leaf, root-as-anchor) over v0.7.0 (additive; no
envelope/hash change — every linear chain's `composite_execution_hash` is frozen, gate metadata is
conditional-presence; schema change is limited to the catalog `spec_version` pattern + optional
`id`/`gate` on chain steps + optional `merkle_inclusion` on two anchor types; `chaingraph_version` stays
`0.4.0`). v0.7.0 = Anchor Binding (§20) + selective-disclosure export (§13.12) +
proof sets/endorsement chains (§16.5) + optional `supersedes` (§1) over v0.6.1 (additive; no
envelope/hash/schema change). v0.6.1 = §18.6 deterministic-node proof profile (`ocg-p18-deterministic`) over
v0.6.0 (additive, profile-scoped; no envelope/hash/schema change). v0.6.0 = Kernel Identity Binding (§17) +
Compute-Integrity Proof (§18, zkVM, software-only) over v0.5.0. v0.5.0 = Proof Binding (§16) over v0.4.1.
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
| §4 canonical execution_hash | `kernel-hash-integrity.mjs`, `lint-forbidden-hash.mjs`, `golden-parity.test.mjs`, `determinism-replay.test.mjs` (N=3 idempotency + JCS key-order stability) | validate |
| §12 every gpu:false node has a kernel (no silent skip) | `kernel-coverage.mjs --strict` | validate |
| §4 buildArtifact reproduces hash offline | `kernel-contract.test.mjs` | validate |
| §4 **live** re-verifiability of every deployed node | **`hash-sweep.mjs`** | post-deploy |
| Live server registers every expected mcp_name | **`verify-mcp-registered.mjs`** (Addendum A) | post-deploy |
| §1 envelope + node object well-formed | **`schema-validate.mjs`** (this schema) | validate |
| single version of record across surfaces | **`spec-version-consistency.mjs`** | validate |
| rendered spec page (openchain-graph-spec.html) section + TOC parity with SPEC.md §s | **`spec-page-parity.mjs`** | validate |
| every surface count == chaingraph.json (Resources/Tools/Prompts) | **`surface-parity.mjs`** (Addendum A) | validate |
| every node `url` page + chain page exists (no orphans) | `catalog-parity.mjs` | validate |
| unique mcp_name (nodes+pilot+utility) | `check-tool-names.mjs` | validate |
| chain integrity | `validate-chains.mjs` | validate |
| /mcp handshake works | `smoke-mcp.mjs` | post-deploy |
| §13 export gate honored (incl. §13.11 `vc`: view-only, no new hash/proof, deterministic, base-profile) | `exporters/export.test.mjs` (unit) + `smoke-compute.mjs` (export round-trip) | validate + post-deploy |
| §16 proof: eddsa-jcs-2022 whole-artifact at `audit_signature.proof`, no new hash, no `chaingraph_version` bump, deterministic, offline-verifiable, default-off | `proof-binding.test.mjs` (unit: sign→verify round-trip + tamper-detect + determinism + backward-compat) | validate |
| §17 kernel identity binding: digest at `audit_signature.build_identity` ↔ Graph Index `compute_images` ↔ recomputed source, hash-excluded, no `chaingraph_version` bump | `kernel-identity.test.mjs` (unit: digest determinism + three-way cross-check + tamper-detect + backward-compat) | validate |
| §18 compute-integrity proof: object structure, `imageId` ↔ Graph Index `compute_images`, journal ↔ `output_payload`, no new hash, version stays 0.4.0, default-off; PLUS the shipped self-contained BN254 Groth16 verifier accepts a real receipt fixture and rejects a tampered seal / wrong journal (stark stays vendor-delegated per §18.1) | `compute-proof.test.mjs` (unit: binding + real-receipt verify + tamper-detect + backward-compat) | validate |
| §20 anchor binding: per-type proof verification (`rfc3161-tst` real TST vs pinned TSA root incl. messageImprint/CMS/chain/EKU/genTime, `opentimestamps` completed proof vs pinned Bitcoin block header, `c2sp-tlog-proof-v1` vs pinned test log key + cosigners + Merkle inclusion, `scitt-receipt-rfc9942` COSE receipt), `anchored_hash` == recomputed `execution_hash`, tampered proof / mismatched hash MUST fail, outside hash scope | `anchor-binding.test.mjs` | validate |
| §13.12 SD-JWT export: redact→verify round-trip with disclosures, digest mismatch fails, always-disclosed set complete (no input leaks into always-disclosed, no output becomes redactable), fresh CSPRNG salts the only nondeterminism, JWS EdDSA under the §16 key | `sd-export-roundtrip.test.mjs` | validate |
| §16.5 proof sets/chains: parallel proof set verifies, endorsement `previousProof` chain verifies in dependency order, broken `previousProof` MUST fail | `proof-binding.test.mjs` | validate |
| §1 `supersedes` shape: array of `sha256:`-prefixed execution_hashes | `schema-validate.mjs` | validate |
| §21.1–§21.3 linear composite contract: NO existing linear chain's `composite_execution_hash` moves (golden freeze over ≥10 chains, captured pre-change) | `linear-hash-freeze.mjs` | validate |
| §21.4 gate static validity: RFC 6901 pointer syntax, closed op enum + value typing, `default` present, all targets resolve + FORWARD-ONLY, unique step ids, no unreachable step | `validate-chains.mjs` (Layer 4) + `gate-static.test.mjs` | validate |
| §21.4 evaluator semantics: each op × type mismatch × first-match × mandatory default, determinism, decision recomputable + tamper-detect | `gate-semantics.test.mjs` | validate |
| §21.4 both-branch coverage: a gated chain's fixtures drive every branch (each rule + default) ≥1; a single-branch set is flagged | `gate-branch-coverage.test.mjs` | validate |
| §21.4 evaluator byte-parity: Worker `run_chain` and embedded `runChain` yield identical route + decisions + `composite_execution_hash` for gated chains | `gate-parity.test.mjs` | validate |
| §20.1 `merkle_inclusion`: reconstruct RFC 6962 root from leaf+path, root == `anchored_hash`, leaf == recomputed `execution_hash`, tampered path / wrong leaf / wrong root MUST fail, outside hash scope | `anchor-binding.test.mjs` | validate |
| §22 Work Mandate document: separate `workMandateDocument` `$def` present + well-formed; `mandate_type:"work_mandate"` accepted in the existing open envelope string; frozen `$defs/artifact` + `chaingraph_version` 0.4.0 UNCHANGED | `schema-validate.mjs` | validate |
| §22.4 `compile_work_mandate` determinism: same mandate → byte-identical `chain_config` (hash-stable); conditions → continue rules, escalation_triggers → `"escalate"` rules, single pointer per gate, mandatory `default:"escalate"`; multi-pointer step rejected | `compile-mandate-determinism.test.mjs` | validate |
| §22.3 `"escalate"` reserved target: static validation accepts `"escalate"` as a reserved forward target (not an unresolved step id); `"end"` still terminal | `validate-chains.mjs` | validate |
| §22.2 mandate signature: `eddsa-jcs-2022` whole-artifact proof REQUIRED; an unsigned mandate is a draft and is runtime-rejected | `proof-binding.test.mjs`, `mandate-binding.test.mjs` | validate |
| §22.5 run_chain mandate binding: no-mandate run hash-identical to pre-mandate (conditional-presence `mandate_hash`); with-mandate folds `mandate_hash` into every step `policy_parameters` + `composite_policy` (with/without → different, each stable); expired/unsigned/bad-signature/out-of-scope → structured rejection | `mandate-binding.test.mjs`, `linear-hash-freeze.mjs` | validate |
| §22.8 `"escalate"` evaluator: recognized as a terminal target (`isTerminalTarget`/`isEscalationTarget`); `evaluateGate` decision record for an escalate route is byte-identical to a non-escalating gate (NO escalation field), so existing gate decisions + composite hashes are unchanged; classifiers byte-parity across the 4 executing surfaces | `gate-parity.test.mjs`, `linear-hash-freeze.mjs` | validate |
| §23 input attestations: hash-excluded top-level `input_attestations[]` (zero-attestation artifact hash-identical + fully conformant); each entry's RFC 6901 `pointer` resolves into `policy_parameters`; `vc-2.0` verifies via §16/§13.11 Data Integrity + subject-digest == input digest, `rfc3161-snapshot` via the §20 `rfc3161-tst` verifier (messageImprint == input digest, no second RFC 3161 impl), `c2pa-manifest` structural + hard-binding digest match; `zktls` structural-only (`verifiable:"external"`, no vendored verifier); tampered proof / unresolved pointer / digest mismatch MUST fail; verdict reported per-input alongside `execution_hash`; `$defs/artifact.required` + `chaingraph_version` 0.4.0 UNCHANGED | `validate-input-attestations.test.mjs`, `schema-validate.mjs` | validate |
| §25 private-input profile: hash-excluded top-level `private_inputs[]` (zero-entry artifact hash-identical + fully conformant); each entry's RFC 6901 `pointer` resolves into `policy_parameters`; the pointed value IS the `sha256:` `commitment`, never plaintext (plaintext-exclusion §25.2); `commitment_scheme` ∈ {`sha256-salted@1`}; a §18 `compute_proof` is present and its `journal` commits every declared `commitment` AND `output_payload`; unknown scheme / unresolved pointer / plaintext-at-pointer / missing commitment-in-journal MUST fail; salt never appears in the artifact; verdict reported without the plaintext; `$defs/artifact.required` + `chaingraph_version` 0.4.0 UNCHANGED (§18 pairing check stays with `compute-proof.test.mjs`) | `validate-private-inputs.test.mjs`, `schema-validate.mjs` | validate |
| §HASHRES-1 Ledger addressing: the resolution address IS the §4 `execution_hash` (no new hash, no envelope change, `chaingraph_version` 0.4.0 UNCHANGED); a dereference returns content whose recomputed §4 hash equals the address or 404, never a different value — the same live re-verifiability the §4 sweep already asserts over deployed artifacts | `hash-sweep.mjs`, `kernel-hash-integrity.mjs` | post-deploy + validate |
| §PQC-1 hybrid dual proof: a §16.5 parallel proof set may carry `eddsa-jcs-2022` + a PQ suite over the SAME §16.1 secured document; each proof verifies independently in dependency order (verifier policy classical/pq/both); no new `execution_hash`, `chaingraph_version` stays 0.4.0; the ML-DSA cryptosuite id is TBD-on-registration and MUST NOT be hardcoded (asserted only as a reserved extension point, so the classical proof alone stays conformant) | `proof-binding.test.mjs` | validate |
| §REVOKE-1 revocation reference: OPTIONAL W3C BitstringStatusList `credentialStatus` object under `audit_signature` (tolerated added property), hash-excluded — a receipt without it is byte-identical and fully conformant; `chaingraph_version` 0.4.0 UNCHANGED; frozen v0.4 root schema still validates | `schema-validate.mjs` | validate |
| §SIDECAR.2 resource-narrowing invariant (reserved): a future delegated mandate's resource set MUST be a subset of its parent's — stated now, unenforced until multi-hop mandates ship; §22 single-hop mandate gates UNCHANGED | `mandate-binding.test.mjs` | validate |
| every rule above has a gate (meta) | `spec-gate-coverage.mjs` | validate |

**Meta-rule:** a PR that adds a normative MUST to this file without a referenced gate in this table
fails `spec-gate-coverage.mjs`.
