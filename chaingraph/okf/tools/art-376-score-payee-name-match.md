---
type: DecisionTool
title: "Payee Name-Match Score (VoP/CoP)"
description: "Deterministic, versioned single-pair payee name-matching score for Verification-of-Payee / Confirmation-of-Payee evidence. Normalizes (diacritic stripping, legal-entity suffix removal), scores by integer Levenshtein edit distance against both a plain and a token-sorted form, and bands the result MATCH / CLOSE_MATCH / NO_MATCH against declared thresholds. algorithm_version is carried in the receipt so a score is reproducible evidence, not a black-box vendor output. Distinct from the batch aggregate analyser art-11: this scores one declared pair for downstream session-receipt binding."
resource: https://ainumbers.co/chaingraph/art-376-score-payee-name-match.html
tags: ["compliance_mandate", "wave-2", "mcp:score_payee_name_match"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-376-score-payee-name-match.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-376-score-payee-name-match.html
    title: "public tool page"
---

# Payee Name-Match Score (VoP/CoP)

> Exports a decision via MCP `score_payee_name_match` — mandate type `compliance_mandate`.

**Context:** EU IPR VoP mandatory since October 2025; UK CoP 2.0 richer-metadata requirements published

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-376-score-payee-name-match.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-376-score-payee-name-match.md) — §10.2.
