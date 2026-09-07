# RECEIPT-BUNDLE v0.1 — the portable receipt bundle

**Status: NORMATIVE for the bundle format itself; INFORMATIVE relative to [`SPEC.md`](SPEC.md).** This document
defines a distribution artifact — one self-contained JSON file that packages what a third party needs to verify
BOTH halves of a published compute-integrity receipt's trust story offline, in one place: the zk proof half
(Groth16/BN254 seal over the §18.7 journal byte contract) and the transparency half (a Sigsum log-inclusion
proof with witness cosignatures, verified against a named, versioned trust policy). It changes no SPEC.md
section, no schema, no receipt, and no published artifact. It cites SPEC.md clauses; it does not modify them.

**Scope: v0.1 covers single receipts.** Chain-walk / composed bundles (journal-of-A = input-of-B) are a named
follow-on (§7), not this version. A zkVM-receipt SCITT profile (RFC 9943/9942) is assessed separately as a
standards on-ramp; this document plants no IETF text and claims no SCITT conformance.

**Why this artifact exists.** A published `ZkVmReceipt` (SPEC.md §18.0) and the estate's published Sigsum anchor
records live in different places and verify under different tools; no FOSS tool verifies a zk proof AND a
transparency-log inclusion proof in one step, and no artifact standard packages both (verified gap scan,
2026-09-02). The bundle is the distribution call: "one file, one command, proof + transparency verified
together" — verification distribution, not new proving tech, not new anchoring.

## §1 Design constraints (NORMATIVE)

1. **Every field either already exists in a published estate artifact or is derivable at bundle-build time.**
   No field in this specification is invented input: each field's published source (or derivation) is named in
   §2. A bundle builder copies and derives; it never proves, never signs, never registers.
2. **NO re-proving.** Bundling never runs a prover. The `seal` is copied verbatim from the published receipt.
3. **NO re-stamping (never-re-stamp doctrine).** Bundling never submits anything to any log. The anchor record
   and its checkpoint are copied verbatim from published registration output. A bundle builder that could
   contact a log is defective by design.
4. **One canonicalizer.** Journal bytes are the RFC 8785 (JCS) canonical serialization per SPEC.md §18.7 —
   §4's `cgCanon` path, never a second canonicalization. The bundle introduces no new hashing or serialization
   rule anywhere.
5. **JSON-clean, CMW-carriable.** The bundle is a single self-describing JSON object (UTF-8, I-JSON-safe
   numbers), registrable as a media type in a future revision and carriable as an RFC 9999 CMW payload with
   its own media type, without adopting EAT semantics: a receipt bundle is not an entity attestation, and
   nothing in this format widens the claim scope of either half (§3.3).

## §2 The bundle object

One JSON object, UTF-8:

```json
{
  "bundle_version": "0.1",
  "receipt": {
    "type": "ZkVmReceipt",
    "system": "risc0",
    "receiptFormat": "groth16-bn254",
    "imageId": "sha256:…",
    "seal": "<base64, 256 bytes decoded>",
    "journal": { … }
  },
  "journal_contract": {
    "spec": "SPEC.md §18.7",
    "serialization": "rfc8785-jcs+utf8",
    "journal_digest": "sha256:<hex>",
    "claim_digest": "sha256:<hex>"
  },
  "provenance": {
    "repo": "PostOakLabs/ainumbers",
    "receipt_source": "chaingraph/kernels/fixtures/compute-proof/<name>.receipt.json",
    "receipt_source_sha256": "<hex>",
    "anchor_source": "registry/lineage/checkpoint.sigsum-record.json",
    "checkpoint_source": "registry/lineage/checkpoint"
  },
  "anchor": {
    "type": "c2sp-tlog-proof-v1",
    "record": { … Sigsum record, verbatim … },
    "checkpoint_text": "<the signed-note checkpoint text, verbatim>",
    "subject": {
      "kind": "registry-checkpoint",
      "origin": "ainumbers.co/registry/lineage",
      "log_policy": "chaingraph/policies/ainumbers-registry-lineage.tlog-policy"
    }
  },
  "trust_policy": {
    "name": "sigsum-generic-2025-1",
    "source": "chaingraph/policies/sigsum-generic-2025-1.tlog-policy",
    "sha256": "<hex>",
    "shape": "2 logs, 3 witnesses, quorum 2-of-3"
  }
}
```

Field sources — the §1.1 compliance table. Every row names where the byte came from:

