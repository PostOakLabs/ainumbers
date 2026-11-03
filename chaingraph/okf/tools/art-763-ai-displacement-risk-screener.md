---
type: DecisionTool
title: "AI Displacement Risk Screener"
description: "AI-driven job-displacement risk screener ported from ApexLogics Apex #104 (AL-111). For a task-composition profile (routine cognitive/manual and non-routine analytical/interpersonal/manual shares, 0..100 each), a sector exposure factor, an education level and years in role, the node computes a 0..100 composite displacement score as 0.40 x automation probability + 0.40 x routine-task fraction + 0.20 x sector exposure, clamped and rounded, with an education-adjusted informational score and a four-tier banding (Low <= 30, Medium <= 55, High <= 75, else Critical). Selecting a SOC code looks the occupation up in an embedded 62-row table (title, Frey-Osborne automation probability, task splits, BLS-OES-labelled median salary); leaving it null estimates the probability from the sliders (slope 0.85, floor 0.05, cap 0.99). The node also returns up to three adjacent lower-exposure occupations scored with the caller's sector factor, gated at similarity >= 60. Invalid-domain inputs are rejected by throw with a named reason. The automation probabilities are Frey-Osborne 2013-vintage estimates (stale by construction), the task splits are Apex-embedded approximations, and the median-salary cells labelled BLS OES 2025 stayed ungrounded at porting time (BLS HTTP 403): salary figures are informational only and stay out of the score, with every vintage and grounding flag carried in the kernel metadata (payload DIFFERS.md D1-D4, CITES.md U1-U4)."
resource: https://ainumbers.co/chaingraph/art-763-ai-displacement-risk-screener.html
tags: ["analytics_mandate", "wave-133", "mcp:ai_displacement_risk_screener"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-763-ai-displacement-risk-screener.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-763-ai-displacement-risk-screener.html
    title: "public tool page"
---

# AI Displacement Risk Screener

> Exports a decision via MCP `ai_displacement_risk_screener` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-763-ai-displacement-risk-screener.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-763-ai-displacement-risk-screener.md) — §10.2.
