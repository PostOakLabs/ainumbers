---
type: DecisionTool
title: "SB 53 Frontier Scope Checker"
description: "Routes supplied model compute (FLOPs, as a decimal string above the 2^53 safe-integer range) and developer annual revenue through the California SB 53 Transparency in Frontier Artificial Intelligence Act (eff. 2026-01-01) scope thresholds: 10^26 FLOP frontier-model bar and $500M large-frontier-developer revenue bar. Returns in-scope flags and the triggered obligation set (transparency report, catastrophic-risk-assessment summary, and for large frontier developers the safety-framework publication, annual update, incident reporting, and whistleblower-channel obligations). Asserts a scope/obligation finding only, never that those obligations have been fulfilled. Standalone -- deliberately not folded into the CAIA/TRAIGA/AB2013 chains (narrow frontier-lab audience). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-316-sb53-frontier-scope-checker.html
tags: ["compliance_mandate", "wave-55", "mcp:check_sb53_frontier_scope"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-316-sb53-frontier-scope-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-316-sb53-frontier-scope-checker.html
    title: "public tool page"
---

# SB 53 Frontier Scope Checker

> Exports a decision via MCP `check_sb53_frontier_scope` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-316-sb53-frontier-scope-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
