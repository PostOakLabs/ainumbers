# OpenChainGraph → SCITT Mapping

**Status: INFORMATIVE.** This document is not part of the OpenChainGraph (OCG) v0.4 normative
specification. It does not define new vocabulary, does not change `execution_hash`, and conformance
with OCG v0.4 does not depend on anything below. The normative text this document explains lives in
[`SPEC.md`](SPEC.md) — primarily §4 (hash), §16 (proof), §18 (compute-proof), §20 (anchor binding),
and the §XMAP-1 annex, which already carries a one-row SCITT column this document expands into a
full field-by-field mapping with a worked example.

**Boundary (read first).** This document is a **repo-side mapping only**. It does not submit anything
to the IETF, and it is not an Internet-Draft. Authoring an OCG-originated SCITT Internet-Draft is a
separately queued, Tim-gated program (`MERKLE-PROGRAM`'s SCITT-1 row, behind the IETF 127 submission
gate) — this document does not touch that lane and names no I-D text of its own.

**Pinned primary texts (re-pinned to the published RFCs 2026-09-03, `SCITT-MAPPING-REFRESH-1`).**
Every SCITT-side claim below cites a section of one of these two texts, retrieved
2026-09-03 from rfc-editor.org as plain text (snapshot copies with sha256 at
`research/clause-snapshots/` in the build workspace):

- **RFC 9943** — *An Architecture for Trustworthy and Transparent Digital Supply Chains* (SCITT
  architecture), Standards Track, **Proposed Standard**, June 2026.
  `rfc9943.txt` sha256 `204aea020731e1306e8ffe0aaae5c9559a7a8edf24bd089ae79d6a6d6c7676f1`.
- **RFC 9942** — *CBOR Object Signing and Encryption (COSE) Receipts*, Standards Track,
  **Proposed Standard**, June 2026.
  `rfc9942.txt` sha256 `da8ed24ef2d757ece900decf34a003a7b02679a16f4c1f25670ea59435372da0`.

SCITT graduated from Internet-Drafts to these two RFCs in June 2026; this refresh supersedes the
draft-era pinning and the earlier 2026-08-05 publication check (`PROV-SCITT-1`). Where this document
previously described concepts in draft terms, the published section numbers below are now the
citation of record. **SCRAPI** (the SCITT Reference API) is still a draft and is cited as
`draft-ietf-scitt-scrapi-11` — see §4, the informative queue-stage note.

## 1. What SCITT is, in OCG's terms

SCITT is a **registration/transparency-log model**: an Issuer signs a **Signed Statement** and
submits it to a **Transparency Service (TS)**, which applies its Registration Policy, appends the
statement to a Verifiable Data Structure (VDS), and returns a **Receipt** proving the statement's
inclusion (RFC 9943 §1: "Once the signed statement is registered, the TS issues a receipt";
§3 *Registration*). RFC 9943 §1 pins the encoding: "The signed statements and receipts are,
respectively, based on the COSE_Sign1 specification in Section 4.2 of RFC 9052 [STD96] and on COSE
receipts [RFC9942]." This is architecturally different from an OCG artifact, which is a
**self-contained, offline-verifiable document** — nothing about an OCG artifact's validity depends
on a third-party service being reachable. (SCITT Receipts share that offline property once issued —
RFC 9943 §4: "It is universally verifiable without online access to the TS" — but obtaining one
requires the service.) The mapping below is therefore a mapping of **roles and equivalents**, not a
claim that OCG artifacts and SCITT statements are interchangeable byte-for-byte.

