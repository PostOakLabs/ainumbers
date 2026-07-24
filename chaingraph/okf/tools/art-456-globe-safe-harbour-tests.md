---
type: DecisionTool
title: "GloBE Transitional Safe Harbour Test Evaluator"
description: "Evaluates a jurisdiction against the OECD Pillar Two Transitional CbCR Safe Harbour (Dec 2022 Agreed Administrative Guidance): the de minimis test (CbCR revenue < EUR 10m AND profit before tax < EUR 1m, both versioned thresholds), the simplified ETR test (simplified covered taxes / profit before tax >= the fiscal-year transition rate -- 15% for 2023/2024, 16% for 2025, 17% for 2026, versioned rate table; auto-passes when profit before tax is non-positive since ETR is undefined), and the routine profits test (profit before tax <= the caller-supplied substance-based income exclusion amount). Safe harbour is met if ANY ONE of the three tests passes, in which case the jurisdiction's top-up tax is deemed zero. Returns each test as an independently gated pass/fail verdict with its own reasoning, plus the overall safe_harbour_met / deemed_zero_topup flags. Pure arithmetic threshold comparisons only -- elections, DTA characterization, and the SBIE amount itself are HUMAN JUDGMENT and enter only as policy_parameters; SBIE is not recomputed here (that is art-455's job). NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-456-globe-safe-harbour-tests.html
tags: ["compliance_control", "wave-74", "mcp:evaluate_globe_safe_harbour_tests"]
timestamp: 2026-07-14
---

# GloBE Transitional Safe Harbour Test Evaluator

> Exports a decision via MCP `evaluate_globe_safe_harbour_tests` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-456-globe-safe-harbour-tests.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
