---
type: DecisionTool
title: "CSCF Control Applicability & Coverage"
description: "Scores a Swift member's declared architecture type and component inventory against a policy-supplied Swift Customer Security Controls Framework (CSCF) control matrix -- the published control number, tier, applicable-architecture-type list, and evidence column, never a hand-transcribed list. Returns the applicable mandatory/advisory control set, coverage percentages, a gap list keyed by the published control number, an evidence index mapped to the matrix's supporting-evidence column, and an explicit not-applicable set with a stated reason per exclusion."
resource: https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.html
tags: ["compliance_mandate", "swift", "cscf", "mcp:check_cscf_control_applicability"]
timestamp: 2026-07-27
---

# CSCF Control Applicability & Coverage

> Exports a decision via MCP `check_cscf_control_applicability` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
