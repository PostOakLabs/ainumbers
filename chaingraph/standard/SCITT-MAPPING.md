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

## 1. What SCITT is, in OCG's terms

[RFC 9943](https://www.rfc-editor.org/rfc/rfc9943) (SCITT Architecture) and
[RFC 9942](https://www.rfc-editor.org/rfc/rfc9942) (COSE Receipts) are **published RFCs**, not drafts —
verified against rfc-editor.org 2026-08-05 during `PROV-SCITT-1`, which shipped the exporter this
document's worked example uses (`board/done/PROV-SCITT-1.md`).

SCITT is a **registration/transparency-log model**: an issuer submits a signed **Signed Statement**
(a COSE_Sign1 envelope, RFC 9052) to a **Transparency Service**, which appends it to a verifiable log
and returns a **Receipt** (a COSE Receipt, RFC 9942) proving the statement's inclusion. This is
architecturally different from an OCG artifact, which is a **self-contained, offline-verifiable
document** — nothing about an OCG artifact's validity depends on a third-party service being reachable.
The mapping below is therefore a mapping of **roles and equivalents**, not a claim that OCG artifacts
and SCITT statements are interchangeable byte-for-byte.

| SCITT concept (RFC 9943 / RFC 9942) | OCG equivalent |
|---|---|
| Signed Statement (COSE_Sign1, issuer-signed) | OCG artifact's §16 `audit_signature` (`eddsa-jcs-2022` proof over the JCS-canonical artifact) |
| Issuer | The §9 `did:key` / LEI identity that signs the artifact |
| Transparency Service | No OCG equivalent by design (§0 SURVIVES-THE-MAINTAINER — OCG artifacts verify offline; a service dependency is the thing OCG avoids) |
| Receipt (COSE Receipt, RFC 9942 inclusion proof) | §20 `anchor_bindings[]` entry, `type: "scitt-receipt-rfc9942"` (or `c2sp-tlog-proof-v1` / `rfc3161-tst` / `opentimestamps` for OCG's other three anchor types) |
| Registration Policy | No OCG equivalent — OCG has no registration-time policy gate; §27 human-accountability gates are a separate, artifact-level construct |
| Statement about a Statement (audit trail of audit trails) | §27 approval records (`subject_hash` referencing another artifact's `execution_hash`) — §27.0 names this pattern as SCITT-style explicitly |

## 2. Field-by-field: OCG envelope → SCITT Signed Statement

An OCG artifact is not signed *as* a SCITT statement — no OCG artifact is submitted to a transparency
service today. `repo/scripts/export-scitt.mjs` (shipped by `PROV-SCITT-1`) is the interop path: it
takes an already-sealed OCG artifact and produces a COSE_Sign1 Signed Statement an implementer holding
one format can map to the other.

| OCG member | SCITT Signed Statement placement | Notes |
|---|---|---|
| `execution_hash` | Detached-payload claim `execution_hash` (JSON, inside the Signed Statement's payload) | The exporter does not put the whole OCG artifact in the SCITT payload — only enough to identify it (§2.1 below). SCITT's payload is issuer-chosen; there is no fixed "input hash" field the way §XMAP-1's other three formats each have one. |
| `tool_id` | Claim `tool_id` | Identifies the producer, analogous to §20's `log_origin` but on the statement side, not the receipt side. |
| `chaingraph_version` | Claim `chaingraph_version` | Carried for a verifier to know which schema/version the referenced `execution_hash` was computed under. |
| `generated_at` | Claim `generated_at` | Not itself part of the §4 hash preimage — informative only, same status it has inside the OCG artifact. |
| §9 identity (`did:key` / LEI) | COSE protected header, label 15 (`cwt-claims`, RFC 9597), CWT claim 1 (`iss`) | Same row already recorded in `SPEC.md` §XMAP-1's "party identity" line — this document does not change that mapping, only demonstrates it with a real statement below. |
| §16 `audit_signature` proof suite (`eddsa-jcs-2022`) | COSE_Sign1 signature algorithm, protected header label 1 | The exporter supports `ES256` (`alg: -7`) and `EdDSA` (`alg: -8`) — both interoperate with §16's Ed25519-over-JCS proof in the sense that the *key type* is shared for the EdDSA case; the *signature scope* differs (COSE signs the CBOR `Sig_structure`, §16 signs the JCS-canonical artifact) so a verifier written for one does not accept the other's bytes directly. This is the same proof-suite-delta discipline `SPEC.md` §XMAP-1 already applies to the `agent-receipts` VC column. |

**§2.1 Why the payload is detached and minimal.** A SCITT Signed Statement's payload is
issuer-chosen — RFC 9943 does not require it to be the full document under audit. `export-scitt.mjs`
signs a four-field claim set (`execution_hash`, `tool_id`, `chaingraph_version`, `generated_at`) in
**detached-payload mode**: the COSE_Sign1 envelope's payload field carries `null`, and the claim bytes
travel alongside as a separate file, exactly as a real SCITT registration flow separates statement
bytes from the HTTP request body. A verifier who trusts `execution_hash` alone can already recompute
and check the full OCG artifact through the existing §4 hash path — the SCITT statement adds an
externally-verifiable *signed pointer* to that hash, not a duplicate of the artifact.

## 3. Field-by-field: OCG receipt/anchor → SCITT Receipt

This direction is already normative — `SPEC.md` §20 lists `scitt-receipt-rfc9942` as one of four
`anchor_bindings[]` types an OCG artifact MAY carry. This section explains what that type's fields mean
in SCITT terms; it adds no new field and changes no §20 text.

| §20 `anchor_bindings[]` member | SCITT Receipt (RFC 9942 / RFC 9162) equivalent | Notes |
|---|---|---|
| `type: "scitt-receipt-rfc9942"` | — (selects this row) | The other three §20 types (`rfc3161-tst`, `opentimestamps`, `c2sp-tlog-proof-v1`) are non-SCITT anchor formats; only this one is a SCITT Receipt. |
| `anchored_hash` | The Merkle tree ROOT the Receipt proves inclusion against (or, absent `merkle_inclusion`, equal to the artifact's own `execution_hash` as the leaf) | Same "anchored_hash MUST equal execution_hash, except under merkle_inclusion" rule §20 already states for every anchor type. |
| `proof` | Base64 COSE Receipt bytes — a COSE_Sign1 whose unprotected header carries the transparency service's inclusion proof | §20's normative text already says this; RFC 9942 wraps an RFC 9162 (RFC 6962) Merkle inclusion/consistency proof inside that unprotected header. |
| `log_origin` | The transparency service's identity/origin string | No OCG-specific meaning beyond what §20 already states for every anchor type. |
| verification procedure | RFC 9942 COSE Receipt verification == the RFC 9162 §2.1.3.2 inclusion-proof algorithm (`{leaf_hash, leaf_index, tree_size, audit_path[]}` against a root) | `export-scitt.mjs`'s `verifyInclusion()` implements exactly this algorithm — see the worked example below (§4.2). It is the **same** leafHash/nodeHash/audit-path algorithm §20.1's own `merkle_inclusion` member uses, per `SPEC.md`'s explicit "no second Merkle implementation" rule. |

**§3.1 What a SCITT Receipt does *not* prove, stated for OCG's own honesty discipline.** §20's own
normative text already makes this point for every anchor type and it applies unchanged here: a SCITT
Receipt proves **existence by a time and inclusion in the named log** — nothing about computational
correctness (§18), authorship (§16), or kernel identity (§17). Those remain independent, composable
OCG claims a Receipt does not substitute for.

## 4. Worked example, from a live artifact

The artifact below is `art-04-agent-identity-attestation-checker`'s `valid_agent_credential_pass`
golden vector — one of the survivor-set proven kernels (`board/STANDING-ORDERS.md`'s art-476 record:
`{art-04, art-201, art-371, art-413/414/415}`), fixture at
`repo/chaingraph/kernels/fixtures/art-04-agent-identity-attestation-checker.fixtures.json`. Its
`golden_hash` is a real, currently-pinned OCG `execution_hash`, not a synthetic value.

### 4.1 Sign — OCG artifact → SCITT Signed Statement

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

### 4.2 Verify — round-trip against the detached payload

```
$ node repo/scripts/export-scitt.mjs verify-statement scitt-demo-statement.cose \
    --pubkey scitt-demo-key.pub.jwk.json --payload scitt-demo-statement.payload.json --alg es256
VALID
```

`scitt-demo-statement.payload.json`, the detached claim set the signature covers:

```json
{"execution_hash":"sha256:a1ad74ebe62829232e2d2b000d883179d916c51bc8bdc8d0fdbcb75d65bacc8b8","tool_id":"art-04-agent-identity-attestation-checker","chaingraph_version":"0.4.0","generated_at":"2026-08-07T00:00:00.000Z"}
```

### 4.3 Receipt-side: RFC 9942 / RFC 9162 inclusion-proof verification

No OCG artifact has been registered with a live SCITT transparency service — external registration is
a flag-and-wait action (unauthorized use of a third-party account, `board/STANDING-ORDERS.md` #8) and
was explicitly left open by `PROV-SCITT-1`. The RFC 9162 inclusion-proof walk §3's table cites
(`verifyInclusion()`) is proven correct against a locally-built Merkle tree instead — the same
algorithm a live COSE Receipt's `audit_path[]` would be checked against:

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

## 5. Related work — other SCITT-adjacent efforts (informative, factual only)

Two current Internet-Drafts pursue evidentiary AI/algorithmic-decision trails in adjacent space to
OCG's own compute-proof work. Both are cited here factually, without disparagement, per
`board/STANDING-ORDERS.md`'s competitive-note handling — verified against datatracker.ietf.org
2026-08-07:

- **`draft-kamimura-scitt-vcp`** ("A SCITT Profile for Verifiable Audit Trails in Algorithmic Trading:
  The VeritasChain Protocol") profiles SCITT specifically for algorithmic-trading audit trails, citing
  EU AI Act and MiFID II compliance drivers, and defines Silver/Gold/Platinum conformance tiers by
  timestamp resolution (millisecond through nanosecond) and operational requirement. It builds directly
  on SCITT Signed Statements, Receipts, and Transparency Services, and requires SCRAPI conformance.
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

## 6. Follow-on work (named, not started here)

If this mapping is judged to warrant promotion into `SPEC.md`'s §XMAP-1 annex (for example, expanding
the annex's existing single-row SCITT column into the fuller field set §2–§3 cover here), that is a
**separate SPEC-SERIAL work unit**, carrying the mirrored-page parity fence SPEC.md edits require.
This document does not stage that work — it is out of this row's fence
(`board/queued/SCITT-MAP-1.md` scope: "a mapping DOCUMENT... NOT SPEC.md normative text").

IETF submission of any OCG-originated SCITT text — an I-D, a profile, or anything filed with the IETF —
remains `MERKLE-PROGRAM`'s SCITT-1 lane, gated on IETF 127 and Tim's flag-and-wait authority
(`board/STANDING-ORDERS.md` #8, public-registry/publish class). This document is the repo-side half of
that boundary; it publishes nothing externally.

---

*Sources: RFC 9943 and RFC 9942, verified published (not draft) at rfc-editor.org 2026-08-05
(`PROV-SCITT-1`). `draft-kamimura-scitt-vcp` and `draft-kamimura-vap-framework` verified at
datatracker.ietf.org 2026-08-07 (this row). Kernel proof:
`repo/chaingraph/kernels/fixtures/compute-proof/art-04-agent-identity-attestation-checker.receipt.json`.
Exporter: `repo/scripts/export-scitt.mjs` (`PROV-SCITT-1`, PR #968).*
