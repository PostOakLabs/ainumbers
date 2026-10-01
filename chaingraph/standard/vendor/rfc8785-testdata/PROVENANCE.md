# `vendor/rfc8785-testdata/` — provenance (JCS-RFC8785-VECTORS-1)

Official test data for RFC 8785, the JSON Canonicalization Scheme, from the repository of the RFC's author.

## Source

- Repo: https://github.com/cyberphone/json-canonicalization (Anders Rundgren)
- Paths: `testdata/input/*.json`, `testdata/output/*.json`, `testdata/outhex/*.txt`, and the repo `LICENSE`
- **Pinned commit:** `19d51d7fe467d4706a3ff08adf8a748f29fc21e0` (repo HEAD at fetch time, 2026-09-28)
- **License:** Apache-2.0, copyright 2018 Anders Rundgren, copied verbatim into `./LICENSE`. Upstream ships no NOTICE file at the pinned commit. The files are unmodified.
- Fetched read-only with `gh api` raw content requests at the pinned commit.

Every file in this directory except this one is a byte-for-byte copy at the pinned commit. Do not hand-edit them. The gate `chaingraph/standard/jcs-rfc8785-vectors.test.mjs` pins each file's SHA-256 and fails on any byte change; to re-vendor, fetch from a new pin and update this file and the gate's `PINS` together.

## What is not vendored

- `es6testfile100m.txt.gz` and the `numgen` generators: a JavaScript engine checking its own `JSON.stringify` number formatting against them proves nothing, because RFC 8785 §3.2.2.3 defines number serialization by reference to that same ECMAScript algorithm.
- The upstream language implementations: this directory holds test data only; OCG keeps its own canonicalizers.
