---
type: DecisionTool
title: "Control-Test Evidence Composer"
description: "Composes a SOX 404 / ICFR control-test evidence artifact: reconciles a caller-declared attribute sample (item ids, e.g. from art-458) against a per-item pass/fail test-result set into one test-conclusion record -- sample coverage, exception count vs a caller-set tolerable-deviation threshold, and a test conclusion (operating effectively / exception noted / incomplete). The tester is recorded under the SOX 404 / PCAOB AS 1215 preparer role; every test carries a fixed review_required gate for reviewer sign-off. An exception count above zero flags a deficiency CANDIDATE only -- severity classification and its reason_code are a separate human reviewer approval record, never computed here. Deterministic reconciliation only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-461-control-test-evidence-composer.html
tags: ["compliance_control", "wave-76", "mcp:compose_control_test_evidence"]
timestamp: 2026-07-14
---

# Control-Test Evidence Composer

> Exports a decision via MCP `compose_control_test_evidence` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-461-control-test-evidence-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
