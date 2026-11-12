# `vendor/canonicalize/` — provenance (LANDSCAPE-JCS-DIFF-ORACLE-1)

An independent RFC 8785 (JCS) canonicalizer written outside this estate, vendored as a fifth
implementation under test in `chaingraph/standard/jcs-rfc8785-vectors.test.mjs`.

## Source

- Repo: https://github.com/erdtman/canonicalize
- Path: `lib/canonicalize.js` (the repo's sole implementation file; its default export
  `canonicalize(object)` returns the JCS string) plus the repo `LICENSE`
- **Pinned commit:** `31fb117afde3ef305b2e1d99bde539bf6300bc62` (repo `master` HEAD at fetch time, 2026-11-01)
- **License:** Apache-2.0 (confirmed on the repo metadata and in the file at the pin; no NOTICE file
  ships at the pinned commit), copied verbatim into `./LICENSE`.
- Fetched read-only with `curl` on the raw.githubusercontent.com URLs at the pinned commit. No npm,
  no clone.

## SHA-256 of the vendored files

- `canonicalize.js` — `c1d0195af2a0748454b06af8f218e5c90415c19d39154d0058fee8229c12d859`
- `LICENSE` — `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`

Every file in this directory except this one is a byte-for-byte copy at the pinned commit. Do not
hand-edit them.

## Modifications

None. Upstream `lib/canonicalize.js` is already an ES module at the pin (a single
`export default function canonicalize`), so no CJS→ESM conversion was applied and no logic edits
were made.

## Behavioural notes (observed, not edited)

- Non-ASCII strings are passed through `String.prototype.isWellFormed()` first: a lone surrogate
  throws `Lone surrogate is not allowed`. Where the OCG policy path would I-JSON-reject the same
  input, the gate classifies the vendor outcome in the shrink-only baseline under the gate's
  existing classes; it is a documented upstream rule, not a divergence in number serialization.
- NaN/Infinity throw (`NaN is not allowed` / `Infinity is not allowed`).
- The file depends on `String.prototype.isWellFormed` (ES2024, Node ≥ 12.0 style polyfill-free),
  which the gate runtime provides.
