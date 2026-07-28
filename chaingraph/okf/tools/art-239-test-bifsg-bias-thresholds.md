---
type: DecisionTool
title: "BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169)"
description: "Tests BIFSG proxy bias thresholds under Colorado SB 21-169 / Reg. 10-1-1 for insurance AI models. ZERO PII: accepts aggregate regression outputs only (p-value, marginal effect %, premium delta per $1,000 face) -- no individual applicant data, proxy scores, or demographic identifiers enter this kernel. Statistical prong: p < 0.05 AND marginal effect >= 5 percentage points. Premium prong (standalone): premium >= 5% above average per $1,000 face. Annual attestation due December 1: anchor execution_hash at anchor.ainumbers.co/mcp (COMPOSE, do not rebuild). Disambiguates from compute_disparity_metrics (art-229): that node applies ECOA/HMDA 4/5ths adverse impact rule for lending; this node applies Colorado SB 21-169 p-value and premium-rate bias tests for insurance AI."
resource: https://ainumbers.co/chaingraph/art-239-test-bifsg-bias-thresholds.html
tags: ["compliance_mandate", "wave-40", "mcp:test_bifsg_bias_thresholds"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-239-test-bifsg-bias-thresholds.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-239-test-bifsg-bias-thresholds.html
    title: "public tool page"
---

# BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169)

> Exports a decision via MCP `test_bifsg_bias_thresholds` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-239-test-bifsg-bias-thresholds.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [NAIC AI Systems Program Readiness Assessment](./art-240-assess-naic-ais-program-readiness.md)

## Attested computation

[executor + attester binding](../computations/art-239-test-bifsg-bias-thresholds.md) — §10.2.
