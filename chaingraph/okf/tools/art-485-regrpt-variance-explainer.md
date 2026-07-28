---
type: DecisionTool
title: "Regulatory Report Period-over-Period Variance Explainer"
description: "Computes period-over-period variance across a regulatory report instance pair -- absolute and relative movement per line item against a policy-supplied materiality threshold (default plus per-line overrides), ranked by contribution (largest absolute movement first) -- and flags which movements require a written explanation, i.e. exceed materiality with no matching explanation on file. Does not judge whether a supplied explanation is adequate; that is a human review-and-approval step downstream (RGEC-K-2's gate: an unexplained material variance routes to review_required). Pairs with art-484-regrpt-editcheck-runner's rule-based edit checks -- this node handles analytical-review variance, not rule pass/fail."
resource: https://ainumbers.co/chaingraph/art-485-regrpt-variance-explainer.html
tags: ["regulatory_reporting", "wave-77", "mcp:explain_regrpt_variance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-485-regrpt-variance-explainer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-485-regrpt-variance-explainer.html
    title: "public tool page"
---

# Regulatory Report Period-over-Period Variance Explainer

> Exports a decision via MCP `explain_regrpt_variance` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-485-regrpt-variance-explainer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-485-regrpt-variance-explainer.md) — §10.2.
