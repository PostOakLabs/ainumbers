---
type: DecisionTool
title: "AML Disposition Sampling Frame Builder"
description: "Builds a deterministic sampling frame over an AML consent-order lookback's historical alert dispositions for independent-validator review, plus a reviewer workload allocation. Reuses the shipped art-458-attribute-sampling-plan kernel's compute() directly for the statistical core (sample size, deterministic interval selection over a caller-declared population hash) rather than reimplementing it -- no randomness, fully replayable by an independent reviewer from the same declared inputs. Adds only the AML-specific layer: labeling the frame as a disposition sample and deterministically fanning the selected indices out round-robin across a caller-declared reviewer roster. Deterministic only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-471-disposition-sampling-frame.html
tags: ["compliance_control", "wave-74", "mcp:plan_aml_disposition_sample"]
timestamp: 2026-07-14
---

# AML Disposition Sampling Frame Builder

> Exports a decision via MCP `plan_aml_disposition_sample` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-471-disposition-sampling-frame.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