| Field | Published source (or derivation) |
|---|---|
| `bundle_version` | This document. |
| `receipt.*` (all six members) | Verbatim from the published receipt: the graph node's `compute_proof` member (SPEC.md §18.0; e.g. `chaingraph/graph/nodes/<tool_id>.json`) or the published fixture corpus `chaingraph/kernels/fixtures/compute-proof/<name>.receipt.json`. Identical bytes either way; `provenance.receipt_source` names which. |
| `journal_contract.spec`, `.serialization` | Statements of SPEC.md §18.7 (cited, not restated: RFC 8785 JCS canonical serialization, UTF-8, `sha256` over exactly those bytes, entering `ReceiptClaim::ok(imageId, journalBytes)` for risc0). |
| `journal_contract.journal_digest`, `.claim_digest` | Derivable at bundle-build time: `sha256(utf8(JCS(receipt.journal)))` and the ReceiptClaim digest over `(imageId, journalBytes)`. **Advisory annotations only** — a verifier MUST recompute both and MUST NOT trust either value (§3.1); they exist so a human can diff bundles. |
| `provenance.*` | Paths within `PostOakLabs/ainumbers` at bundle-build time; `receipt_source_sha256` is `sha256` of the named receipt file (derivable). Informational: provenance locates sources; it proves nothing and a verifier MUST NOT treat it as evidence. |
| `anchor.type` | The SPEC.md §20 anchor-type vocabulary member `c2sp-tlog-proof-v1`. |
| `anchor.record` | Verbatim Sigsum registration record as written by `scripts/register-sigsum.mjs register` and published at `registry/<log>/checkpoint.sigsum-record.json` (shape: `log_origin`, `log_url`, `log_public_key`, `anchored_hash`, `leaf{checksum,signature,public_key}`, `tree_head{size,root_hash,log_signature}`, `inclusion_proof{leaf_index,path[]}`, `witness_cosignatures[]`). |
| `anchor.checkpoint_text` | Verbatim the published signed-note checkpoint file (`registry/<log>/checkpoint`): origin/size/root(/extension) lines, blank line, `— <name> <base64(keyHint‖sig)>` signature line. |
| `anchor.subject` | Describes what `anchored_hash` commits to (§3.4). For v0.1 fixtures: the registry checkpoint itself. `log_policy` names the published C2SP tlog-policy file pinning the subject log's operator key. |
| `trust_policy.*` | The named, versioned Sigsum trust policy published at `chaingraph/policies/sigsum-generic-2025-1.tlog-policy`; `sha256` is of that file at bundle-build time; `shape` transcribes its quorum line. This is the "12-pin set" identifier: the published records carry 12 distinct witness cosignatures per checkpoint, and the named policy pins the 2-log/3-witness/2-of-3 subset a verifier must accept. |

## §3 Verification (NORMATIVE)

A conforming verifier consumes a bundle and produces **two independent half-verdicts plus one combined
statement**. The output MUST state each half's verdict explicitly and separately.

### §3.1 The proof half

Recompute everything; never read a validated value out of the artifact under test:

1. `seal` base64-decodes to 256 bytes.
2. `imageId` is `sha256:` + 64 hex.
3. `journal` is an object.
4. **§18.7 recompute:** `journalBytes = utf8(JCS(receipt.journal))`; `journalDigest = sha256(journalBytes)`;
   claim = `ReceiptClaim::ok(receipt.imageId, journalBytes)`; its digest yields the Groth16 public inputs.
5. The Groth16/BN254 pairing equation holds for the decoded seal points against the risc0 3.0.x ceremony
   verifying key (fixture-independent constants), with the control_root/control_id split-digest inputs.

`journal_contract.journal_digest` and `.claim_digest` are compared against the recomputed values as a
**reported discrepancy only**: a mismatch is reported, and the half-verdict is decided by the recomputed
values, never by the annotation. Verdict values: `PROOF-VALID` / `PROOF-INVALID` (a missing or malformed
member is `PROOF-INVALID`, never a pass — absence is not a pass).

### §3.2 The logged half

1. The bundle's `trust_policy.name` is one the verifier pins itself (name + sha256 of the policy file it
   holds). An unknown or hash-mismatched policy is `NOT-LOGGED-POLICY-UNPINNED` — the verifier never adopts a
   trust policy out of the bundle (the identifier travels in the bundle for humans; the pins do not).
2. `sha256(utf8(anchor.checkpoint_text))` equals `anchor.record.anchored_hash`.
3. The checkpoint's own signature line verifies against the **operator key pinned in the subject log's
   published tlog-policy** (`anchor.subject.log_policy` → e.g. `ainumbers-registry-lineage.tlog-policy`);
   the pinned key is never taken from the bundle.
4. `sha256(anchor.record.anchored_hash bytes)` equals `record.leaf.checksum`, and the leaf signature verifies
   against `record.leaf.public_key` over the domain-separated `sigsum.org/v1/tree-leaf` message.
5. The RFC 6962 inclusion walk from `hashLeafNode(checksum ‖ signature ‖ keyHash)` through
   `inclusion_proof.path` at (`leaf_index`, `tree_head.size`) reconstructs `tree_head.root_hash`.
6. The Sigsum checkpoint text — origin **independently derived** as `sigsum.org/v1/tree/` + `sha256(pinned
   log public key)`, size, root — matches, and `tree_head.log_signature` verifies against the **pinned log
   key** from the verifier's own trust policy (never `record.log_public_key` read as an authority: a pinned
   key must match it, or the half fails).