| SCITT concept (pinned) | OCG equivalent |
|---|---|
| Signed Statement — RFC 9943 §3: "an identifiable and non-repudiable Statement about an Artifact signed by an Issuer"; §6: "Signed Statements produced by Issuers must be COSE_Sign1 messages" (CDDL at §6.1 Figure 3) | OCG artifact's §16 `audit_signature` (`eddsa-jcs-2022` proof over the JCS-canonical artifact) |
| Issuer — RFC 9943 §3 (*Issuer*); identity rides the `iss` CWT claim inside COSE header parameter 15 (CWT Claims, RFC 9597 §2), REQUIRED per §6 | The §9 `did:key` / LEI identity that signs the artifact |
| Transparency Service — RFC 9943 §3 (*Transparency Service*: "an entity that maintains and extends the VDS and endorses its state"); §5.1: "TSs MUST produce COSE Receipts [RFC9942]"; VDS requirements at §5.1.3 | No OCG equivalent by design (§0 SURVIVES-THE-MAINTAINER — OCG artifacts verify offline; a service dependency is the thing OCG avoids) |
| Receipt — RFC 9943 §3 (*Receipt*: "a COSE Single Signer Data Object as defined in [RFC9942] … Receipt Profiles implemented by a TS MUST support inclusion proofs and MAY support other Proof Types"); structure per RFC 9942 §3, §4.3, §5.2.1 | §20 `anchor_bindings[]` entry, `type: "scitt-receipt-rfc9942"` (or `c2sp-tlog-proof-v1` / `rfc3161-tst` / `opentimestamps` for OCG's other three anchor types) |
| Transparent Statement — RFC 9943 §3 (*Transparent Statement*: "a Signed Statement that is augmented with a Receipt … The Receipt is stored in the unprotected header of COSE Envelope of the Signed Statement"); §7 + Figures 7–8 (unprotected-header label 394 `receipts`) | The closest published analogue of an OCG artifact carrying §20 `anchor_bindings[]`: a signed statement that travels **with** its inclusion evidence. Asymmetry, stated plainly: OCG attaches anchors at a top-level JSON array outside the hash preimage, not inside a COSE unprotected header, and OCG's anchor set is heterogeneous (RFC 3161 / OTS / C2SP / SCITT) where a Transparent Statement carries COSE Receipts only |
| Registration Policy — RFC 9943 §3 (*Registration Policy*); §5.1.1: "To enable auditability, TSs MUST maintain Registration Policies"; mandatory checks at §5.1.1.1 | No OCG equivalent — OCG has no registration-time policy gate; §27 human-accountability gates are a separate, artifact-level construct |
| Audit trail of audit trails — **OCG's own §27 framing, not published RFC 9943 vocabulary** (the phrase "statement about a statement" appears nowhere in the published text) | §27 approval records (`subject_hash` referencing another artifact's `execution_hash`) — SPEC.md §27.2 names this pattern "SCITT-style" as a design homage. The published recursions that actually support the idea: RFC 9943 §5.1.1.1 ("Registration Policies and trust anchors MUST be made Transparent … by Registering them as Signed Statements on the VDS") and §6 ("A Receipt is a Signed Statement (COSE_Sign1) with additional Claims in its protected header related to verifying the inclusion proof in its unprotected header") |

## 2. Field-by-field: OCG envelope → SCITT Signed Statement

An OCG artifact is not signed *as* a SCITT statement — no OCG artifact is submitted to a transparency
service today. `repo/scripts/export-scitt.mjs` (shipped by `PROV-SCITT-1`) is the interop path: it
takes an already-sealed OCG artifact and produces a COSE_Sign1 Signed Statement an implementer holding
one format can map to the other.

