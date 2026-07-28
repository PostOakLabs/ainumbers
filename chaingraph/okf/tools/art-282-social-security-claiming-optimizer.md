---
type: DecisionTool
title: "Social Security Claiming-Age Optimizer"
description: "Models Social Security claiming-age tradeoffs from a claimant's own PIA/FRA statement figures: early-claim reduction and delayed-retirement-credit factors, earnings-test withholding below FRA, lifetime present value at 62/FRA/70/chosen age, and the 62-vs-70 undiscounted break-even age. Root node of the retirement-decumulation-decisions chain. No SSA API, no PII stored. NaN-safe. Zero network."
resource: https://ainumbers.co/chaingraph/art-282-social-security-claiming-optimizer.html
tags: ["compliance_mandate", "wave-50", "mcp:optimize_social_security_claim_age"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-282-social-security-claiming-optimizer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-282-social-security-claiming-optimizer.html
    title: "public tool page"
---

# Social Security Claiming-Age Optimizer

> Exports a decision via MCP `optimize_social_security_claim_age` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-282-social-security-claiming-optimizer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Pension Lump-Sum vs. Annuity Decision Engine](./art-283-pension-lump-sum-vs-annuity-decision-engine.md)

## Attested computation

[executor + attester binding](../computations/art-282-social-security-claiming-optimizer.md) — §10.2.
