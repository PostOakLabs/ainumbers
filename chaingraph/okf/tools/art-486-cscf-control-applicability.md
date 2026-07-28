---
type: DecisionTool
title: "CSCF Control Applicability & Coverage"
description: "Scores a Swift member's declared architecture type and component inventory against a policy-supplied Swift Customer Security Controls Framework (CSCF) control matrix -- the published control number, tier (mandatory/advisory), applicable-architecture-type list, and evidence column, never a hand-transcribed list. Returns the applicable mandatory/advisory control set, coverage percentages, a gap list keyed by the published control number, an evidence index mapped to the matrix's supporting-evidence column, and an explicit not-applicable set with a stated reason per exclusion so an omission can never read as a pass. Not a Swift-endorsed tool and not a KYC-SA submission; consumes the firm's own declared architecture and its own copy of the published matrix."
resource: https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.html
tags: ["compliance_mandate", "wave-66", "mcp:check_cscf_control_applicability"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-486-cscf-control-applicability.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.html
    title: "public tool page"
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
