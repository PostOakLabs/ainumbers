---
type: DecisionTool
title: "Statement Footing and Cross-Footing Check"
description: "Foots and cross-foots declared financial statement lines and ties declared note amounts to declared statement lines, in integer minor units, under the tolerance and sign convention the caller declares. The caller declares the columns, the lines (an id, a section id, a role of detail, subtotal or total, and one amount per column), the total relations (a total line and the signed lines it sums), the cross-foot relations (a line whose total column equals the sum of declared columns) and the note references (a note id, the noted amount and the line and column it should tie to). Returns every footing break (column, expected sum, stated total, difference), every cross-foot break, every note-to-statement break, the lines no relation references, and a verdict of ties, breaks, indeterminate when a referenced id or a required declaration is missing, or input_refused. A statement never ties when it was not fully footed: a subtotal or total line that no total relation foots is flagged TOTAL_LINE_NOT_FOOTED and a statement with more than one column and no cross-foot relation is flagged CROSSFOOT_NOT_DECLARED, and either gives indeterminate unless a break is found; a statement with no subtotal or total lines may tie with a NOTHING_FOOTED warning when footing_checked is 0; note references are optional. Limits are 200 lines, 8 columns, 200 relations and 200 members per relation, and amounts and tolerance within 1e13 minor units; past a limit the verdict is indeterminate with a named flag such as LINE_AMOUNT_EXCEEDS_LIMIT. A difference at or inside the tolerance ties; one minor unit past it is a break. Ids and integers only: free-text labels, names and anything shaped like an account number are refused with an explicit code and never read. Checks arithmetic and references among declared values. It does not read a document, does not verify that the figures are the real ones, and is not an audit procedure on its own. It is distinct from art-526, which ties a reported figure to a general ledger figure by account, and from the domain-specific art-508 and art-509; this node checks a statement against itself and against its own note references. No adjacency is declared here."
resource: https://ainumbers.co/chaingraph/art-839-statement-footing-crossfoot.html
tags: ["compliance_control", "wave-146", "mcp:check_statement_footing_crossfoot"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-839-statement-footing-crossfoot.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-839-statement-footing-crossfoot.html
    title: "public tool page"
---

# Statement Footing and Cross-Footing Check

> Exports a decision via MCP `check_statement_footing_crossfoot` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-839-statement-footing-crossfoot.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-839-statement-footing-crossfoot.md) — §10.2.
