---
type: DecisionTool
title: "Creative Commons License Chooser"
description: "Deterministic two-question decision tree mapping creator answers (waive all rights, allow commercial, allow adaptations) to the matching Creative Commons 4.0 license (CC0, CC BY, BY-SA, BY-ND, BY-NC, BY-NC-SA, BY-NC-ND). Returns license id, SPDX id, canonical deed URL, required elements, and attribution requirement. Selection only, not legal advice. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-195-creative-commons-license-chooser.html
tags: ["compliance_mandate", "wave-35", "mcp:choose_cc_license"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-195-creative-commons-license-chooser.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-195-creative-commons-license-chooser.html
    title: "public tool page"
---

# Creative Commons License Chooser

> Exports a decision via MCP `choose_cc_license` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-195-creative-commons-license-chooser.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-195-creative-commons-license-chooser.md) — §10.2.
