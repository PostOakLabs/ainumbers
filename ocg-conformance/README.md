# OpenChainGraph receipt conformance corpus

Public, language-agnostic verification material for the OpenChainGraph receipt format. Extracted from
`../chaingraph/standard/SPEC.md` (section 1, "artifact envelope") and
`../chaingraph/standard/openchain-graph-v0.4.schema.json`, which stay the normative source. Nothing in
this directory changes those files; this is a republished, standalone-consumable subset for a party who
has no interest in AINumbers code and just wants to check the receipt format independently.

## What this proves

Every OpenChainGraph receipt carries an `execution_hash`. That hash is computed as:

```
execution_hash = SHA-256( JCS-canonicalize( { policy_parameters, output_payload } ) )
```

- `policy_parameters` and `output_payload` are the receipt's own top-level members — nothing else enters
  the hash.
- Canonicalization: recursively sort every object's keys by Unicode code point, keep array order
  unchanged, serialize with minimal whitespace. For the practical JSON subset this document's vectors
  use (finite numbers, no integers past 2^53), this reproduces RFC 8785 (JSON Canonicalization Scheme)
  output exactly.
- Hash: standard SHA-256 over the UTF-8 bytes of that canonical string, rendered as lowercase hex.

Any implementation in any language that (a) sorts keys, (b) serializes to minimal-whitespace JSON, and
(c) runs SHA-256 over the UTF-8 bytes will reproduce the same `execution_hash` for the same input pair.
No AINumbers code, kernel, or server call is required to check this.

## Files

- `schemas/ocg-receipt-envelope.schema.json` — JSON Schema for the receipt shape.
- `vectors/manifest.json` — one entry per test vector: the input file, the expected-output file, a
  SHA-256 of each file's bytes (so you can confirm you fetched them unmodified), a SHA-256 of each
  side's *canonicalized* JSON (so you can confirm your canonicalizer agrees before you even touch
  hashing), and the expected `execution_hash`.
- `vectors/inputs/<id>.input.json` — the `policy_parameters` object for vector `<id>`.
- `vectors/outputs/<id>.output.json` — the `output_payload` object for vector `<id>`.

Every vector is a real receipt pair produced by a real, shipped AINumbers decision kernel (named in each
manifest entry's `source` field) — none are hand-invented.

## How to verify (any language)

For each entry in `manifest.json`:

1. Read `input_file` and `expected_output_file`.
2. Confirm their SHA-256 matches `input_file_sha256` / `expected_output_file_sha256` (bytes-as-fetched
   check).
3. Canonicalize each per the algorithm above and confirm the SHA-256 of each canonical string matches
   `input_canonical_sha256` / `expected_output_canonical_sha256` (canonicalizer-agreement check, isolates
   canonicalization bugs from hashing bugs).
4. Build the preimage object `{ "policy_parameters": <input>, "output_payload": <expected_output> }`,
   canonicalize it, SHA-256 it, and confirm the result equals `expected_execution_hash` (strip the
   `sha256:` prefix before comparing hex).

Step 4 passing for every vector is what "conforms to the OpenChainGraph execution_hash format" means.

## Relationship to prior art

A JCS/RFC-8785 conformance vector corpus for adjacent agentic-payment receipt formats already exists
publicly (`algovoi-jcs-conformance-vectors`, cross-validated across eight language implementations). This
corpus does not claim to be the first vector corpus of this kind — it is scoped specifically to the
OpenChainGraph receipt envelope, which that corpus does not cover.

## Scope note

This directory verifies the **format** only: that a stated input/output pair hashes to a stated
execution_hash. It does not verify that a *specific* kernel's business logic is correct, that a proof at
`audit_signature.proof`/`compute_proof` is valid, or anything about AINumbers' live service. Those are
separate, larger claims outside this corpus's scope.

## Third-party submissions

Everything above is a **house** corpus — every vector is derived from a real AINumbers kernel. A party
who is not AINumbers and wants to submit their own kernel's conformance vector uses `third-party/`
instead (never mixed into `vectors/` above): see `third-party/README.md` for the directory convention,
schemas, and worked example.
