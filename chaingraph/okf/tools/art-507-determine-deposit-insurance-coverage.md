---
type: DecisionTool
title: "Deposit Insurance Coverage Determination"
description: "Computes the insured amount and the uninsured remainder for deposit accounts grouped by ownership right and capacity, and reports every account whose coverage cannot be calculated from the fields supplied. Balances held in the same ownership right and capacity by the same holder combine before an allowance is applied, so splitting a balance across accounts never creates coverage, and a group receives the largest allowance count stated for it rather than the sum across its accounts, so repeating a beneficiary set across accounts never multiplies coverage. The standard maximum deposit insurance amount is supplied by the caller and no statutory amount is held here: supply none and nothing is estimated, because every record is returned as undeterminable naming that field and the totals report zero insured rather than a guess. No table of part 330 ownership categories or allowance rules is held either. Ownership right and capacity codes are opaque strings used for grouping and reporting only, nothing branches on the text of a code, and how many separate insurance allowances a group is entitled to arrives as a per-record input, because that determination belongs to the institution and its counsel. Money is fixed point in integer minor units throughout, so no floating point operation is performed on a balance and a value that is not an integer is reported rather than coerced or rounded. Every account that cannot be calculated names the field that is missing, so a reader is told which field to go and get rather than being handed a bare undetermined count. Accounts held under alternative recordkeeping are undeterminable by construction rather than by failure, because the beneficial ownership detail sits with a third party. The annual certification that the information technology system was tested during the preceding twelve months is a caller-supplied assertion with a caller-supplied date, echoed unchanged and never computed from a clock, and nothing here verifies that any testing occurred; the signature over it is evaluated as a section 27 approval record at a threshold of one by art-503-build-dual-control-certification. Whether an institution has the two million or more deposit accounts that bring it into scope is a caller declaration and is never asserted here. Stated boundary: this is arithmetic over supplied records. It carries no claim that the Federal Deposit Insurance Corporation would accept the result, it does not serve as a filing, it does not produce the prescribed submission format, and it offers no deposit insurance advice."
resource: https://ainumbers.co/chaingraph/art-507-determine-deposit-insurance-coverage.html
tags: ["compliance_control", "wave-78", "mcp:determine_deposit_insurance_coverage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-507-determine-deposit-insurance-coverage.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-507-determine-deposit-insurance-coverage.html
    title: "public tool page"
---

# Deposit Insurance Coverage Determination

> Exports a decision via MCP `determine_deposit_insurance_coverage` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-507-determine-deposit-insurance-coverage.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-507-determine-deposit-insurance-coverage.md) — §10.2.
