---
type: DecisionTool
title: "Home Office and Augusta Rule"
description: "Home-office deduction and IRC 280A(g) Augusta-rule rental exclusion calculator ported from ApexLogics Apex #139 (AL-146). From a square-footage and expense profile it computes the regular-method deduction, the Rev. Proc. 2013-13 simplified-method deduction ($5 per square foot, 300 square feet maximum), the better of the two, the day-count test for the 14-day rental exclusion, and the resulting tax benefits at the stated rates. Declared deviations from the source, all flagged: the gross-income cap applies to both methods; the simplified method is not selectable for an S-corp owner-employee (Rev. Proc. 2013-13 section 4.02); non-finite inputs are refused by name. Disclosed open legal question: IRC section 280A(g)(1) may bar the corporate rent deduction that the source books for an S corporation. The tool retains the source figure under a flag and does not decide the question. Verify-only: it reads no calendar, tests only the day count for section 280A(g), models no Form 8829, and is an estimate, not tax advice."
resource: https://ainumbers.co/chaingraph/art-753-home-office-augusta.html
tags: ["home_office_augusta_record", "wave-148", "mcp:calculate_home_office_augusta"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-753-home-office-augusta.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-753-home-office-augusta.html
    title: "public tool page"
---

# Home Office and Augusta Rule

> Exports a decision via MCP `calculate_home_office_augusta` — mandate type `home_office_augusta_record`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-753-home-office-augusta.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-753-home-office-augusta.md) — §10.2.
