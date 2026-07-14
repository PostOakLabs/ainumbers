---
type: DecisionTool
title: "Arc CCTP v2 Transfer Validator"
description: "Validates a CCTP v2 cross-chain USDC transfer for domain pair eligibility, Fast Transfer 30-second finality risk (LP availability), Hook payload safety, CCTP v1 sunset migration status (31 Jul 2026), and large-notional LP-depth risk. 6 checks, A–F grade. 13 CCTP v2 domains as of Oct 2025."
resource: https://ainumbers.co/chaingraph/art-47-arc-cctp-transfer.html
tags: ["settlement_mandate", "wave-10", "mcp:validate_cctp_v2_transfer", "iso20022:pacs.009"]
timestamp: 2026-07-14
---

# Arc CCTP v2 Transfer Validator

> Exports a decision via MCP `validate_cctp_v2_transfer` — mandate type `settlement_mandate`.

**Deadline:** 2026-07-31 — CCTP v1 manual relay phase-out begins 31 Jul 2026 (Circle announcement). All v1 integrations must migrate.

**Semantic profile:** `iso20022:pacs.009` (ISO 20022-aligned)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-47-arc-cctp-transfer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Arc Fit Diagnostic](./art-42-arc-fit-diagnostic.md)

**Feeds:** _terminal node_
