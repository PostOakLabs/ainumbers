# AINumbers.co — Kernel Longevity Statement

This document records the decisions that support long-term verifiability of
AINumbers.co OpenChainGraph (OCG) artifacts. It covers the tools surface,
the compute engine, the determinism and parity guarantees, scheduled
maintenance dates, and the succession path if infrastructure is unavailable.

---

## 1. Browser tools surface

All tools published at ainumbers.co target the
[Baseline Widely Available](https://web.dev/baseline) feature set as of each
tool's publication date. No JavaScript API is used that was not already in
Baseline Widely Available at the time the tool shipped. This means any browser
released after the tool's publication date should run it without polyfills,
flags, or extensions.

Tools are static HTML files with no server-side render step and no runtime
dependency on ainumbers.co infrastructure. A cached copy (archive.org, CDN
snapshot, local save) is sufficient to run any tool.

---

## 2. Kernel engine statement

OCG kernels (`chaingraph/kernels/*.kernel.mjs`) are pure ECMA-262 ES2022
modules. Their `compute()` functions restrict themselves to the minimum common
API surface defined by ECMA-429 (Test262 conformance baseline): arithmetic,
string operations, array/object manipulation, JSON, and standard Math. No
DOM, no network, no filesystem, no Web APIs.

Specifically:

- **No locale-sensitive constructs.** `toLocaleString`, `Intl.*`,
  `localeCompare` (no-arg), `toLocaleLowerCase/UpperCase`, `normalize`, and
  Unicode property escapes (`\p{...}`) are hard-banned by the determinism lint
  gate (`scripts/check-kernel-determinism.mjs`). The gate runs on every push.
  Locale-sensitive number formatting is replaced by the `fmtEnUS()` pure-JS
  helper (verified equivalent to V8 `(n).toLocaleString('en-US')` over 105k+
  values).

- **No time-dependent constructs.** `Date.now()`, no-arg `new Date()`,
  `performance.now()`, `Math.random()`, `WeakRef`, `FinalizationRegistry`, and
  `process.*` are banned by the same gate.

- **Transcendental Math.** `Math.exp`, `log`, `sin`, `cos`, `tan`, `pow`,
  and related functions are engine-approximated (IEEE 754-2008 permits
  implementation-defined precision for these). The 12 kernels that use them
  are listed in `scripts/kernel-determinism-allowlist.json`. For those kernels,
  the §17 source digest and §18 groth16-bn254 proof are produced by the
  universal QuickJS-ng guest (ImageID `a1a0bc89`). The cross-engine parity CI
  (`cross-engine-parity.yml`) empirically confirms Node/Bun/QuickJS produce
  identical outputs for all current fixture vectors.

---

## 3. Determinism and parity gates

Two automated gates enforce the engine-invariance properties above. Both run
on every push and pull request. Neither has a scheduled/cron trigger.

| Gate | Script | What it checks |
|------|--------|----------------|
| Kernel determinism lint | `scripts/check-kernel-determinism.mjs` | Hard-bans locale/time/random/env-sensitive constructs in every `*.kernel.mjs`; allowlists the 12 transcendental kernels |
| Cross-engine parity | `.github/workflows/cross-engine-parity.yml` | Runs every kernel's fixture vectors through `compute()` on Node 20, Bun 1.2.18, and QuickJS-ng v0.9.0; diffs the SHA-256 manifests byte-for-byte; divergence = a finding |

The parity workflow uses a pure-JS SHA-256 (no WebCrypto, no `node:crypto`)
so the digest function itself is identical across all three engines.

---

## 4. Scheduled maintenance dates

The following items require attention before their stated dates. These are
plain calendar entries, not automated jobs.

### TSA certificate expiries

OCG anchor bindings (SPEC.md §20) use RFC 3161 timestamps from external
timestamp authorities. The trust anchor roots expire on:

| Authority | Root expiry | Notes |
|-----------|-------------|-------|
| GitHub TSA | **2033-08-04** | First to expire; monitor after 2030 |
| Sigstore root | **2035-04-06** | OIDC-backed; watch Sigstore CT log |
| FreeTSA | **2041-03-07** | ECDSA-P384 root; check for cert rotation |
| DigiCert | **2038-01-15** | Intermediate chain; verify full chain |
| Sectigo | **2046-03-21** | Longest-lived of the current set |

Source: `anchor-suite/ROOTS.md`. Check pinned root PEM files when any
intermediate in the chain is renewed; the SHA-256 fingerprint in ROOTS.md
and in the worker's `VENDORED.md` must stay current.

### RFC 4998 guidance

RFC 4998 (Evidence Record Syntax) recommends refreshing timestamps before
the outermost TSA certificate expires. For each sealed artifact, create a
renewal timestamp at least 6 months before the earliest expiring TSA root
in its anchor chain. The first renewal window opens around **2033-02-04**
(6 months before the 2033-08-04 GitHub TSA root expiry).

### Cryptographic algorithm margin

The OCG §18 compute-integrity proof uses the BN254 (alt-bn128) elliptic
curve with the groth16 proving system. BN254 offers approximately 100 bits
of security. It is the curve supported by EVM precompiles (EIP-196/197) and
widely deployed in production ZK systems.

At current cryptanalytic progress, 100 bits provides substantial margin
against classical adversaries. BN254 is likely to be the first element in
the OCG trust stack to weaken. Post-quantum migration of the proof system
is planned as a separate workstream; no date is set. Operators who require
post-quantum assurance today should treat the §18 proof as integrity evidence
rather than a quantum-resistant commitment.

---

## 5. Succession: keeping verification alive

An OCG artifact can be verified indefinitely without any ainumbers.co
infrastructure if the following are available:

1. **The artifact JSON** (the `.json` or `.ocg.json` file).
2. **The verifier bundle** for the kernel that produced it. Sealed verifier
   bundles (Phase I Session B) embed the kernel's `compute()` function,
   `cgCanon`, the pure-JS SHA-256, and the §17 source digest inline. No
   network call is required. The bundle runs in any ECMA-262 engine published
   after 2022.
3. **The §18 RISC Zero proof** (stored in `anchor_bindings[].proof` or in
   the proof sidecar file). Verification requires the RISC Zero verifier
   library (MIT-licensed, Rust; embeds BN254 verification) and the universal
   guest ImageID `a1a0bc89`. Neither requires ainumbers.co to be reachable.
4. **At least one live TSA** from the anchor chain list above (for re-stamping
   before root expiry). After the sealed verifier bundle exists, this becomes
   the only live-infrastructure dependency.

An operator who archives artifact JSON + verifier bundle + proof sidecar
+ TSA root PEMs can verify any OCG artifact years after publication, without
contacting ainumbers.co, GitHub, or any cloud service, as long as the
cryptographic algorithms remain unbroken.

---

*Last updated: 2026-07-02. Review this document when: a new TSA root is added
or rotated; a new cryptographic primitive is introduced in the OCG spec; or
the §18 universal guest ImageID changes.*
