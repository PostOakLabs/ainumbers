# Vendored crypto bytes — sha256 pin table (VENDOR-DIGEST-GATE-1)

The kernels that decide whether a proof, cosignature or zkVM seal **verifies** run on vendored
crypto bytes committed in this repo — no CDN, no runtime npm. Until this table existed those bytes
carried provenance comments but no digest gate: a green PR swapping curve code would have slid
through, and `generate.mjs` would have propagated the swap to the live worker's vendored kernels
(ESTATE-ATTACK-SURFACE SC-3, top-5 #5). `scripts/check-vendored-digests.mjs` (wired into
`scripts/preflight.mjs`, hence every CI surface that runs preflight) recomputes the sha256 of every
row below from the in-tree bytes on each push: any byte that moves without this table moving in the
same push is RED, naming the file.

## Digest-change protocol — an upgrade is one PR, visible, never impossible

1. Bump the upstream pin (package@version) in the vendoring build; rebuild/refetch the vendored
   bytes into the tree.
2. Update this table's row **in the same PR**, quoting the new upstream pin — package@version plus,
   where retrievable, the upstream integrity value (npm `dist.integrity` sha512 from the registry,
   or the exact upstream commit) — in both the row and the PR body.
3. The gate goes green again exactly when tree bytes and table agree. A swap can never land
   silently; an intentional one is a visible, line-by-line reviewable diff. Never edit the vendored
   bytes without the table, and never edit the table to match an unexplained byte change.

## Scope and layering

- **In scope:** the vendored noble crypto bytes — every `chaingraph/kernels/_noble-*.bundle.mjs`
  (enumerated live by the gate, so a NEW noble bundle with no row is itself a RED) plus
  `chaingraph/kernels/_proof.mjs`, whose §PQC-1 vendored blocks (ML-DSA-65 from FIPS 204 and
  SLH-DSA from FIPS 205) are inlined noble code. The `_proof.mjs` row pins the WHOLE file: any edit
  anywhere in it — including the vendored blocks — trips the digest. The per-package pins and
  extents of the inlined blocks are documented in `_proof.mjs`'s own headers.
- **Out of scope (deliberately):** first-party code and first-party derived copies
  (`_computeproof.mjs` is OCG-authored and gated by its own unit suite; `_proof.inline.min.js` /
  `_signverdict.inline.js` are first-party minified derivations using WebCrypto, not vendored
  upstream bytes), and the non-crypto `_*.bundle.mjs` helpers (`_amort`, `_detmath`, `_dtree`,
  `_ruleversion`) — this row's fence is the crypto verification path.
- **Layering vs the worker's `check-vendor-fresh.mjs`:** the worker gate (mcp-apps-poc, worker CI)
  asserts worker-vendored-bytes **== SITE bytes** — an equality check whose baseline is this tree.
  If these bytes were swapped on the site side, that gate goes green again the moment the worker
  re-vendors; it cannot detect a site-side swap. THIS table is the missing anchor: site bytes ≡
  pinned sha256. Together: pinned(site) ∧ worker==site ⇒ worker ≡ pinned. This is the
  anchor-suite `VENDORED.md` + freshness-gate pattern, replicated for the site repo.

## Pin table

SHA-256 values are over the exact in-tree bytes (repo enforces LF, so the digest is
platform-stable). "Retrieved" is the git date the bytes first landed (and, where the current bytes
postdate the first vendor, the date they last changed). All upstream pins re-verified live against
the npm registry on 2026-09-03 (row-level notes below).

