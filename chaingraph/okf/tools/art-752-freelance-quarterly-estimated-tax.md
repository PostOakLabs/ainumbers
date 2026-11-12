---
type: DecisionTool
title: "Freelance Quarterly Estimated Tax Calculator"
description: "Quarterly IRS estimated-tax calculator for self-employed income, ported from ApexLogics Apex #116 (AL-123). From gross freelance income, business expenses, other income, a filing status (single/mfj), an elective state bucket (none/low/mid/high = 0/3/5/9.3%, an illustrative assumption rather than a jurisdiction lookup), prior-year federal tax and year-to-date payments, the node computes net SE income, SE tax (12.4% Social Security capped at the 2026 wage base $184,500 plus 2.9% Medicare on 92.35% of net earnings), AGI after the employer-equivalent half of SE tax, federal income tax on the 2026 brackets after the 2026 standard deduction ($16,100 single / $32,200 MFJ), equal quarterly installments of the annual total with the 2026 due dates, and the safe harbor (lesser of 100% prior-year or 90% current-year federal tax). Q2 2026 ships as June 15, 2026 per the official IRS 1040-ES voucher, where Apex listed June 16 (payload DIFFERS.md D1); three Apex omissions ride flagged rather than silently patched: the 0.9% Additional Medicare Tax, the 110% high-earner safe-harbor prong and the $1,000 de minimis exemption (DIFFERS.md D2-D4, report items R2-R3). Numeric inputs coerce with the Apex page's own fallback behaviour (unknown state keys price at rate 0, non-mfj statuses price as single)."
resource: https://ainumbers.co/chaingraph/art-752-freelance-quarterly-estimated-tax.html
tags: ["consumer_finance", "wave-134", "mcp:estimate_quarterly_tax"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-752-freelance-quarterly-estimated-tax.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-752-freelance-quarterly-estimated-tax.html
    title: "public tool page"
---

# Freelance Quarterly Estimated Tax Calculator

> Exports a decision via MCP `estimate_quarterly_tax` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-752-freelance-quarterly-estimated-tax.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-752-freelance-quarterly-estimated-tax.md) — §10.2.
