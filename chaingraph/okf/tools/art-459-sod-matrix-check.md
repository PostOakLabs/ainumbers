---
type: DecisionTool
title: "Segregation-of-Duties Matrix Checker"
description: "Evaluates a caller-declared role-assignment set against a caller-declared SoD conflict ruleset for SOX 404 / ICFR access controls. For every user, checks all pairs of assigned roles against the ruleset and returns any conflicts found, the count of affected users, and a clean/not-clean verdict. The ruleset is a versioned policy input, never derived by the kernel. Deterministic pairwise set evaluation only. Zero network, zero PII -- user_id and role names are caller-supplied opaque strings."
resource: https://ainumbers.co/chaingraph/art-459-sod-matrix-check.html
tags: ["compliance_control", "wave-74", "mcp:check_sod_matrix"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-459-sod-matrix-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-459-sod-matrix-check.html
    title: "public tool page"
---

# Segregation-of-Duties Matrix Checker

> Exports a decision via MCP `check_sod_matrix` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-459-sod-matrix-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
