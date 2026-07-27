---
type: DecisionTool
title: "RDARR Quality Scorecard"
description: "Deterministic data-quality metrics over a SUPPLIED risk-data extract, keyed to the measurable RDARR prerequisites: completeness, referential integrity, timeliness, reconciliation coverage, and manual-adjustment ratio. Each metric is scored against a policy-supplied threshold (never hardcoded) and labelled with its ECB Guide (3 May 2024) prerequisite area. HARD FENCE: never a supervisory pass mark, never a materiality judgement. Second entry of the BCBS 239 / RDARR family."
resource: https://ainumbers.co/chaingraph/art-481-rdarr-quality-scorecard.html
tags: ["attestation_mandate", "wave-66", "mcp:rdarr_quality_scorecard"]
timestamp: 2026-07-27
---

# RDARR Quality Scorecard

> Exports a decision via MCP `rdarr_quality_scorecard` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; RDARR quality scoring is a continuous data-governance control, not a periodic filing. The ECB named RDARR remediation a supervisory priority for 2025-2027.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-481-rdarr-quality-scorecard.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _rdarr-attestation-cycle (with art-480-rdarr-aggregation-recompute)_
