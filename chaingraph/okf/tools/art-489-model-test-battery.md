---
type: DecisionTool
title: "Model Test Battery"
description: "Runs the deterministic-given-data quantitative model validation battery: discriminatory power (Gini coefficient, Kolmogorov-Smirnov statistic) from scored outcomes, population and characteristic stability (PSI, CSI) between two declared snapshots using the caller's own bins, back-test outcome-vs-predicted per declared bin, and a calibration comparison (predicted vs actual rate, max absolute diff). Every test is graded against a POLICY-SUPPLIED threshold object -- this node never chooses or hardcodes a threshold. If a threshold is missing for a requested test, that test is reported skipped_no_threshold, never silently defaulted; if the underlying data is missing or insufficient (e.g. a single-class scored set for Gini/KS), the test is reported skipped_insufficient_data. Each result carries the test's standard name, its metric value, its threshold, and pass/breach so the artifact reads as a workpaper section, not an opinion. Model inputs and specifications are expected to arrive as a workbook export via the shipped WB-BRIDGE-1 workbook-to-OCG artifact bridge (tool 554); this node itself accepts plain JSON so any upstream source can feed it. Pairs with art-488 model-replication-diff (recompute-and-diff) as the two deterministic legs of a model validation cycle -- neither node emits a soundness or fitness-for-use opinion. Inline deterministic transcendental math (no engine Math.exp/log) so the same input always produces the same execution_hash on every surface. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-489-model-test-battery.html
tags: ["compliance_control", "wave-77", "mcp:run_model_test_battery"]
timestamp: 2026-07-14
---

# Model Test Battery

> Exports a decision via MCP `run_model_test_battery` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-489-model-test-battery.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
