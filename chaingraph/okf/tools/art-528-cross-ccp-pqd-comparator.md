---
type: DecisionTool
title: "Cross-CCP PQD Comparator"
description: "Compares a caller-selected set of CPMI-IOSCO public quantitative disclosure (PQD) fields across FICC and ICE using a manually-transcribed, source-cited fixture dataset -- backtest coverage and largest margin deficiency per FICC division (GSD, MBSD, NSCC), and default fund requirement, Cover-2 peak stress loss, and total initial margin required per ICE clearing house (ICC, ICEU, ICUS), plus a CCP-level ICE skin-in-the-game total. FICC and ICE do not disclose the same field set; a field one side does not publish is reported unavailable, never interpolated. Flags a caller-declared threshold breach (e.g. Cover-2 peak stress loss exceeding a declared percentage of default fund requirement) per entity. Comparison arithmetic and delta table only -- no ranking, no better/worse scoring language, no forecasting. CME and LCH are named in the spec but not built -- selecting either yields an unknown-CCP rejection, never a fabricated figure. Every fixture figure is public and source-cited to the CCP's own quarterly disclosure PDF, refreshed manually per quarter, never a live feed and never scraped."
resource: https://ainumbers.co/chaingraph/art-528-cross-ccp-pqd-comparator.html
tags: ["regulatory_reporting", "wave-82", "mcp:compare_cross_ccp_pqd_fields"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-528-cross-ccp-pqd-comparator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-528-cross-ccp-pqd-comparator.html
    title: "public tool page"
---

# Cross-CCP PQD Comparator

> Exports a decision via MCP `compare_cross_ccp_pqd_fields` — mandate type `regulatory_reporting`.

**Context:** Compares CCPs against the STANDING CPMI-IOSCO Dec 2015 PQD template each already publishes quarterly -- not the 2026 PQD-transparency consultation amendments, which are consultation-stage with no compliance date.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-528-cross-ccp-pqd-comparator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-528-cross-ccp-pqd-comparator.md) — §10.2.
