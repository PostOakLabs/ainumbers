---
type: DecisionTool
title: "Arc Fit Diagnostic"
description: "12-question A–F diagnostic assessing Arc adoption fit across CPN (Circle Payments Network), StableFX 24/7 FX, DvP atomic settlement, and agentic commerce dimensions. Routes to the appropriate Arc chain. CCTP v2 routing branch fires when ≥2 dimensions score >0."
resource: https://ainumbers.co/chaingraph/art-42-arc-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-10", "mcp:run_arc_fit_diagnostic"]
timestamp: 2026-07-14
---

# Arc Fit Diagnostic

> Exports a decision via MCP `run_arc_fit_diagnostic` — mandate type `agent_guardrail_mandate`.

**Context:** Arc mainnet live 2026. No regulatory deadline for diagnostic tooling.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-42-arc-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Arc CPN Corridor Economics Model](./art-43-arc-cpn-model.md), [Arc StableFX RFQ Economics Model](./art-44-arc-stablefx-model.md), [Arc xReserve Config Linter](./art-45-arc-xreserve-linter.md), [Arc Paymaster Economics Model](./art-46-arc-paymaster-model.md), [Arc CCTP v2 Transfer Validator](./art-47-arc-cctp-transfer.md)
