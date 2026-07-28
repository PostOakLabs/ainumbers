---
type: DecisionTool
title: "CFPB 1071 Coverage Check & SBLAR Record Validator"
description: "CFPB Section 1071 small business lending rule (Regulation B subpart B, revised final rule published 2026-05-01): determines whether a financial institution is a covered originator by checking its small-business-originations count against the 1,000-origination threshold for each of the two preceding calendar years, and validates a batch of Small Business Lending Application Register (SBLAR) records against a caller-supplied required-field schema. Fixed compliance-date reference: data collection begins 2028-01-01, first SBLAR submission due 2029-06-01. Deterministic threshold comparison and field-presence check only -- no filing, no submission, no hardcoded field-list claim beyond the caller's supplied schema."
resource: https://ainumbers.co/chaingraph/art-475-cfpb-1071-coverage-check.html
tags: ["compliance_mandate", "wave-70", "mcp:compute_cfpb_1071_coverage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-475-cfpb-1071-coverage-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-475-cfpb-1071-coverage-check.html
    title: "public tool page"
---

# CFPB 1071 Coverage Check & SBLAR Record Validator

> Exports a decision via MCP `compute_cfpb_1071_coverage` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-475-cfpb-1071-coverage-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
