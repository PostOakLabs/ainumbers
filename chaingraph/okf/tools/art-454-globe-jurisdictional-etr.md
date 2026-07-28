---
type: DecisionTool
title: "GloBE Jurisdictional ETR Calculator"
description: "Computes a jurisdiction's OECD Pillar Two (GloBE) effective tax rate from caller-declared constituent-entity financial data: sums entity-level GloBE income/loss to a jurisdictional net (Art 3.1), sums entity-level adjusted covered taxes (Art 4), and divides to get the ETR. If the jurisdictional net is a GloBE loss, no ETR is computed and the jurisdiction is flagged rather than divided by a non-positive base. Top-up tax percentage = max(0, minimum_rate - ETR); minimum_rate defaults to the Art 5.1 15% rate but is taken as a versioned policy-parameter input, not hardcoded. Election flags (de minimis, stock-based comp, aggregate deferred-tax adjustment) are caller-declared policy parameters -- this kernel echoes which elections were declared, it does not decide them; election judgment and DTA characterization stay with the filer. First node in the GloBE annual cycle, feeding the substance-based income exclusion / top-up node (art-455) and, downstream, the safe-harbour tests (art-456) and GIR composer (art-457). Pure arithmetic aggregation only. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-454-globe-jurisdictional-etr.html
tags: ["compliance_control", "wave-32", "mcp:compute_globe_jurisdictional_etr"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-454-globe-jurisdictional-etr.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-454-globe-jurisdictional-etr.html
    title: "public tool page"
---

# GloBE Jurisdictional ETR Calculator

> Exports a decision via MCP `compute_globe_jurisdictional_etr` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-454-globe-jurisdictional-etr.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [GloBE SBIE & Top-up Tax Calculator](./art-455-globe-sbie-topup.md)

## Attested computation

[executor + attester binding](../computations/art-454-globe-jurisdictional-etr.md) — §10.2.
