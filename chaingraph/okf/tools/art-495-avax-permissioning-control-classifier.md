---
type: DecisionTool
title: "Evergreen Permissioning-Control Classifier"
description: "Classifies six Evergreen supervisory controls -- transaction permissioning, contract deployment permissioning, native asset issuance, fee policy, reward distribution, and validator set membership -- as protocol-enforced, application-enforced, or absent, from caller-transcribed genesis precompile configuration and validator-manager mode. Distinct from the segregation-of-duties matrix checker: that tool asks who holds conflicting power, this asks where the control lives at all. An undeclared input never falls through to a silent guess -- it becomes a named judgment_required entry naming the undetermined fact, the input that resolves it, and who decides. Zero network, zero PII -- opaque control and precompile keys only."
resource: https://ainumbers.co/chaingraph/art-495-avax-permissioning-control-classifier.html
tags: ["compliance_control", "wave-AVAX-PERM-1", "mcp:classify_avax_permissioning_controls"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-495-avax-permissioning-control-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-495-avax-permissioning-control-classifier.html
    title: "public tool page"
---

# Evergreen Permissioning-Control Classifier

> Exports a decision via MCP `classify_avax_permissioning_controls` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-495-avax-permissioning-control-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-495-avax-permissioning-control-classifier.md) — §10.2.