7. Witness cosignatures: each `key_hash` is resolved by hashing the verifier's pinned witness keys
   (hash-match-before-pin); matched cosignatures verify over `cosignature/v1\ntime <ts>\n<checkpoint>`.
   The named policy's quorum (2-of-3 for `sigsum-generic-2025-1`) MUST be met by **valid, pinned, matched**
   cosignatures. The 12 carried cosignatures are evidence bulk; only pinned matches count.

Verdict values: `LOGGED` / `NOT-LOGGED` (with the failing check named). All steps are offline: a conforming
verifier performs zero network operations.

### §3.3 The combined verdict — the non-collapse rule (NORMATIVE)

The combined output states both claims explicitly and separately, e.g.:

```
PROOF-VALID   (groth16 seal over imageId + §18.7 journal bytes)
LOGGED        (sigsum inclusion + witness quorum, subject: <anchor.subject>)
```

**A verifier MUST NOT collapse "proof valid" and "logged" into a single claim.** They are different
statements about different subjects: the proof half says the seal verifies a computation by the named guest
image; the logged half says the anchored subject was sequenced in a witnessed transparency log by a time.
Neither implies the other — a receipt can be perfectly proven and never logged, or logged and
cryptographically invalid. A single boolean, a single `valid: true`, or any output phrasing from which one
half's verdict cannot be read independently, is NON-CONFORMANT. A machine-readable verdict object carries
`proof` and `logged` as siblings, each with its own verdict token; an overall exit code may require both, but
the two verdicts remain separately legible in every output mode.

### §3.4 Anchor subject scope (NORMATIVE honesty)

The log half proves inclusion **of `anchor.record.anchored_hash`** — and §3.2 steps 2–3 establish what that
digest commits to. For v0.1 the published anchor records commit to **registry checkpoints** (the
anchor-lineage / errata log heads published under `registry/`), NOT to individual receipts. A v0.1 verifier
and any UI built on it MUST state this scope plainly ("the log half commits to the registry checkpoint
`<origin>` at size `<n>`, not to the receipt itself") and MUST NOT phrase the combined verdict as "this
receipt is transparency-logged". The cryptographic proof-half↔log-half binding for a single receipt requires
an anchor whose `anchored_hash` is the receipt's subject artifact `execution_hash` (or a batch root over
artifact hashes with the leaf's `merkle_inclusion`, SPEC.md §20.1) — the pending-binding registration flow
already produces such records as untracked per-artifact outputs; when one is published, the SAME `anchor`
member carries it with `subject.kind: "execution_hash"` and `subject.artifact_execution_hash`, and §3.2
gains one step (`anchored_hash` == the subject execution hash, or the §20.1 root reconstruction). That is a
registration/publication event, not a format change: v0.1 bundles and verifiers are forward-compatible with
it by construction.

## §4 Builder conformance

A conforming bundle builder: copies the six receipt members verbatim (no re-serialization of `seal`, no
re-keying of `journal`); computes §2's derivable fields with §4-SPEC.md's canonicalizer discipline (§18.7);
copies anchor record and checkpoint text byte-for-byte from published files; records provenance paths; and
performs zero network operations. Bundles are evidence **carriers**, not evidence **makers**.

## §5 Fixtures (INFORMATIVE)

The reference verifier repository (`PostOakLabs/zkprof-web`) carries five fixtures:
`real-art-04`, `real-art-01`, `real-art-106` (both halves green; art-04 is the §18.7
discriminating-journal receipt — unsorted nested journal keys, so JCS and insertion-order serializations
diverge and only JCS verifies), plus one RED control per half: a mutated seal (proof half fails, logged half
still passes) and a mutated inclusion-proof path hash (logged half fails, proof half still passes). The RED
controls exist to prove the verifier fails honestly and that the two halves are independently decidable.

## §6 What a bundle is not

Not an OCG artifact (no `execution_hash` preimage, no §16 signature), not a SCITT statement or COSE receipt,
not an EAT/CMW entity attestation (carriable as a CMW payload ≠ being one), not evidence of authorship,
hardware, time-of-execution, or operator behavior. It carries exactly the two claims §3 defines.

## §7 Named follow-ons (not this version)

1. **Per-receipt / per-artifact anchoring** — `subject.kind: "execution_hash"` bundles once artifact-level
   Sigsum records are published (§3.4).
2. **Chain-walk bundles** — composed receipts (journal-of-A = input-of-B) over the 369-chain estate.
3. **zkVM-receipt SCITT profile** — an individual IETF draft against RFC 9943/9942 planting the flag for a
   zk-receipt registered-claims profile; assessed in the landing row's report, Tim-gated, not begun here.
4. **Media-type registration** for the bundle JSON (I-JSON-clean by §1.5).
