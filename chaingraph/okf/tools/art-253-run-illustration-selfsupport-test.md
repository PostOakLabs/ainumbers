---
type: DecisionTool
title: "Life Illustration Self-Support Test (NAIC Model 582)"
description: "Runs the NAIC Model Regulation 582 §8C self-support test (year 15 and year 20 account value positive) and §8D lapse-support prohibition check for life insurance illustrations. ASOP 24 compliant. Inputs: projected account values, premium payments, cost of insurance, expense charges, credited interest, and optional lapse rates per policy year. Outputs: self_support_pass (both year-15 and year-20), lapse_support_flag, and illustration_valid. Use in life-illustration-self-support-test linear chain. ZERO PII: projected cash flows and policy mechanics only."
resource: https://ainumbers.co/chaingraph/art-253-run-illustration-selfsupport-test.html
tags: ["compliance_mandate", "wave-43", "mcp:run_illustration_selfsupport_test"]
timestamp: 2026-07-14
---

# Life Illustration Self-Support Test (NAIC Model 582)

> Exports a decision via MCP `run_illustration_selfsupport_test` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-253-run-illustration-selfsupport-test.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [NAIC RBC Action Level Calculator](./art-254-compute-rbc-action-level.md)
