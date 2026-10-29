---
type: DecisionTool
title: "Solana PDA Bump and ATA Audit"
description: "Audit of a claimed program-derived-address tuple (program id, seeds with declared encodings, bump, claimed address), pasted values only, plus Token-2022-correct associated-token-account derivation. Primary text pinned at claim: solana-labs/solana at commit 7700cb3128c1f19820de67b81aa45d18f73d2ac0, sdk/program/src/pubkey.rs (create_program_address and try_find_program_address), with the successor SDK cross-checked at anza-xyz/solana-sdk commit 021fd2f1864ab194b53498bb03c21ad1dc124b8d, address/src/derive.rs. The node recomputes the address the runtime rules yield for the claimed bump (SHA-256 over the seeds, the bump byte, the program id and the marker string ProgramDerivedAddress), tests whether the derived bytes decompress to an Ed25519 curve point (such a hash can never be a program-derived address), scans the canonical bump search space 255 down to 1 that the pinned client implementation uses, and reports whether the claimed bump is canonical and the claimed address matches. A second valid address at a non-canonical bump for the same seeds is the substitution class the node exposes as a fact: free SDK one-liners derive one address and stay silent about the other. When the optional wallet, mint and token-program triple is pasted, the node derives the associated token account under the declared token program and under the classic Token program side by side (seeds [wallet, token program id, mint] under program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL, pinned at solana-program/associated-token-account commit 4004274dfb861e09570af873b46cb0b0919e8df0), so a derivation that used the classic program for a Token-2022 mint (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb) is visible as the two addresses differing; the pinned ATA source itself deprecates the classic-only helper for Token-2022 mints. Seed limits (at most 16 seeds including the bump, each seed at most 32 bytes) are reported as facts, never silently dropped. Values only, no wording about risk or intent. Zero network, zero RPC, nothing on-chain is read."
resource: https://ainumbers.co/chaingraph/art-779-solana-pda-ata-audit.html
tags: ["compliance_mandate", "wave-138", "mcp:audit_solana_pda_ata"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-779-solana-pda-ata-audit.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-779-solana-pda-ata-audit.html
    title: "public tool page"
---

# Solana PDA Bump and ATA Audit

> Exports a decision via MCP `audit_solana_pda_ata` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline: this node audits pasted address-derivation values, it does not carry a dated obligation.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-779-solana-pda-ata-audit.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-779-solana-pda-ata-audit.md) — §10.2.
