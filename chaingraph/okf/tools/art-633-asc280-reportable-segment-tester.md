---
type: DecisionTool
title: "ASC 280 Reportable Segment Tester"
description: "Applies the ASC 280-10-50-12 quantitative thresholds to one caller-declared candidate operating segment and computes the ASC 280-10-50-14 seventy-five percent coverage test, reporting each of the three ten percent tests separately with its own denominator. The three tests do not share a denominator: the revenue test runs the segment's revenue including intersegment sales or transfers against combined internal and external revenue of all reported operating segments, the profit-or-loss test runs the absolute amount of the segment's reported profit or loss against the greater in absolute amount of the combined profit of segments that did not report a loss and the combined loss of segments that did, and the assets test runs segment assets against combined assets of all operating segments. Netting the two profit-or-loss sides together, a plausible misreading, produces a smaller denominator and over-flags segments, so the denominator side actually used is reported. Thresholds are inclusive, and every comparison is made by exact cross multiplication on unrounded inputs rather than by rounding a percentage first, so a value sitting exactly on ten or seventy-five percent classifies as meeting it instead of being pushed under by binary floating point; reported percentages are rounded for display only, strictly after every comparison. The five ASC 280-10-50-11 aggregation criteria are echoed back as nullable booleans and are never computed or guessed by this node, with unanswered criteria named individually and a management-judgment flag raised rather than read as false. A zero or non-positive denominator reports not_assessable for that test, never a failing threshold. Source of the rule is FASB Statement No. 131 paragraphs 17, 18, 19 and 20 as carried into the Codification; ASU 2023-07 does not amend these paragraphs, which its own amendment instruction and scope statement both confirm. Verify-only: does not identify operating segments, does not aggregate them, does not decide the chief operating decision maker question, and does not assert that an entity's segment note is compliant."
resource: https://ainumbers.co/chaingraph/art-633-asc280-reportable-segment-tester.html
tags: ["compliance_mandate", "wave-101", "mcp:test_asc280_reportable_segment"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-633-asc280-reportable-segment-tester.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-633-asc280-reportable-segment-tester.html
    title: "public tool page"
---

# ASC 280 Reportable Segment Tester

> Exports a decision via MCP `test_asc280_reportable_segment` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-633-asc280-reportable-segment-tester.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-633-asc280-reportable-segment-tester.md) — §10.2.
