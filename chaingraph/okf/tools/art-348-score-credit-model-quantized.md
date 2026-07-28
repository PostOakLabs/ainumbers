---
type: DecisionTool
title: "Quantized Credit Model Scorer"
description: "Runs a fixed, int8-quantized logistic-regression-class credit-decisioning model as a pure integer inference kernel and returns the score it produced from the supplied normalized inputs. Proves that THIS fixed quantized model produced THIS score from THESE inputs. It is not a fairness attestation and not a model-quality certification, and the underlying model is a synthetic offline demand-test artifact, not fit for real regulatory credit decisioning. The quantization_parity block on the artifact records the float-vs-quantized agreement rate measured over 1000 held-out vectors."
resource: https://ainumbers.co/chaingraph/art-348-score-credit-model-quantized.html
tags: ["credit_assessment", "wave-58", "mcp:score_credit_model_quantized"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-348-score-credit-model-quantized.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-348-score-credit-model-quantized.html
    title: "public tool page"
---

# Quantized Credit Model Scorer

> Exports a decision via MCP `score_credit_model_quantized` — mandate type `credit_assessment`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-348-score-credit-model-quantized.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-348-score-credit-model-quantized.md) — §10.2.
