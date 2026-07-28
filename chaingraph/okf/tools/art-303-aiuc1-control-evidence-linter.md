---
type: DecisionTool
title: "AIUC-1 Control Evidence Linter"
description: "Lints a supplied control-evidence bundle against the 23 automatable AIUC-1 v2026-Q1 controls (pillars A-F): version-guards the catalog, classifies each automatable control receipt-backed, attestation-only, or missing, and reports per-pillar and overall coverage. The ~26 procedural AIUC-1 controls are structurally out of automatable scope and are reported as such, never claimed covered. Asserts the supplied evidence replays to this coverage score; never that any control is certified, and never an AIUC/underwriter endorsement. Not the same as an underwriting decision or a policy-selling tool. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-303-aiuc1-control-evidence-linter.html
tags: ["compliance_mandate", "wave-54", "mcp:lint_aiuc1_control_evidence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-303-aiuc1-control-evidence-linter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-303-aiuc1-control-evidence-linter.html
    title: "public tool page"
---

# AIUC-1 Control Evidence Linter

> Exports a decision via MCP `lint_aiuc1_control_evidence` — mandate type `compliance_mandate`.

**Context:** AIUC-1 churns quarterly (2026-Q1 catalog pinned); a version mismatch REFUSES scoring rather than silently scoring against a stale catalog.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-303-aiuc1-control-evidence-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [AIUC-1 Evidence Pack Assembler](./art-304-aiuc1-evidence-pack-assembler.md)