| File | Upstream | Version / pin | License | Retrieved | SHA-256 (in-tree bytes) |
|---|---|---|---|---|---|
| `chaingraph/kernels/_noble-bn254.bundle.mjs` | @noble/curves + @noble/hashes (paulmillr.com), esbuild-bundled into one ESM module exporting `{ bn254, sha256 }`; used by `_computeproof.mjs` (§18 Groth16-BN254 seal verifier) | @noble/curves@2.2.0 + @noble/hashes@2.2.0 (npm dist tarballs). Registry `dist.integrity` re-verified 2026-09-03: curves `sha512-T/BoHgFXirb0ENSPBquzX0rcjXeM6Lo892a2jlYJkqk83LqZx0l1Of7DzlKJ6jkpvMrkHSnAcgb5JegL8SeIkQ==`, hashes `sha512-IYqDGiTXab6FniAgnSdZwgWbomxpy9FtYvLKs7wCUs2a8RkITG+DFGO1DM9cr+E3/RgADRpFjrKVaJ1z6sjtEg==` | MIT (Paul Miller) | 2026-06-27 (PR #74); unchanged since | `d389cfa8eb9081831b29c2c187ab4ebde9609be7afd8fd910359b65d13a65f8c` |
| `chaingraph/kernels/_noble-ed25519.bundle.mjs` | @noble/curves (ed25519 EdDSA verify path, ZIP-215) + @noble/hashes (sha2: sha256/sha512), IIFE-flattened; function bodies byte-identical to the pinned npm dist | @noble/curves@2.2.0 + @noble/hashes@2.2.0 (npm dist tarballs). Registry `dist.integrity` re-verified 2026-09-03 and matches the values quoted in the file header: curves `sha512-T/BoHgFX…SeIkQ==`, hashes `sha512-IYqDGiTX…jtEg==` (full values in the file header) | MIT (Paul Miller) | 2026-08-07; current bytes 2026-08-11 (FV-ED25519-NOBLE-1) | `a2fb63ed8ebe8b3a6107ce85dac25079742f6cd5f0256e968364345c7a55efad` |
| `chaingraph/kernels/_noble-secp256k1.bundle.mjs` | @noble/curves (secp256k1 ECDSA verify path) + @noble/hashes (sha3/keccak, sha2, hmac), flattened with documented same-name disambiguations; function bodies byte-identical to the pinned npm dist | @noble/curves@2.2.0 + @noble/hashes@2.2.0 (npm dist tarballs), same pin family as the bn254 bundle. Registry `dist.integrity` re-verified 2026-09-03 (values above, quoted in full in `_noble-ed25519.bundle.mjs`'s header) | MIT (Paul Miller) | 2026-08-07 (FINP2P-VERIFY-BUILD-1, PR #1029); unchanged since | `d78eaa899c994f51dfad7ab474aae1202326c490765f24245b17b53e0a9ddaeb` |
| `chaingraph/kernels/_proof.mjs` | Inlined noble blocks inside first-party OCG §16/§PQC-1 code: (a) ML-DSA-65 (FIPS 204) from @noble/post-quantum (ml-dsa.js, _crystals.js, utils.js) + @noble/hashes (sha3/_u64/utils) + @noble/curves (abstract/fft.js), landed 2026-07-19 (CW-2, PR #435); (b) SLH-DSA (FIPS 205) from @noble/post-quantum (slh-dsa.js) + @noble/hashes (_md/sha2/hmac), landed 2026-08-14 (PQC-REANCHOR-BUILD-1, PR #1247). Row pins the WHOLE file | @noble/post-quantum@0.6.1 + @noble/hashes@2.2.0 + @noble/curves@2.2.0 (npm dist tarballs). Registry `dist.integrity` re-verified 2026-09-03: post-quantum `sha512-+pormrDZwjRw05U8ADK4JpHejo87+gBd+muRBB/ozztH5yhDLMDF4jHQWN3NQQAsu1zBNPWTG0ZwVI0CR29H0A==`; hashes/curves values as in the rows above | MIT (Paul Miller) for the vendored blocks; OCG code is this repo's | (a) 2026-07-19; (b) 2026-08-14 | `f105954e77e285a412256ca193d4b0426fc828caa54f9458b56a64012a529b41` |

## Provenance honesty notes (what the 2026-09-03 fresh verification did and did not establish)

- **Verified live:** all six pinned packages exist on the npm registry at the pinned versions, are
  MIT-licensed, and the two sha512 tarball-integrity values quoted in the bundle headers
  (`_noble-ed25519.bundle.mjs`) match the registry byte-for-byte. The `@noble/post-quantum@0.6.1`
  integrity above is recorded fresh from today's registry read — `_proof.mjs`'s header does not
  quote one, so there was nothing to re-match.
- **Cross-checked:** the site's `_noble-bn254.bundle.mjs` hashes to the same sha256 recorded for
  the same-named file in anchor-suite's `VENDORED.md` (which vendors it from the worker's OCG embed
  bundle) — independent confirmation of worker↔site byte equality for that artifact.
- **Honestly NOT upstream-retrievable:** no upstream artifact is byte-identical to a bundle — each
  is a SUBSET of the pinned packages, flattened/bundled (esbuild for bn254; IIFE-flatten for
  ed25519; disambiguating flatten for secp256k1). The upstream pin + integrity establishes the
  SOURCE identity; the sha256 column pins OUR bytes — that division of labor is exactly why this
  table exists. The esbuild invocation that produced the bn254 bundle is not recorded in-tree and
  is not reconstructible from upstream today; if that bundle is ever rebuilt, the pin MUST be
  updated in the same PR per the protocol above, and the rebuild recipe documented then.
