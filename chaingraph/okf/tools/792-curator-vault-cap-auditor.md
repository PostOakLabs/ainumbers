---
type: DecisionTool
title: "Curator Vault Cap Auditor"
description: "Audits a vault curator's point-in-time allocation snapshot against per-market caps and a declared mandate, from caller-declared minor-unit values only. Caps follow the pinned Morpho curation documentation semantics: an absolute cap is a fixed maximum amount per market and a relative cap is a maximum share of the vault's total assets, compared by exact integer cross-multiplication with no division; caps are allocation-time constraints, so an audit legitimately reports observed breaches on a snapshot. The kernel also checks the declared mandate (per-market, per-asset-class, idle floor, RWA floor, DeFi ceiling), reports concentration (largest market share and a Herfindahl index in basis points), idle-plus-withdrawable coverage of pending redemptions, and conservation (idle plus allocations equals total assets). Verdicts: WITHIN_MANDATE, WITHIN_MANDATE_WITH_WARNINGS or BREACH. Scope limits: no on-chain reads and no pricing: share pricing is the art-610 (ERC-4626 share math) domain and async redemption state is the art-611 (ERC-7540 request accounting) domain; asset classes are a fixed declared enum; relative-cap on-chain rounding and id-granularity encoding are code details shipped caller-declared, excluded here; profiles are morpho_vault_v2 (documented semantics) or generic (caller-declared); no curator or platform is named."
resource: https://ainumbers.co/chaingraph/792-curator-vault-cap-auditor.html
tags: ["compliance_control", "wave-141", "mcp:audit_curator_vault_caps"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/792-curator-vault-cap-auditor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/792-curator-vault-cap-auditor.html
    title: "public tool page"
---

# Curator Vault Cap Auditor

> Exports a decision via MCP `audit_curator_vault_caps` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/792-curator-vault-cap-auditor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/792-curator-vault-cap-auditor.md) — §10.2.
