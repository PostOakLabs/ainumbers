---
type: DecisionTool
title: "Ethereum L2 Stage Criteria Classifier"
description: "Classifies the properties a caller declares for one Ethereum layer-2 against the L2BEAT stages framework text, and reports for each criterion whether the declared property meets it, fails it, leaves it unresolved or does not engage it. The caller declares whether the project calls itself a rollup, posts state roots and data availability on layer 1, publishes state-reconstruction software and has a proper proof system; the proof system type (fraud or validity), the number of external actors who can submit a fraud proof and whether fraud proofs are permissionless; whether a Security Council exists, the smallest share of it that must be compromised to block or push an invalid withdrawal, whether upgrades outside the Council are possible and their exit window in days; the exit window in days for unwanted upgrades; and whether the Council is restricted to errors detected on chain. Eleven criteria are evaluated: six for the first stage, two for the second and three for the third, using the thresholds in the framework text (five external fraud-proof actors, a 75 percent Council share, a 7 day exit window for upgrades outside the Council, a 30 day exit window for unwanted upgrades). The two fraud-proof criteria are not engaged for a validity-proof system. The Council share criterion is not engaged when no Council exists, and the Council restriction criterion likewise. A property the caller leaves out is reported as indeterminate and is never guessed. The stages are read in order: a failed criterion fixes the reading at the stage below, and an unresolved criterion before any failure leaves the reading indeterminate. This node classifies declared inputs against the framework text as retrieved on 2026-11-03. It never asserts the stage of any live project, because stages change and the framework itself is expected to change. It does not evaluate the edge cases the framework lists as open (the liveness failure upper bound, the forced transaction delay upper bound, frontrunning risk and based preconfirmations) and says so in its output. It reads no chain and checks no contract. For the finality and withdrawal timing of a layer-2 bridge, see the separate layer-2 finality node art-290."
resource: https://ainumbers.co/chaingraph/817-eth-l2-stage-classifier.html
tags: ["compliance_control", "wave-142", "mcp:classify_l2_stage_criteria"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/817-eth-l2-stage-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/817-eth-l2-stage-classifier.html
    title: "public tool page"
---

# Ethereum L2 Stage Criteria Classifier

> Exports a decision via MCP `classify_l2_stage_criteria` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/817-eth-l2-stage-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/817-eth-l2-stage-classifier.md) — §10.2.
