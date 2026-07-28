---
type: DecisionTool
title: "License Compatibility Checker"
description: "Checks whether a child license can derive from a parent asset license. Returns compatible flag, reason codes (ND_BLOCKS_DERIVATIVE, SA_REQUIRES_SAME_LICENSE, NC_BLOCKS_COMMERCIAL, PIL_RECIPROCAL_MISMATCH, CBE_PERSONAL_NO_DERIVATIVE), required_child_license when ShareAlike or reciprocal forces a specific choice, and an SPDX-satisfies result for Creative Commons families. Not legal advice. Selection only."
resource: https://ainumbers.co/chaingraph/art-204-license-compatibility-checker.html
tags: ["compliance_mandate", "wave-35", "mcp:check_license_compatibility"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-204-license-compatibility-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-204-license-compatibility-checker.html
    title: "public tool page"
---

# License Compatibility Checker

> Exports a decision via MCP `check_license_compatibility` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-204-license-compatibility-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Embedded License Selector](./art-203-embedded-license-selector.md), `art-198-rights-matrix-comparator` _(not live)_

**Feeds:** [License Terms Assembler](./art-205-license-terms-assembler.md)