| OCG member | SCITT Signed Statement placement (pinned) | Notes |
|---|---|---|
| `execution_hash` | Detached-payload claim `execution_hash` (JSON, inside the Signed Statement's payload) | The exporter does not put the whole OCG artifact in the SCITT payload — only enough to identify it (§2.1 below). RFC 9943 §3 (*Statement*) leaves the payload issuer-chosen and "considered opaque to TS", and §6.2 explicitly permits a Statement "made over the hash of a payload rather than the full payload bytes" — there is no fixed "input hash" field the way §XMAP-1's other three formats each have one. |
| `tool_id` | Claim `tool_id` | Identifies the producer, analogous to §20's `log_origin` but on the statement side, not the receipt side. |
| `chaingraph_version` | Claim `chaingraph_version` | Carried for a verifier to know which schema/version the referenced `execution_hash` was computed under. |
| `generated_at` | Claim `generated_at` | Not itself part of the §4 hash preimage — informative only, same status it has inside the OCG artifact. |
| §9 identity (`did:key` / LEI) | COSE protected header, label 15 (`CWT Claims`, RFC 9597 §2), CWT claim 1 (`iss`) | RFC 9943 §6 makes label 15 with **both** `iss` (claim 1) **and** `sub` (claim 2) a MUST for Signed Statements and Receipts. The exporter carries `iss` only (see the worked example's decoded header, §5.1), so its output is an interop pointer in the SCITT *shape*, not a statement that would pass a conforming TS's §5.1.1.1 mandatory checks unamended — a registration-ready statement would need a `sub` naming the artifact. Same row already recorded in `SPEC.md` §XMAP-1's "party identity" line; this document does not change that mapping, only demonstrates it with a real statement below. |
| §16 `audit_signature` proof suite (`eddsa-jcs-2022`) | COSE_Sign1 signature algorithm, protected header label 1 (`alg`, REQUIRED for receipts per RFC 9942 §5.2.1) | The exporter supports `ES256` (`alg: -7`) and `EdDSA` (`alg: -8`) — both interoperate with §16's Ed25519-over-JCS proof in the sense that the *key type* is shared for the EdDSA case; the *signature scope* differs (COSE signs the CBOR `Sig_structure`; §16 signs the JCS-canonical artifact) so a verifier written for one does not accept the other's bytes directly. This is the same proof-suite-delta discipline `SPEC.md` §XMAP-1 already applies to the `agent-receipts` VC column. |

**§2.1 Why the payload is detached and minimal.** A SCITT Signed Statement's payload is
issuer-chosen — RFC 9943 §3 (*Statement*) treats it as opaque to the TS, and §6.2 addresses exactly
the large-or-sensitive case: "Statement payloads might be too large or too sensitive to be sent to a
remote TS. In these cases, a Statement can be made over the hash of a payload rather than the full
payload bytes." Detached payloads are also first-class in the published text: the §6.1 Signed
Statement example (Figure 4) carries `nil` as its payload with the note "Detached payloads support
large Statements and ensure Signed Statements can integrate with existing storage systems."
`export-scitt.mjs` signs a four-field claim set (`execution_hash`, `tool_id`, `chaingraph_version`,
`generated_at`) in **detached-payload mode**: the COSE_Sign1 envelope's payload field carries `null`,
and the claim bytes travel alongside as a separate file. A verifier who trusts `execution_hash`
alone can already recompute and check the full OCG artifact through the existing §4 hash path — the
SCITT statement adds an externally-verifiable *signed pointer* to that hash, not a duplicate of the
artifact.

## 3. Field-by-field: OCG receipt/anchor → SCITT Receipt

This direction is already normative — `SPEC.md` §20 lists `scitt-receipt-rfc9942` as one of four
`anchor_bindings[]` types an OCG artifact MAY carry. This section explains what that type's fields mean
in SCITT terms; it adds no new field and changes no §20 text.

**The published receipt shape (RFC 9942).** A COSE Receipt is "a COSE Single Signer Data Object …
containing the header parameters necessary to convey one or more VDP for an associated VDS"
(RFC 9942 §3), and "Receipts MUST be tagged as COSE_Sign1" (§4.3). The three header parameters it
introduces (§2, registered at §8.1): **394 `receipts`** (array of receipts, used on the *statement*
side — RFC 9943 §7), **395 `vds`** (VDS algorithm id, REQUIRED in the receipt's *protected* header),
**396 `vdp`** (proofs by Proof Type, REQUIRED in the receipt's *unprotected* header). For the only
registered VDS — `RFC9162_SHA256`, value 1 (RFC 9942 §5.1, §8.2.2.1 Table 2) — an inclusion receipt's
unprotected header carries `vdp: { -1: [ [tree_size, leaf_index, inclusion_path] ] }` under label
-1 (§5.2 Figure 3; §8.2.2.2 Table 3), consistency proofs ride label -2 (§5.3). **These CBOR
encodings are now a Published Standard and therefore a stable conformance target** (informative
note): the labels, the proof-content arrays, and the registry values no longer move with draft
revisions the way draft-era text did.

| §20 `anchor_bindings[]` member | SCITT Receipt (RFC 9942) equivalent (pinned) | Notes |
|---|---|---|
| `type: "scitt-receipt-rfc9942"` | — (selects this row) | The other three §20 types (`rfc3161-tst`, `opentimestamps`, `c2sp-tlog-proof-v1`) are non-SCITT anchor formats; only this one is a SCITT Receipt. |
| `anchored_hash` | The Merkle tree root — which, per RFC 9942 §5.2.1, **is the receipt's payload**: "In a signed proof, the payload is the Merkle Tree root that corresponds to the log at size tree-size." §4.4 adds that such payloads SHOULD be detached, which "force[s] verifiers to recompute the root from the proof". (Absent §20.1 `merkle_inclusion`, §20's `anchored_hash` equals the artifact's own `execution_hash` as the leaf.) | Same "anchored_hash MUST equal execution_hash, except under merkle_inclusion" rule §20 already states for every anchor type. Note the type does not use §20.1's `merkle_inclusion` member — the inclusion proof rides inside `proof` (SPEC.md §20.1). |
| `proof` | Base64 COSE Receipt bytes — a COSE_Sign1 whose unprotected header carries label 396 `vdp` → inclusion proofs under label -1 (RFC 9942 §4.3 Figure 1, §5.2.1 Figure 5–6), and whose protected header carries `alg` (1) and `vds` (395) as REQUIRED parameters (§5.2.1 Figure 4) | §20's normative text already says this; RFC 9942 §5.2 gives the RFC 9162-derived proof content (`tree_size`, `leaf_index`, `inclusion_path`), citing RFC 9162 §2.1.3.1 for the complete proof description and §2.1.3.2 for the `leaf_index` terminology. |
| `log_origin` | The transparency service's identity/origin string — RFC 9943 §3 (*Transparency Service*): "The identity of a TS is captured by a public key that must be known by Relying Parties in order to validate Receipts"; §5.1: "Typically, a TS has a single Issuer identity that is present in the iss Claim of Receipts for that service." | No OCG-specific meaning beyond what §20 already states for every anchor type. |
| verification procedure | RFC 9942 §5.2.1 fixes the order — inclusion proof first, signature second: "1. Inclusion Proof Verification: The verifier applies the inclusion proof to the bytes of a candidate entry. … the resulting Merkle Tree root becomes the COSE_Sign1 payload. 2. Signature Verification: The verifier checks the COSE_Sign1 signature." The walk itself is the RFC 9162 §2.1.3 inclusion-proof algorithm (`leaf` + `leaf_index` + `tree_size` + `inclusion_path`, RFC 9942 §5.2 Figure 3 — RFC 9162's audit path), applied to a root. | `export-scitt.mjs`'s `verifyInclusion()` implements exactly this algorithm — see the worked example below (§5.3). It is the **same** leafHash/nodeHash/audit-path algorithm §20.1's own `merkle_inclusion` member uses, per `SPEC.md`'s explicit "no second Merkle implementation" rule. |

**§3.1 What a SCITT Receipt does *not* prove, stated for OCG's own honesty discipline.** §20's own
normative text already makes this point for every anchor type and it applies unchanged here: a SCITT
Receipt proves **existence by a time and inclusion in the named log** — nothing about computational
correctness (§18), authorship (§16), or kernel identity (§17). RFC 9943 §9.2 (*Accuracy of
Statements*) says the same from the SCITT side: "registering a Statement only proves it was produced
by an Issuer." Those remain independent, composable OCG claims a Receipt does not substitute for.

## 4. SCRAPI — the SCITT Reference API (informative, queue-stage; never a conformance claim)

**SCRAPI is still a draft**: `draft-ietf-scitt-scrapi-11` ("Supply Chain Integrity, Transparency,
and Trust (SCITT) Reference APIs", 26 June 2026). Datatracker state verified 2026-09-03: IESG
evaluation complete, **IESG state "RFC Ed Queue"**, intended status Proposed Standard; the draft
itself still cites the architecture as an Internet-Draft (`[I-D.draft-ietf-scitt-architecture]`),
which is normal for a queue-stage document and is why its section numbers are cited as draft
numbers here, clearly marked. SCRAPI's abstract: "This document specifies a REST API with the HTTP
resources, request and response messages, and error handling needed for an interoperable
implementation of a SCITT Transparency Service." Its surface (draft-11 §2):

- **§2.3 Register Signed Statement** — `POST /entries`; 201 (registration complete) or 202
  (registration running, `Location` points at the receipt resource).
- **§2.4 Resolve Receipt** — `GET /entries/{entry-id}`; 200 (Receipt available), 204 (still
  running), 404 (none). "may also be used at any later time to obtain a fresh Receipt for a
  previously registered Signed Statement."
- **§2.1/§2.2 Transparency Service Keys** — `GET /.well-known/scitt-keys` (and per-`kid`
  sub-resource) for receipt-verification key discovery; well-known URI registered per §6.1.

**Where the estate's receipt-serving surfaces correspond — as correspondence only:**

- OCG is a receipt **consumer** on this path: a §20 `scitt-receipt-rfc9942` binding carries exactly
  the artifact SCRAPI §2.4 returns. A future OCG-side registration client (flag-and-wait gated;
  the external-registration boundary is §7 below) would speak SCRAPI §2.3 to submit the exporter's
  Signed Statement and §2.4 to retrieve the Receipt to embed as the `proof` member. No such client
  exists today.
- The estate's own receipt-**serving** surface, `anchor.ainumbers.co` (anchor-suite), serves RFC
  3161 timestamps, not SCITT Receipts, and implements no SCRAPI resource. `SPEC.md` §20 already
  rules the posture: "OCG implementations are NOT SCITT Transparency Services and SCRAPI is out of
  scope." Nothing in this mapping claims, implies, or aspires to SCRAPI conformance for any OCG or
  anchor-suite surface; this note exists so a reader holding a SCRAPI-speaking Transparency Service
  can locate the corresponding OCG members.

## 5. Worked example, from a live artifact

The artifact below is `art-04-agent-identity-attestation-checker`'s `valid_agent_credential_pass`
golden vector — one of the survivor-set proven kernels (`board/STANDING-ORDERS.md`'s art-476 record:
`{art-04, art-201, art-371, art-413/414/415}`), fixture at
`repo/chaingraph/kernels/fixtures/art-04-agent-identity-attestation-checker.fixtures.json`. Its
`golden_hash` is a real, currently-pinned OCG `execution_hash`, not a synthetic value.

### 5.1 Sign — OCG artifact → SCITT Signed Statement

```
$ node repo/scripts/export-scitt.mjs keygen --alg es256 --out-prefix ./scitt-demo-key
Wrote ./scitt-demo-key.priv.jwk.json + ./scitt-demo-key.pub.jwk.json (es256)
```

Input artifact (`scitt-demo-artifact.json` — the four claim fields §2 maps):

```json
{
  "execution_hash": "sha256:a1ad74ebe62829232e2d2b000d883179d916c51bc8bdc8d0fdbcb75d65bacc8b8",
  "tool_id": "art-04-agent-identity-attestation-checker",
  "chaingraph_version": "0.4.0",
  "generated_at": "2026-08-07T00:00:00.000Z"
}
```

```
$ node repo/scripts/export-scitt.mjs sign scitt-demo-artifact.json \
    --key scitt-demo-key.priv.jwk.json --alg es256 --out scitt-demo-statement.cose
Wrote scitt-demo-statement.cose (117 bytes, detached payload scitt-demo-statement.payload.json)
```

The resulting COSE_Sign1 Signed Statement, base64-encoded:

```
0oRYLaMBJgNwYXBwbGljYXRpb24vanNvbg+hAXRodHRwczovL2FpbnVtYmVycy5jb6D2WEBrjBNhGfgFTwhjrbQ8ln03EaYwYFDC649Pt/RQAnmW9lttoSzeYh8FyiPwoUY5/qdNBRfmCg5e18Rmjf4xj/b4
```

Decoded structure (protected header, informative — decoded from the CBOR above): `alg: -7` (ES256),
`content type: application/json`, `cwt-claims (15): { iss: 1 = "https://ainumbers.co" }`; payload
field is `null` (detached — §2.1); signature is the raw P1363 ECDSA `r||s` bytes WebCrypto returns.
Note the header carries `iss` and no `sub` — the RFC 9943 §6 registration-readiness gap §2's identity
row records; fine for the round-trip demonstration below, not for submission to a conforming TS.

### 5.2 Verify — round-trip against the detached payload

```
$ node repo/scripts/export-scitt.mjs verify-statement scitt-demo-statement.cose \
    --pubkey scitt-demo-key.pub.jwk.json --payload scitt-demo-statement.payload.json --alg es256
VALID
```

`scitt-demo-statement.payload.json`, the detached claim set the signature covers:

```json
{"execution_hash":"sha256:a1ad74ebe62829232e2d2b000d883179d916c51bc8bdc8d0fdbcb75d65bacc8b8","tool_id":"art-04-agent-identity-attestation-checker","chaingraph_version":"0.4.0","generated_at":"2026-08-07T00:00:00.000Z"}
```

### 5.3 Receipt-side: RFC 9942 / RFC 9162 inclusion-proof verification

No OCG artifact has been registered with a live SCITT transparency service — external registration is
a flag-and-wait action (unauthorized use of a third-party account, `board/STANDING-ORDERS.md` #8) and
was explicitly left open by `PROV-SCITT-1`. The RFC 9162 inclusion-proof walk §3's table cites
(`verifyInclusion()`) is proven correct against a locally-built Merkle tree instead — the same
algorithm a live COSE Receipt's `inclusion_path[]` would be checked against, in the RFC 9942 §5.2.1
order (proof first, then signature):

```
$ node repo/scripts/export-scitt.mjs selftest
[es256] COSE_Sign1 round-trip: PASS; tamper rejected: PASS
[ed25519] COSE_Sign1 round-trip: PASS; tamper rejected: PASS
[merkle] RFC 9162 inclusion-proof walk (7 leaves, all indices): PASS; tampered leaf rejected: PASS

selftest: ALL PASS
```

**What this worked example demonstrates and what it does not.** It demonstrates the §2 field mapping
end-to-end against a real, pinned OCG `execution_hash`, and demonstrates the §3 inclusion-proof
algorithm against a self-built tree. It does **not** demonstrate registration against a live SCITT
transparency service — no such registration has occurred, and this document does not claim otherwise.

## 6. Related work — other SCITT-adjacent efforts (informative, factual only)

Two current Internet-Drafts pursue evidentiary AI/algorithmic-decision trails in adjacent space to
OCG's own compute-proof work. Both are cited here factually, without disparagement, per
`board/STANDING-ORDERS.md`'s competitive-note handling — verified against datatracker.ietf.org
2026-08-07:

- **`draft-kamimura-scitt-vcp`** ("A SCITT Profile for Verifiable Audit Trails in Algorithmic Trading:
  The VeritasChain Protocol") profiles SCITT specifically for algorithmic-trading audit trails, citing
  EU AI Act and MiFID II compliance drivers, and defines Silver/Gold/Platinum conformance tiers by
  timestamp resolution (millisecond through nanosecond) and operational requirement. It builds directly
  on SCITT Signed Statements, Receipts, and Transparency Services, and requires SCRAPI conformance
  (SCRAPI at the queue stage described in §4 above).
- **`draft-kamimura-vap-framework`** ("Verifiable AI Provenance Framework") is domain-agnostic
  architecture, not a protocol: it coordinates SCITT, RATS (remote attestation), and COSE across three
  conceptual layers (integrity, provenance, accountability) and explicitly leaves room for
  sector-specific profiles, naming finance as one target sector.

**Where OCG's compute-proof semantics go further than either draft (informative comparison, not a
claim about either draft's future direction).** Both drafts describe *evidentiary trails of a
decision having occurred and being attributable* — neither specifies a mechanism for proving the
computation that produced the decision was executed correctly. OCG's §18 compute-proof layer does:
a `gpu:false` (software-attested) or `gpu:true`+ZK-proved node carries a machine-checkable proof that
the exact pinned kernel, given the exact hashed inputs, produced the exact hashed output — the
`art-04` receipt behind this document's worked example
(`repo/chaingraph/kernels/fixtures/compute-proof/art-04-agent-identity-attestation-checker.receipt.json`)
is a RISC Zero zkVM Groth16 proof of that kind. Neither cited draft defines an equivalent computational-
correctness proof; VAP's "integrity layer" and VCP's audit-trail model both evidence *that a statement
was made and logged*, not *that the computation behind the statement was correct*. This is a factual
scope difference, not a value judgment about either draft's design goals — VCP and VAP are solving
attribution and transparency-log integrity, a different (and complementary) problem from the one §18
solves.

## 7. Follow-on work (named, not started here)

If this mapping is judged to warrant promotion into `SPEC.md`'s §XMAP-1 annex (for example, expanding
the annex's existing single-row SCITT column into the fuller field set §2–§3 cover here), that is a
**separate SPEC-SERIAL work unit**, carrying the mirrored-page parity fence SPEC.md edits require.
This document does not stage that work — it is out of this row's fence
(`board/queued/SCITT-MAPPING-REFRESH-1.md` scope: "a mapping DOCUMENT... NOT SPEC.md normative text").

IETF submission of any OCG-originated SCITT text — an I-D, a profile, or anything filed with the IETF —
remains `MERKLE-PROGRAM`'s SCITT-1 lane, gated on IETF 127 and Tim's flag-and-wait authority
(`board/STANDING-ORDERS.md` #8, public-registry/publish class). This document is the repo-side half of
that boundary; it publishes nothing externally.

---

*Sources: RFC 9943 and RFC 9942, both Proposed Standard (Standards Track), June 2026 — full plain
texts retrieved 2026-09-03 from rfc-editor.org (sha256 in the header pin block above;
`SCITT-MAPPING-REFRESH-1`). Publication first verified 2026-08-05 during `PROV-SCITT-1`, which
shipped `repo/scripts/export-scitt.mjs` (PR #968), the exporter this document's worked example uses.
SCRAPI `draft-ietf-scitt-scrapi-11` (26 June 2026) retrieved from ietf.org and its datatracker state
("RFC Ed Queue", intended Proposed Standard) verified 2026-09-03. `draft-kamimura-scitt-vcp` and
`draft-kamimura-vap-framework` verified at datatracker.ietf.org 2026-08-07 (prior row). Kernel proof:
`repo/chaingraph/kernels/fixtures/compute-proof/art-04-agent-identity-attestation-checker.receipt.json`.*
