---
type: DecisionTool
title: "Control Attestation Campaign Roll Up"
description: "Roll-up of a caller-declared control-attestation campaign: completion percentage (attested / controls_total, 2dp half-up), exception rate, a below_threshold flag against a declared escalation_threshold_pct, and an overall verdict (ESCALATION_FLAGGED iff below threshold OR exceptions>0 OR unresponded>0; else NO_ESCALATION). Declared-count discipline: attested, exception, and unresponded are the caller declarations, never observations this kernel makes; no register, GRC system, or control repository is read. Absent, non-integer, or out-of-range counts or threshold fail closed with each offending input named. The exam pack evidence leg is fed by pointer on the tool page, never in this kernel. Zero network, zero storage, zero clock."
resource: https://ainumbers.co/tools/680-control-attestation-campaign-roll-up.html
tags: ["compliance_control", "wave-115", "mcp:compute_control_attestation_campaign_roll_up"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-680-control-attestation-campaign-roll-up.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/680-control-attestation-campaign-roll-up.html
    title: "public tool page"
---

# Control Attestation Campaign Roll Up

> Exports a decision via MCP `compute_control_attestation_campaign_roll_up` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/680-control-attestation-campaign-roll-up.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-680-control-attestation-campaign-roll-up.md) — §10.2.
