---
type: DecisionTool
title: "AI Act Procurement Clause Mapper"
description: "Maps an EU AI Act risk tier (derived from an upstream classifier such as the AI Act high-risk fit diagnostic) to the European Commission's Model Contractual AI Clauses (MCC-AI) template selection: High-Risk or Light, plus the applicable Chapter III clause set (transparency, risk management, data governance, human oversight, cybersecurity for High-Risk; a reduced set for Light). Reference mode only: MCC-AI redistribution terms are unclear, so this node selects and points to the official source rather than vendoring clause text. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-412-ai-act-procurement-clause-mapper.html
tags: ["compliance_mandate", "wave-50", "mcp:map_ai_act_procurement_clauses"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-412-ai-act-procurement-clause-mapper.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-412-ai-act-procurement-clause-mapper.html
    title: "public tool page"
---

# AI Act Procurement Clause Mapper

> Exports a decision via MCP `map_ai_act_procurement_clauses` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-412-ai-act-procurement-clause-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act High-Risk Fit & Classification Diagnostic](./art-64-ai-act-highrisk-fit-diagnostic.md)

**Feeds:** [AI Addendum Assembler](./art-411-ai-addendum-assembler.md)

## Attested computation

[executor + attester binding](../computations/art-412-ai-act-procurement-clause-mapper.md) — §10.2.
