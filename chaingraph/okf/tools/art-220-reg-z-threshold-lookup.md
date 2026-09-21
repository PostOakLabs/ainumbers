---
type: DecisionTool
title: "Reg Z Threshold Lookup"
description: "Reg Z version-pinned threshold lookup service. Tables: qm_points_fees, hoepa, hpml, card_penalty. 2021-2026 rows with Federal Register citations and effective dates. This node exists because agents reliably hallucinate current-year dollar thresholds. Annual refresh cadence with FR citation pinning. Covers CARD Act penalty fees under 12 CFR 1026.52(b)(1)(ii)(A)/(B) as one general safe harbor of $32 for a first violation and $43 for each subsequent violation of the same type, applying to late fees and other violations alike: the CFPB $8 late-fee cap (89 FR 19128) was enjoined 2024-05-10 before its 2024-05-14 effective date and vacated 2025-04-15 in Chamber of Commerce v. CFPB, No. 4:24-cv-00213-P (N.D. Tex.), so it is void and was never operative even though the eCFR still prints it. The hpml rows carry the 12 CFR 1026.35(c)(2)(ii) special-appraisal exemption, $34,200 for 2026 per FR 2025-22875, 90 FR 58141."
resource: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
tags: ["compliance_mandate", "wave-37", "mcp:lookup_reg_z_thresholds"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-220-reg-z-threshold-lookup.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
    title: "public tool page"
---

# Reg Z Threshold Lookup

> Exports a decision via MCP `lookup_reg_z_thresholds` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-220-reg-z-threshold-lookup.md) — §10.2.
