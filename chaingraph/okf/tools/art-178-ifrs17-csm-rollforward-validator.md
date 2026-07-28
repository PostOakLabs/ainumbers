---
type: DecisionTool
title: "IFRS 17 CSM Roll-Forward Validator"
description: "Validate IFRS 17 Contractual Service Margin (CSM) roll-forward mechanics: opening CSM + new business + interest accretion + experience adjustments - coverage-unit release + FX adjustments = closing CSM. Flags onerous contracts when computed closing falls below zero (IFRS 17 para 47-50: no negative CSM; shortfall recognized as immediate loss component). NaN-safe numeric validation on all inputs. Feeds risk-adjustment checker (art-179). IFRS 17 para 44-50. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-178-ifrs17-csm-rollforward-validator.html
tags: ["compliance_mandate", "wave-32", "mcp:validate_ifrs17_csm_rollforward"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-178-ifrs17-csm-rollforward-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-178-ifrs17-csm-rollforward-validator.html
    title: "public tool page"
---

# IFRS 17 CSM Roll-Forward Validator

> Exports a decision via MCP `validate_ifrs17_csm_rollforward` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-178-ifrs17-csm-rollforward-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IFRS 17 Measurement Model Classifier](./art-177-ifrs17-measurement-model-classifier.md)

**Feeds:** [IFRS 17 Risk Adjustment Checker](./art-179-ifrs17-risk-adjustment-checker.md)

## Attested computation

[executor + attester binding](../computations/art-178-ifrs17-csm-rollforward-validator.md) — §10.2.
