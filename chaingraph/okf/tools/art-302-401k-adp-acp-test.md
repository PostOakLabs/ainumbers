---
type: DecisionTool
title: "401(k) ADP/ACP Nondiscrimination Tester"
description: "Runs the IRC §401(k)(3) Actual Deferral Percentage test and the §401(m)(2) Actual Contribution Percentage test from supplied HCE vs NHCE deferral/match percentages (current-year or prior-year method), applying the fixed statutory permitted-disparity limits (1.25x, or 2 percentage points and 2x, whichever is greater). ACP is optional. Returns per-test pass/fail and the percentage-point excess if failed -- a simplified excess figure, not a full leveling-method dollar correction schedule. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-302-401k-adp-acp-test.html
tags: ["compliance_mandate", "wave-48", "mcp:run_401k_adp_acp_test"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-302-401k-adp-acp-test.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-302-401k-adp-acp-test.html
    title: "public tool page"
---

# 401(k) ADP/ACP Nondiscrimination Tester

> Exports a decision via MCP `run_401k_adp_acp_test` — mandate type `compliance_mandate`.

**Context:** IRC §401(k)(3)(A)(ii)/§401(m)(2) permitted-disparity limits are fixed statutory constants, not annually indexed

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-302-401k-adp-acp-test.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-302-401k-adp-acp-test.md) — §10.2.
