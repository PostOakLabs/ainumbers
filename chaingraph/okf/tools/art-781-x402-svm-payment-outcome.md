---
type: DecisionTool
title: "x402 Exact Solana Payment Outcome Recompute"
description: "Clause-by-clause verdict recompute of an x402 exact-scheme Solana payment from pasted values: the decoded instruction list, the PaymentRequirements, the mint's declared token program and fee configuration, and optional Ed25519 signature checks over caller-pasted bytes. Spec readings are pinned at x402-foundation/x402 (the canonical repo) commit e4a086819f419e9395acbbdc1679fe6627029ff7, specs/schemes/exact/scheme_exact_svm.md, and reference readings at the same commit's TypeScript facilitator (scheme.ts, smartWalletVerification.ts). Each clause reports what the spec text accepts, what the reference code accepts, and a verdict of PASS, FAIL or DIVERGES where the readings disagree: the amount rule (the spec outcome accepts overpayment while the static path rejects any inequality, scheme.ts L1160), the single-matching-transfer rule, the destination ATA recomputed under both token programs, fee payer isolation, the net amount on a Token-2022 transfer-fee mint, the memo rule and transaction-version admission. Two Kora advisories name exactly these seams (GHSA-725g-w329-g7qr, GHSA-x442-m7cc-hr92; severity field medium on both records) and are cited as facts. Values only, no wording about risk or intent. Zero network, zero RPC, nothing on-chain is read, no facilitator is called, no balance is looked up."
resource: https://ainumbers.co/chaingraph/art-781-x402-svm-payment-outcome.html
tags: ["compliance_mandate", "wave-139", "mcp:verify_x402_svm_outcome"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-781-x402-svm-payment-outcome.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-781-x402-svm-payment-outcome.html
    title: "public tool page"
---

# x402 Exact Solana Payment Outcome Recompute

> Exports a decision via MCP `verify_x402_svm_outcome` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline: this node recomputes pasted payment values, it does not carry a dated obligation.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-781-x402-svm-payment-outcome.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context): a per-clause verdict table with the pinned spec reading, the pinned reference reading and a verdict of PASS, FAIL or DIVERGES for each clause, plus the recomputed recipient ATAs under both token programs and the net received amount after any declared transfer fee.
