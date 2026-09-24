---
type: DecisionTool
title: "Close Posting Lineage"
description: "A month-end close lineage verdict over declared entries: GL coding entries and accrual entries in (lineage key, GL account, amount, optional source document digest, optional traces_to references), linkage structure out (the accruals that resolve to a declared coding entry, the accruals with no reference at all, every reference naming a key no coding entry declares, the coding entries nothing traces to, the coding entries with no declared source digest, repeated lineage keys, and an overall CLOSE_READY, GAPS_FOUND or INDETERMINATE determination). Four stages in one pure compute(): intake with fail-closed shape validation, lineage key uniqueness across both declared lists, per accrual linkage classification, and the coding side observations plus the verdict. The scope is the structure of declared linkage, not business validity: the node never checks that a traced pair agrees on amount, never opens a document behind a digest, and never posts or approves anything, so an accrual of 1200 tracing to a coding entry of 300 reads as linked here and that is the honest boundary. Unlinked accruals, dangling references and duplicate keys gate the verdict; a coding entry nobody accrued against and a missing source digest are recorded as observations and never gate. An empty or malformed register returns INDETERMINATE with the reason, because zero declared accruals cannot make every accrual linked. All inputs are caller declared and synthetic, nothing is stored or transmitted, and no regime is cited: the thresholds are internal design, so a reader holding an accounting manual uses this as lineage arithmetic over their own declarations, not as a statement of what any standard requires. Built per CLOSE-COMMAND-CENTER-BUILD-SPEC-2026-09-23.md section D2, narrowed to this single node by the 2026-09-24 value review; the spec worked example's canonical policy parameters and output payload are carried as this node's oracle backed golden fixture with execution_hash 46b2cee4111553128514447ded7e205fb45bbdedccd75579f04c7ebc360d63d1, and compute() reproduces that payload byte identically."
resource: https://ainumbers.co/chaingraph/art-692-close-posting-lineage.html
tags: ["compliance_mandate", "wave-118", "mcp:verify_close_posting_lineage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-692-close-posting-lineage.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-692-close-posting-lineage.html
    title: "public tool page"
---

# Close Posting Lineage

> Exports a decision via MCP `verify_close_posting_lineage` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-692-close-posting-lineage.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-692-close-posting-lineage.md) — §10.2.
