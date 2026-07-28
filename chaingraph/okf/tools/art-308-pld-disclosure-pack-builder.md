---
type: DecisionTool
title: "PLD Disclosure Pack Builder"
description: "Assembles a disclosure/rebuttal pack for a disputed window under EU Product Liability Directive 2024/2853 (transposes 2026-12-09; AI is a \"product\"; non-disclosure or an AI Act breach triggers a rebuttable presumption of defectiveness). Collects the receipt set for the disputed window into a hash-anchored trace with replay instructions and a defectiveness-rebuttal mapping (which receipts rebut which presumption trigger: non-disclosure vs AI-Act-breach), flagging any gap in window coverage. Asserts the inputs replay to this trace; never a legal conclusion of non-defectiveness. AILD is confirmed withdrawn (Oct 2025); PLD is the only surviving EU frame this maps to. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-308-pld-disclosure-pack-builder.html
tags: ["compliance_mandate", "wave-54", "mcp:build_pld_disclosure_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-308-pld-disclosure-pack-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-308-pld-disclosure-pack-builder.html
    title: "public tool page"
---

# PLD Disclosure Pack Builder

> Exports a decision via MCP `build_pld_disclosure_pack` — mandate type `compliance_mandate`.

**Context:** National PLD transposition text lands through H2 2026; the presumption-trigger taxonomy (non_disclosure, ai_act_breach) is static and does not track member-state transposition drift.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-308-pld-disclosure-pack-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-308-pld-disclosure-pack-builder.md) — §10.2.
