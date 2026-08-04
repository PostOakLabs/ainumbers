---
type: DecisionTool
title: "AML Lookback Disposition Rollup"
description: "Closes the loop art-470 (lookback-completeness-reconciler) and art-471 (disposition-sampling-frame) leave open. Art-470 reconciles that the RE-SCREENING extract was complete; art-471 builds a deterministic sample of the resulting dispositions for independent review; neither checks that a disposition was actually recorded for every sampled item, that a filed or no-SAR determination carries a rationale, or that the sample frame's declared population size still reconciles to the completeness population. This node rolls those three axes up: disposition-coverage against the sample frame's own declared size, disposition-rationale-presence on every filed/no-SAR determination, and a population-to-sample tie-out between art-470's and art-471's declared population sizes. Emits a closed §27.4 gate-policy value: full coverage with rationale present on every filed/no-SAR item yields auto_pass; any missing disposition evaluated as of a caller-declared date on or after the lookback's declared close date yields escalate; a population tie-out failure or an explicit caller-declared sampling-frame discrepancy yields hold; a disposition present without its required rationale yields review_required. Customer id and alert id cross this kernel already salted -- callers supply a sha256-salted@1 commitment string, never the plaintext identifier -- and the kernel never sees, requests, or computes over the plaintext. Deterministic rollup arithmetic only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-534-aml-lookback-disposition-rollup.html
tags: ["compliance_control", "wave-83", "mcp:roll_up_aml_lookback_disposition"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-534-aml-lookback-disposition-rollup.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-534-aml-lookback-disposition-rollup.html
    title: "public tool page"
---

# AML Lookback Disposition Rollup

> Exports a decision via MCP `roll_up_aml_lookback_disposition` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-534-aml-lookback-disposition-rollup.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-534-aml-lookback-disposition-rollup.md) — §10.2.
