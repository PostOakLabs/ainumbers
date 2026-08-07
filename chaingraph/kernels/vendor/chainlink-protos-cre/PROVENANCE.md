# `vendor/chainlink-protos-cre/` — provenance (CRE-PROTOS-1)

Row: `board/done/CRE-PROTOS-1.md`. Anchor: `research/CRE-VERIFY-SCOPE-2026-08-06.md` §6.1, item 1
(`CRE-VERIFY-SCOPE-1`'s licensing finding). Vendoring style follows the precedent set by
`chaingraph/kernels/_noble-bn254.bundle.mjs` (header comment records source, license, pinned version).

## Licensing line — the point of this vendoring

- `@chainlink/cre-sdk` (npm) — **BUSL-1.1. NOT vendored, not read, not derived from.**
- `smartcontractkit/chainlink-protos` — **MIT.** Only this repo is touched by this row.

This directory contains the MIT-licensed protobuf **schema** for the CRE report envelope, plus a
hand-written decoder for it. It does **not** contain, quote, or derive from any BUSL-1.1 source.

## Source

- Repo: https://github.com/smartcontractkit/chainlink-protos
- Path: `cre/sdk/v1beta/sdk.proto` (package `sdk.v1` — the stable channel; `cre/sdk/v1alpha/sdk.proto`
  exists too but is the experimental channel and was not vendored — not needed for `ReportResponse`,
  which is identical in both).
- **Pinned commit:** `c1accce563a86e68ed46f9bed352bf7529c9444b` (repo HEAD at fetch time, 2026-08-04).
- **License:** MIT, copyright (c) 2024 SmartContract — copied verbatim into `./LICENSE`.
- Fetched via `gh api repos/smartcontractkit/chainlink-protos/contents/...` and
  `raw.githubusercontent.com` (read-only, no write access to that repo).

`sdk.proto` in this directory is a byte-for-byte copy of the source file at the pinned commit — do not
hand-edit it; re-vendor from the pinned commit (or a newer one, updating the pin) instead.

## What the decoder covers, and what it deliberately does not

`docs.chain.link/cre/reference/sdk/core-ts` documents `Report.parse(runtime, rawReport, signatures,
reportContext, config?)`, and its accessor table names `rawReport()` → "Full raw report bytes" and
`reportContext()` → "Full report context bytes". Those two names map directly onto `sdk.v1.ReportResponse`'s
`raw_report` (field 4) and `report_context` (field 3) — the same envelope, same field names, one level of
protobuf wrapping between the wire format and the SDK's typed accessors.

`decoder.mjs` decodes `ReportResponse` down to those two fields (plus `config_digest`, `seq_nr`, `sigs`) as
**opaque bytes**. It does **not** decode further into what the docs call rawReport's "109-byte metadata
header" (the `workflowId`/`workflowOwner`/`workflowName`/`executionId`/`donId` header the docs mention
exists, or the exact byte layout the docs decline to specify) or reportContext's internal split beyond the
proto comment "combination of seq_nr and config_digest". **Neither inner layout is published anywhere under
a permissive license** — the only place that byte-exact knowledge lives is the BUSL-1.1 `@chainlink/cre-sdk`
implementation, which this row is explicitly forbidden from reading. Decoding those inner layouts is
out of scope here and stays out of scope until either Chainlink documents them precisely enough to
implement without touching BUSL source, or a legitimately-sourced fixture becomes available. `CRE-NODE-1`
(the OCG node built on top of this decoder) inherits this same boundary.

## Fixture derivation (`report-response.fixture.json`)

No real CRE report was available to this row (D-class, no live calls; `CRE-VERIFY-SCOPE-1`'s own prototype
was a synthetic secp256k1 signing demo, not a real DON report). The fixture is **hand-constructed** against
the public protobuf wire-format spec (https://protobuf.dev/programming-guides/encoding/ — unrelated to
Chainlink, no license conflict) applied to `sdk.proto`'s field list, then **walked field-by-field** to
confirm every byte before being recorded as a golden. The construction script lives in this session's
scratchpad only (not shipped) — the walk below is the durable, checkable record.

Field layout of the fixture (`configDigest` = bytes `01..20`, `seqNr` = `42`, `reportContext` = 40
representative bytes, `rawReport` = the UTF-8 payload text, two `AttributedSignature` entries):

| Field | Wire type | Byte range (of 145 total) | Length |
|---|---|---|---|
| `config_digest` (1) | length-delimited | `0..34` (tag+len @ 0-1, data @ 2-33) | 32 data bytes |
| `seq_nr` (2) | varint | `34..36` | value `42` |
| `report_context` (3) | length-delimited | `36..78` (tag+len @ 36-37, data @ 38-77) | 40 data bytes |
| `raw_report` (4) | length-delimited | `78..125` (tag+len @ 78-79, data @ 80-124) | 45 data bytes |
| `sigs[0]` (5, `AttributedSignature`) | length-delimited | `125..135` | inner: signature (4B) + signer_id (1) |
| `sigs[1]` (5, `AttributedSignature`) | length-delimited | `135..145` | inner: signature (4B) + signer_id (7) |

Verified by walking the hex with a standalone varint/length-delimited reader (same algorithm as
`decoder.mjs`, run independently in-session) and confirming the printed offsets match this table exactly
before the fixture was written to disk. `report-response-decode.test.mjs` asserts `decodeReportResponse()`
reproduces every field, plus two negative cases (truncated buffer, missing required field) — both throw
rather than returning partial/garbage data.

## Re-vendoring

To pull a newer commit: repeat the `gh api .../contents/cre/sdk/v1beta/sdk.proto` fetch, diff against this
copy, update the pinned commit SHA in `sdk.proto`'s header and in this file, and re-run
`report-response-decode.test.mjs` (the fixture doesn't change unless `ReportResponse`'s field numbers/types
change).
