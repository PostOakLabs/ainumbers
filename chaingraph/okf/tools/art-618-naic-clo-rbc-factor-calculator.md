---
type: DecisionTool
title: "NAIC CLO/CBO/CDO Tranche RBC Factor Calculator"
description: "Recomputes the NAIC Life RBC per-tranche capital charge for CLO/CBO/CDO bond tranches against the LR002 Column (2) factor grid adopted by the RBC Investment Risk & Evaluation (E) Working Group (Proposal 2026-12-IRE, effective YE2026 filings). Given a tranche's NAIC designation category, BSL thin-tranche flag, current tranche thickness, and book/adjusted carrying value, looks up the correct pre-tax factor -- including the flat 11.77% BSL thin-tranche surcharge for designation 2.C or below at <=4% thickness -- and computes the tranche-level RBC dollar requirement (ROUND(...,0)), summed across a portfolio. Exhaustively enumerated over the declared 31-state (naic_designation x bsl_thin_override_applicable) input domain. Verify-only: recomputes a prescribed charge from declared inputs, never asserts filing compliance or correctness of the filer's own rating/thickness determination."
resource: https://ainumbers.co/chaingraph/art-618-naic-clo-rbc-factor-calculator.html
tags: ["compliance_control", "wave-100", "mcp:calculate_naic_clo_rbc_factor"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-618-naic-clo-rbc-factor-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-618-naic-clo-rbc-factor-calculator.html
    title: "public tool page"
---

# NAIC CLO/CBO/CDO Tranche RBC Factor Calculator

> Exports a decision via MCP `calculate_naic_clo_rbc_factor` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-618-naic-clo-rbc-factor-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-618-naic-clo-rbc-factor-calculator.md) — §10.2.
