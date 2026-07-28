---
type: DecisionTool
title: "EU AI Act Art. 50 Marking Checker"
description: "Check c2pa.actions for a c2pa.created action whose IPTC digitalSourceType is in the AI set, and that machine-readable marking is present (Art. 50(2) adequacy). For deepfakes also requires Art. 50(4) disclosure. Penalty: 15M EUR / 3% global turnover. Applies 2 August 2026."
resource: https://ainumbers.co/chaingraph/art-126-ai-act-art50-marking-checker.html
tags: ["compliance_mandate", "wave-23", "mcp:check_ai_act_art50_marking"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-126-ai-act-art50-marking-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-126-ai-act-art50-marking-checker.html
    title: "public tool page"
---

# EU AI Act Art. 50 Marking Checker

> Exports a decision via MCP `check_ai_act_art50_marking` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-126-ai-act-art50-marking-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Dual-Layer Disclosure Verifier](./art-127-dual-layer-disclosure-verifier.md)
