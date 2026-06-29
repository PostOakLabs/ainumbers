# Compute-Integrity Proofs (OCG §18): verify a computation without re-running it

*A plain-language explainer of how OpenChainGraph proves that a result really came from the published logic — and how you can check it, or reproduce it, yourself.*

> Publishing note: this is the public-facing content. To ship on the site, render it as a styled page (e.g. `repo/chaingraph/zkvm-explainer.html`) using the site design system, cross-linked from the spec + whitepaper. The text below is the source of truth.

---

## The problem

Every OpenChainGraph (OCG) tool runs a deterministic calculation — a compliance check, a risk score, a settlement decision — and stamps the result with an `execution_hash`. The hash lets anyone confirm two results are identical. But a hash alone doesn't prove *which code produced it*, or that it ran honestly. You'd have to re-run the tool yourself and trust your own copy.

**§18 Compute-Integrity closes that gap.** It attaches a small cryptographic proof to a result that says: *"the published kernel, on these inputs, really produces exactly this output."* Anyone can check the proof in milliseconds, with no network call, without re-running the calculation, and without trusting our servers.

---

## Why it's different from the alternatives

Most "verifiable AI/compute" in 2026 leans on one of two trust anchors:
- **Secure hardware (TEE / confidential compute):** you trust a chip vendor's attestation.
- **A blockchain:** you trust a token-incentivized validator network and consensus.

OCG §18 uses **neither**. The trust anchor is **reproducible determinism plus a zero-knowledge proof**:
- The kernels are deterministic — the same inputs always produce the same output, bit for bit, in any correct runtime.
- A zero-knowledge virtual machine (zkVM) runs the kernel and produces a tiny proof that the run was faithful.
- **Verification is pure math** — a self-contained pairing check. No hardware to trust, no chain in the verify path, no network. Optionally, the proof can confirm the output without revealing the inputs.

That makes the result checkable by a regulator, a counterparty, or an auditor on an air-gapped laptop.

---

## How it works (the short version)

1. **One universal guest.** A single zkVM program (a "guest") embeds a deterministic JavaScript engine. It takes the kernel's source code and the inputs, runs the calculation, and records in its public output (the "journal"): the **hash of the kernel source**, the **output**, and the **standard version**.
2. **Proving (done once, off-line).** A prover runs the guest and produces a STARK receipt, then wraps it into a compact **Groth16 proof over the BN254 curve** — about 200 bytes. This is the heavy step; it happens out-of-band, never in your browser and never on our request path.
3. **Publishing.** Each tool publishes the guest's **ImageID** (a fingerprint of exactly which guest program ran) alongside the kernel's source hash. The proof is attached to the result's artifact (it does not change the `execution_hash`).
4. **Verifying (instant, anywhere).** Anyone checks the Groth16 proof against the published ImageID with a self-contained verifier. If it passes, the published kernel really produced that output.

Because the kernel source is an *input* to the guest (not baked in), **one ImageID covers every tool** — and every future one.

---

## Verify it yourself (the easy path — no toolchain needed)

You do **not** need any of the proving machinery to *check* a proof. You need only the artifact, the published ImageID, and the self-contained verifier.

- The verifier lives at `repo/chaingraph/kernels/_computeproof.mjs`. It uses a vetted, zero-dependency curve library (`@noble/curves`, BN254) and does a single pairing check. No network, no install beyond Node (or it runs in a browser).
- Steps:
  1. Take any OCG artifact that carries `audit_signature.compute_proof` (a `groth16-bn254` receipt).
  2. Look up that tool's published `compute_images[]` ImageID in `chaingraph.json`.
  3. Call the verifier's `verifySeal(receipt, imageId)`. It returns true only for a genuine proof of that exact output; it rejects a tampered output or a wrong journal.

That's the whole trust story for a consumer: **one pairing check, offline, against a public fingerprint.**

---

## Prove it yourself (the harder path — optional, for the fully skeptical)

If you want to *generate* proofs — or independently confirm that the published ImageID corresponds to the published guest source — you run the prover. This needs a real toolchain (it cannot be faked, and it cannot run on a Node-only machine).

**Environment** (Linux, or Windows via WSL on an ext4 filesystem):
- Rust (`rustc` 1.96.x)
- RISC Zero toolchain: `rzup` / `cargo-risczero` and `r0vm` (3.0.5)
- Docker (for the STARK→Groth16 wrap)
- Recommended: a GPU. The full AINumbers suite proved on an RTX 3080 in a few hours; per-tool wrap is on the order of minutes. No GPU? Use a proving network (Boundless, or Succinct at roughly a few cents per proof) — but note proving networks are a *proving* convenience only and never participate in verification.

**Steps:**
1. **Rebuild the guest → confirm the ImageID.** Build the published guest (`repo/chaingraph/kernels/_runner/`) with the pinned toolchain. You should get the **same ImageID** we published. This is the keystone: a matching ImageID means you have independently confirmed *exactly which program* runs your computation.
2. **Run a real prove.** With `RISC0_DEV_MODE=0` (real proving — dev mode produces a fake receipt and is never acceptable), run the guest on a kernel's source plus your inputs. You get a STARK receipt; wrap it to `groth16-bn254`.
3. **Check the journal.** Confirm the journal's `output` equals what the JavaScript kernel produces for the same inputs (run it in Node and compare byte-for-byte). They match — that's the point.
4. **Verify your own receipt** with the same self-contained verifier from the easy path.

**One honest caveat on floating point.** Library/transcendental functions (`exp`, `log`, `pow`, `sin`, …) are not bit-reproducible across engines, so OCG routes those through a shared deterministic math library so the proof, the browser, and the server all agree to the last bit. The basic operations (`+ − × ÷ √`) are already exact per IEEE-754.

---

## Why reproducing the ImageID is the whole point

The ImageID is a cryptographic fingerprint of the guest program. If you rebuild the guest from public source with the pinned toolchain and get the same ImageID we published, you have proven — to yourself, trusting no one — that the proofs you verify were produced by the code you can read. That's the difference between *"trust our attestation"* and *"check it yourself."*

---

## Further reading
- OCG Standard, §17 (Kernel Identity Binding) and §18 (Compute-Integrity Proof): `repo/chaingraph/standard/SPEC.md`.
- The guest, ImageID, and verifier: `repo/chaingraph/kernels/_runner/`, `chaingraph.json` `compute_images[]`, `repo/chaingraph/kernels/_computeproof.mjs`.
- Background: EF zkVM Standards v0 (RV64IM); RISC Zero receipts (journal + seal); zk software-provenance via running an interpreter in a zkVM (arXiv:2602.11887).

*OCG §18 is software- and cryptography-only: no trusted hardware, and no blockchain in the verify path.*
