---
type: DecisionTool
title: "IFRS 17 Measurement Model Classifier"
description: "Classify insurance contracts to their IFRS 17 measurement model: Premium Allocation Approach (PAA) for coverage periods of 12 months or less, Variable Fee Approach (VFA) for direct-participating contracts with investment-linked features (not reinsurance), or General Measurement Model/BBA as the default. Returns measurement_model (GMM/VFA/PAA), eligible_models, paa_eligible, vfa_eligible flags, and direct_participating indicator. Root node of the ifrs17-measurement-conformance chain. IFRS 17 live since Jan 1 2023. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-177-ifrs17-measurement-model-classifier.html
tags: ["compliance_mandate", "wave-32", "mcp:classify_ifrs17_measurement_model"]
timestamp: 2026-07-14
---

# IFRS 17 Measurement Model Classifier

> Exports a decision via MCP `classify_ifrs17_measurement_model` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-177-ifrs17-measurement-model-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [IFRS 17 CSM Roll-Forward Validator](./art-178-ifrs17-csm-rollforward-validator.md)
