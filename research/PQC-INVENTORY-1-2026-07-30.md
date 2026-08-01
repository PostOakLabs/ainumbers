# PQC-INVENTORY-1 — what our own corpus signs and proves with

WU: `PQC-INVENTORY-1`. Contract: `PQC-READINESS-BUILD-SPEC.md`. Script:
`repo/scripts/pqc-inventory.mjs` (re-runnable — `node scripts/pqc-inventory.mjs` from `repo/`, or
`--json` for machine output). Test: `repo/scripts/pqc-inventory.test.mjs`.

**Scope: the site repo only (`PostOakLabs/ainumbers`, this checkout).** The estate spans four repos
(site, `mcp-apps-poc/`, `helm/`, `anchor-suite/`); this is v1 and it does not claim to have measured the
other three. **Nothing was changed.** No algorithm swapped, nothing re-signed, no `execution_hash` moved,
no `chaingraph.json` edit, no kernel edit, no page shipped to the site.

## Get the cryptography right first

1. **Shor breaks signatures and pairings.** Ed25519, and pairing-based BN254 (therefore groth16 proofs
   over it), are the at-risk classes here.
2. **"SHA-256 is broken by quantum" is false.** Grover is a quadratic speedup, taking SHA-256 to roughly
   128-bit collision resistance — still acceptable under current NIST guidance. Neither SHA-256 nor SHA3
   is flagged at-risk anywhere below.
3. **"Harvest now, decrypt later" does not apply — this estate encrypts nothing.** The real exposure is
   narrower and worth stating precisely: a signature made today can be *forged* later, once the algorithm
   it rests on falls. That is why it matters specifically for evidence with a multi-year retention duty —
   the retention outlives the assumption the signature rests on.

## The hypothesis (§2.2), confirmed

A 2026-07-30 grep found ML-DSA/Dilithium inside `chaingraph/kernels/_proof.mjs` (dozens of matches, plus
the SHA3 the algorithm needs internally) while `chaingraph/verify.html` — the public verifier — showed
only Ed25519 and SHA-256. The grep suggested the PQC capability exists in the shared kernel library while
the public verifier never uses it.

**Traced, not assumed.** `pqc-inventory.mjs` parses `verify.html` directly and checks: does it import
`_proof.mjs`? Does it mention `mldsa`/`dilithium` anywhere? What WebCrypto algorithm names does it
actually pass to `crypto.subtle.sign/verify/generateKey/importKey`?

```
imports_proof_mjs=false  mentions_mldsa=false  ed25519_calls=3  sha256_calls=2
```

`verify.html` signs/verifies with WebCrypto **Ed25519** for `audit_signature` and WebCrypto **SHA-256**
for `execution_hash`, full stop. It does not import `_proof.mjs` and contains no ML-DSA/Dilithium
reference of any kind.

Separately: the ML-DSA-65 signer in `_proof.mjs` (`mldsaSign`/`mldsaVerify`/`mldsaKeygen`) was searched
for as a *caller*, not just a grep hit, across `repo/scripts/*.mjs`, `repo/chaingraph/*.html`, and
`repo/chaingraph/kernels/*.mjs`. The only two files that reference those names are `_proof.mjs` itself
(the definition) and its own unit test, `chaingraph/kernels/proof-binding.test.mjs`. **No production
caller exists.**

**Hypothesis CONFIRMED.** The PQC (ML-DSA-65) signer is present in the shared kernel library and covered
by its own unit test, but nothing in the production path — no art page, no verifier, no generator script
— ever calls it. This is the same "it exists and nothing reads it" shape found twice already the same
week ([[project-ainumbers-helm-data-binding]]).

## Reachable vs present-only

What a **produced artifact is actually signed/proved with**, separately from what the code *could* do:

| Surface | Algorithm | Class | Reachable? |
|---|---|---|---|
| `chaingraph/kernels/_proof.mjs` — `eddsa-jcs-2022` proof signer | Ed25519 | at-risk | **yes** — this is the production `audit_signature` path |
| 480 `chaingraph/art-*.html` pages | Ed25519 (byte-pinned copy of the above) | at-risk | **yes** — 196 of 480 carry the pin (the rest don't sign at all; see below) |
| `chaingraph/verify.html` — `audit_signature` check | Ed25519 (WebCrypto native) | at-risk | **yes** |
| `chaingraph/verify.html` + `_hash.mjs` — `execution_hash` | SHA-256 | **acceptable** | **yes** |
| 307 `chaingraph/kernels/fixtures/compute-proof/*.receipt.json` (§18 zkVM receipts, `gpu:true` kernels, risc0) | groth16-bn254 | at-risk | **yes** — all 307 fixtures use this format |
| `_proof.mjs` — §PQC-1 hybrid ML-DSA-65 proof (vendored FIPS 204 / `@noble/post-quantum`) | ML-DSA-65 (Dilithium) | **pqc** | **no** — present in code + unit-tested, zero production callers |
| `_proof.mjs` — SHA3/SHAKE256 (internal to the ML-DSA implementation) | SHA3-256 / SHAKE256 | **acceptable** | no — only exercised if the ML-DSA path above is, and it isn't |

**Two answers that differ IS the headline, and they differ:** the shared library can produce a
post-quantum-safe proof today (ML-DSA-65, FIPS 204, vendored and unit-tested), but every artifact this
estate has ever actually produced — all 480 `art-*` pages, the public verifier, and all 307 zkVM compute
receipts — is signed or proved with an algorithm that a cryptographically relevant quantum computer
breaks (Ed25519 by Shor directly; groth16-bn254 because Shor breaks the BN254 pairing it's built on).

One more split worth naming precisely: of the 480 `art-*.html` pages, only 196 carry the Ed25519 proof
pin at all — the other 284 are read-only/diagnostic tools with no `audit_signature` to forge in the first
place, so they carry no signature-algorithm risk (they still hash with SHA-256, which is fine per
correction #2).

## What this is not

No coverage percentage, no single readiness score. A score is a number this estate would then have to
keep true forever, and it invites exactly the kind of unearned marketing claim the estate's whole
positioning is built to reject (`PQC-READINESS-BUILD-SPEC.md` §2.4, §0). This is a named list instead:
six surfaces, each with an algorithm, a classification, and a reachability answer. Re-run
`node scripts/pqc-inventory.mjs` any time to regenerate it against the current tree.

## What v1 does not answer

Whether to build a customer-facing PQC-readiness surface at all — that decision is explicitly deferred to
after this measurement, per `PQC-READINESS-BUILD-SPEC.md` §0. This document only answers "what do *we*
sign and prove with today," which was the prerequisite Tim set before considering that question.
