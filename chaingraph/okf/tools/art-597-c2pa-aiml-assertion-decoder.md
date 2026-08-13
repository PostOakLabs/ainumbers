---
type: DecisionTool
title: "C2PA AI/ML Assertion Decoder"
description: "Decodes AI/ML provenance assertions off a C2PA manifest's assertion array: ALL entries in every c2pa.actions/c2pa.actions.v2 assertion (a manifest can carry a created -> edited -> published history; this reads the whole chain, not just the first action, generalizing beyond art-361's single-action IDV-scoped read), the full IPTC digitalsourcetype NewsCodes vocabulary (raw code always surfaced, an unrecognized code is never silently dropped -- it lands in unrecognized_source_types), and c2pa.ai_training / c2pa.ai_generative_training training-and-data-mining opt-out assertions (training_mining_opt_out: true/false/not_asserted, read only from an explicit boolean, never inferred). Reports assertions only -- never adjudicates whether an assertion is true, and absence of an AI/ML assertion means nothing (not evidence of human authorship, not proof of AI generation). Reuses art-123's assertion-array input shape as a sibling stage; zero edits to art-123 or art-361. Zero network calls, zero PII."
resource: https://ainumbers.co/chaingraph/art-597-c2pa-aiml-assertion-decoder.html
tags: ["compliance_control", "wave-99", "mcp:decode_c2pa_aiml_assertions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-597-c2pa-aiml-assertion-decoder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-597-c2pa-aiml-assertion-decoder.html
    title: "public tool page"
---

# C2PA AI/ML Assertion Decoder

> Exports a decision via MCP `decode_c2pa_aiml_assertions` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-597-c2pa-aiml-assertion-decoder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-597-c2pa-aiml-assertion-decoder.md) — §10.2.
