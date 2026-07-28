---
type: DecisionTool
title: "FR 2052a Inflow/Outflow Bucket Classifier"
description: "FR 2052a complex-institution liquidity monitoring filing-layer kernel, scoped to the inflow/outflow section: product/maturity-bucket classification against a caller-supplied Appendix IV-style boundary table (versioned policy input, not hardcoded), intercompany elimination (excluded from external aggregation, reported separately), and form-shaped JSON export by bucket (inflow/outflow/net). A bucket override without a reason_code is flagged -- the row-level basis for a separate signed §27 human_accountability_record, not minted by this kernel. Not a filing tool -- evidence artifact and form-shaped export only, never regulator-submittable. Not check_conforming_loan_limit or a Call Report/Y-9C schedule kernel."
resource: https://ainumbers.co/chaingraph/art-437-fr2052a-inflow-outflow-classifier.html
tags: ["regulatory_reporting", "wave-71", "mcp:compute_fr2052a_inflow_outflow_classification"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-437-fr2052a-inflow-outflow-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-437-fr2052a-inflow-outflow-classifier.html
    title: "public tool page"
---

# FR 2052a Inflow/Outflow Bucket Classifier

> Exports a decision via MCP `compute_fr2052a_inflow_outflow_classification` — mandate type `regulatory_reporting`.

**Context:** FR 2052a: $100B panel, 18 daily / 23 monthly filers, deadline 3:00pm ET (FR notice 2025-02-07).

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-437-fr2052a-inflow-outflow-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-437-fr2052a-inflow-outflow-classifier.md) — §10.2.
