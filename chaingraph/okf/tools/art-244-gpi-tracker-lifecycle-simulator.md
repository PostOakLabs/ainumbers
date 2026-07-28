---
type: DecisionTool
title: "SWIFT GPI Tracker Lifecycle Simulator"
description: "Validates SWIFT GPI pacs.002 payment status code transitions against the GPI state machine (PDNG, ACSP, ACSP/ACWC, ACCC, RJCT) and checks the Universal Confirmation SLA (ACCC must be sent within 24 hours of ACSP). Detects invalid transitions, transitions from terminal states, and SLA at-risk or breached conditions. For use in agent-driven GPI payment monitoring workflows."
resource: https://ainumbers.co/chaingraph/art-244-gpi-tracker-lifecycle-simulator.html
tags: ["compliance_mandate", "wave-41", "mcp:simulate_gpi_tracker_lifecycle"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-244-gpi-tracker-lifecycle-simulator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-244-gpi-tracker-lifecycle-simulator.html
    title: "public tool page"
---

# SWIFT GPI Tracker Lifecycle Simulator

> Exports a decision via MCP `simulate_gpi_tracker_lifecycle` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-244-gpi-tracker-lifecycle-simulator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [MT103 to MX Translation Fidelity Scorer](./art-245-mt-mx-translation-fidelity-scorer.md)

## Attested computation

[executor + attester binding](../computations/art-244-gpi-tracker-lifecycle-simulator.md) — §10.2.
