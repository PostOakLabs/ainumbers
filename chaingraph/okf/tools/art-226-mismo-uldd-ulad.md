---
type: DecisionTool
title: "ULDD/ULAD Structural Linter"
description: "ULDD Phase 5 / ULAD structural lint of required data points, enumerations, and conditionality rules. Checks field presence against ULDD Phase 5 required set, validates enum values from the public Fannie Mae ULDD Phase 5 Data Stencil and Freddie Mac ULAD Data Dictionary v1.3, enforces ARM-conditional fields, range constraints, and indicator consistency. ULDD Phase 5 mandate effective 2025-07-28. Inputs are bounded structural fields only; loan PII never leaves the browser. Lints public ULDD/ULAD data dictionaries only; does not embed or validate against the membership-licensed MISMO v3.x Reference Model schema. Table version: ULDD-PHASE5-ULAD-1.3-2025-07-28."
resource: https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.html
tags: ["compliance_mandate", "wave-38", "mcp:lint_mismo_uldd_ulad"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-226-mismo-uldd-ulad.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.html
    title: "public tool page"
---

# ULDD/ULAD Structural Linter

> Exports a decision via MCP `lint_mismo_uldd_ulad` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-226-mismo-uldd-ulad.md) — §10.2.
