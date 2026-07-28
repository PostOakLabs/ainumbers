---
type: DecisionTool
title: "Securitization Risk Retention Check"
description: "EU Securitisation Regulation (EU) 2017/2402 Art.6 and U.S. Credit Risk Retention Rule (Dodd-Frank Sec.941, Reg RR, 12 CFR Part 244) 5% risk-retention checker: verifies the originator/sponsor/original-lender retains at least 5% net economic interest via a recognized method (vertical slice, horizontal first-loss, L-shaped, representative sample, seller's interest), applies the U.S. Qualified Residential Mortgage (QRM) exemption where flagged, and flags EU-specific structural breaches -- retainer sole-purpose-entity prohibition and retained-interest hedging/sale. Deterministic point-in-time structural check from caller-supplied retention method, exposure/retained amounts, and jurisdiction-specific flags for a single reporting date. Not a compute_rbc_action_level (NAIC insurer capital ladder) or calculate_solvency2_scr_ratio (EU insurer capital) check -- this is bank/ABS securitization risk-retention structure, not insurer solvency."
resource: https://ainumbers.co/chaingraph/art-447-securitization-risk-retention-check.html
tags: ["compliance_mandate", "wave-73", "mcp:check_securitization_risk_retention"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-447-securitization-risk-retention-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-447-securitization-risk-retention-check.html
    title: "public tool page"
---

# Securitization Risk Retention Check

> Exports a decision via MCP `check_securitization_risk_retention` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-447-securitization-risk-retention-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
