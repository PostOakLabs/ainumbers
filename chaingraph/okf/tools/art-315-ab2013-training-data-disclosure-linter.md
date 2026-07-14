---
type: DecisionTool
title: "AB 2013 Training Data Disclosure Linter"
description: "Lints a supplied generative-AI training-data disclosure against the 12 datapoint categories required by California AB 2013 (Cal. Bus. & Prof. Code §22757.7, eff. 2026-01-01): dataset sources/owners, purpose alignment, datapoint counts and types, IP status, licensing, personal/aggregate-consumer-information inclusion, cleaning/processing description, synthetic-data use, and collection time period/dates. Per-datapoint present/missing findings; DRAFT-PINNED against secondary-source statute summaries, not a primary-text re-read. Asserts the supplied disclosure replays to this coverage finding, never that the developer is AB 2013 compliant or that this is legal advice. Root node of the ca-genai-disclosure chain. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-315-ab2013-training-data-disclosure-linter.html
tags: ["compliance_mandate", "wave-55", "mcp:lint_ab2013_training_data_disclosure"]
timestamp: 2026-07-14
---

# AB 2013 Training Data Disclosure Linter

> Exports a decision via MCP `lint_ab2013_training_data_disclosure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-315-ab2013-training-data-disclosure-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
