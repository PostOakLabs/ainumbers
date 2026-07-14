---
type: DecisionTool
title: "AI Act Conformity Pack Builder"
description: "Assembles an EU AI Act Annex IV technical documentation pack, validates the conformity-assessment route (internal control vs notified body), checks CE-marking and EU Declaration of Conformity readiness, and scores completeness per Arts 9/10/15/17. Prepare-ahead: 2 Dec 2027 (verify Digital Omnibus). Decision-support draft, not a conformity certificate."
resource: https://ainumbers.co/chaingraph/art-65-ai-conformity-pack-builder.html
tags: ["model_governance", "wave-15", "mcp:build_ai_conformity_pack"]
timestamp: 2026-07-14
---

# AI Act Conformity Pack Builder

> Exports a decision via MCP `build_ai_conformity_pack` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-65-ai-conformity-pack-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act High-Risk Fit & Classification Diagnostic](./art-64-ai-act-highrisk-fit-diagnostic.md)

**Feeds:** `333-eu-ai-act-article9-risk-mgmt-builder` _(not live)_, [EU AI Act Credit-Scoring Conformity Pack](./art-05-eu-ai-act-credit-scoring-conformity.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
