---
type: DecisionTool
title: "AI Addendum Assembler"
description: "Assembles a Common Paper AI Addendum (Version 1.0, CC BY 4.0) from your Cover Page Key Terms: whether Provider may Train Models on Customer data, whether Provider may use data for non-training improvement, data retention window, output ownership, and AI sub-processor disclosure. The Standard Terms body is vendored verbatim and never modified; only the Cover Page varies. Emits the assembled addendum plus a contract-api.json variable map twin for agent consumption. Party identity, signatures, and notice addresses stay as literal placeholder tokens for your own off-platform signing flow. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-411-ai-addendum-assembler.html
tags: ["compliance_mandate", "wave-50", "mcp:assemble_ai_addendum"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-411-ai-addendum-assembler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-411-ai-addendum-assembler.html
    title: "public tool page"
---

# AI Addendum Assembler

> Exports a decision via MCP `assemble_ai_addendum` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-411-ai-addendum-assembler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AI Act Procurement Clause Mapper](./art-412-ai-act-procurement-clause-mapper.md)

**Feeds:** [DPA Article 28 Completeness Checker](./art-409-dpa-art28-completeness-checker.md)
