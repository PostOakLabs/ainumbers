---
type: DecisionTool
title: "Solana DvP Pre-Funding Terms Verifier"
description: "Verifies, values-only, that a pasted Solana Foundation DvP SwapDvp record is safe to fund: owner must be the pinned DvP program id, account length exactly SwapDvp::LEN 458 bytes, and the stored terms (amount_a/amount_b, expiry, earliest, user_a/user_b, settlement_authority, both settlement destinations) must match the funder-supplied agreed deal, because CreateDvp is permissionless and a forged create with attacker destinations redirects settlement proceeds. Also applies the program windows - earliest_settlement_timestamp <= expiry, expiry <= creation + one year (fixed 365-day year), expiry in the future at a REQUIRED caller-supplied cluster timestamp (never the system clock) - the Token-2022 blocked-extension deny list (TransferFeeConfig, InterestBearingConfig, ScaledUiAmountConfig, NonTransferable, which the program rejects with BlockedMintExtension), and the 32-per-leg transfer-hook extras cap. Trusted-authority risks the program accepts as-is (PermanentDelegate, Pausable, MintCloseAuthority, mutable TransferHook, ConfidentialTransfer, DefaultAccountState/freeze authority) are surfaced as trust flags, never rejections. Values only: no RPC calls, no PDA derivation, no keys, no on-chain writes. The output is a record-vs-terms recompute, NOT legal finality and NOT proof of agreement; the Cantina audit scope mapping for this program commit is UNVERIFIED and never cited as coverage. Every constant is ported from the pinned Solana DvP clause snapshots registered in chaingraph/standard/clause-snapshot-registry.json (the DvP entries, each pinned at commit df9919ed)."
resource: https://ainumbers.co/chaingraph/art-735-solana-dvp-prefund-verifier.html
tags: ["settlement_mandate", "wave-134", "mcp:verify_solana_dvp_terms"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-735-solana-dvp-prefund-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-735-solana-dvp-prefund-verifier.html
    title: "public tool page"
---

# Solana DvP Pre-Funding Terms Verifier

> Exports a decision via MCP `verify_solana_dvp_terms` — mandate type `settlement_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-735-solana-dvp-prefund-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Token-2022 Transfer-Fee Payment Reconciler](./art-715-token2022-transfer-fee-reconciler.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-735-solana-dvp-prefund-verifier.md) — §10.2.
