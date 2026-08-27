---
type: DecisionTool
title: "MLA MAPR Actuarial Recompute"
description: "Recomputes a Military Lending Act MAPR for closed-end credit by the Regulation Z actuarial method, from caller-supplied cash flows and charges. 32 CFR 232.4(c)(2)(i) says the MAPR for closed-end credit is calculated following Regulation Z's own rules for the annual percentage rate, based on the wider charge set in 232.4(c)(1), so this node solves the Appendix J actuarial equation rather than a single-period ratio: the odd-days fraction is priced at simple interest per Appendix J (b)(6), only whole unit-periods compound, and the annual figure is the unit-period rate multiplied by the unit-periods in a year per (b)(1). Each supplied charge is classified against 232.4(c)(1) and (d) with its own paragraph citation, and an includable charge collected at consummation reduces the amount advanced, which is what raises the rate; a Regulation Z finance charge already carried by the payment schedule is echoed and never deducted twice. The result is compared against the 36 percent limit 232.4(b) sets, with the limit and the $100 participation-fee figure in 232.4(c)(2)(ii)(B) held as declared constants a caller cannot move. A rate is reported only when a sign-change bracket was established and narrowed, so a schedule with no non-negative rate returns no figure rather than a guess. Two questions the clause leaves to facts are surfaced rather than decided: whether a fee is bona fide and reasonable under 232.4(d)(3), which turns on a comparison against other creditors, and whether the application-fee exception in 232.4(c)(1)(iii)(B) applies, which turns on creditor type and a rolling 12-month charging history. This node is verify-only. It does not determine covered-borrower status, reads no external record, and does not assert that a real transaction meets the Military Lending Act. RELATED NODE, so the two MLA MAPR nodes are told apart: this node TAKES CALLER-SUPPLIED CASH FLOWS, the advances, the payments and their timings exactly as the caller states them, and derives no schedule of its own. Where a caller instead has only described loan terms, art-231-compute-mla-mapr DERIVES the payment schedule from those terms, an amount advanced repaid either by a single payment at a stated term in days or by a level installment series, and computes the same closed-end MAPR by the same Appendix J actuarial method."
resource: https://ainumbers.co/chaingraph/art-616-mla-mapr-actuarial-recompute.html
tags: ["compliance_mandate", "wave-99", "mcp:recompute_mla_mapr_actuarial"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-616-mla-mapr-actuarial-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-616-mla-mapr-actuarial-recompute.html
    title: "public tool page"
---

# MLA MAPR Actuarial Recompute

> Exports a decision via MCP `recompute_mla_mapr_actuarial` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-616-mla-mapr-actuarial-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-616-mla-mapr-actuarial-recompute.md) — §10.2.
