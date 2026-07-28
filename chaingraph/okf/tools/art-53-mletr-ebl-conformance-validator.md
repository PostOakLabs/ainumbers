---
type: DecisionTool
title: "MLETR / eBL Conformance & Enforceability Validator"
description: "Validates an electronic transferable record (eBL or other ETR) against MLETR functional-equivalence tests (Arts. 10–12: singularity, control, integrity, reliability) and scores cross-corridor legal enforceability from the UNCITRAL adoption status. Answers: will this eBL hold up at both ends of the corridor?"
resource: https://ainumbers.co/chaingraph/art-53-mletr-ebl-conformance-validator.html
tags: ["compliance_mandate", "wave-12", "mcp:validate_mletr_record"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-53-mletr-ebl-conformance-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-53-mletr-ebl-conformance-validator.html
    title: "public tool page"
---

# MLETR / eBL Conformance & Enforceability Validator

> Exports a decision via MCP `validate_mletr_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-53-mletr-ebl-conformance-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Digital Trade Corridor Fit Diagnostic](./art-52-digital-trade-fit-diagnostic.md)

**Feeds:** [Digital Asset Regulatory Classifier](./510-digital-asset-regulatory-classifier.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [Credit Default Risk Scorer](./ml-02-credit-default-risk-scorer.md)
