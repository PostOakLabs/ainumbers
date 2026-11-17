---
type: DecisionTool
title: "Private-Input Debt-to-Income Within Policy Check"
description: "Pilot private-input predicate. Checks that privately held monthly debt obligations, 16 fixed slots, are at most a chosen share of a privately held monthly income, and publishes only a yes/no verdict. The share comes from a fixed public list (36, 43, 45 or 50 percent) because 12 CFR 1026.51(a)(1)(ii) tells a card issuer to consider the ratio of debt obligations to income in its written policies but names no number. Zero income gives no. Carries an OCG Standard section 25 ocg-private-input@1 declaration: the income and the debts are each committed under sha256-salted@1 with their own independent salt, in policy_parameters.income_commitment and policy_parameters.debts_commitment, so the income can be opened to an employment-verification party without opening the debts. Integer arithmetic only. The witness must be exactly 16 slots of 20-digit amounts so its length does not reveal how many debts exist; any other shape is refused and nothing is sealed. It does not show that every debt was listed, that the income is real or accessible, or the minimum-payment estimate in paragraph (a)(2), and assets are out of scope. The verdict is public and the inputs are not in the receipt; a receipt made from inputs given to a server was seen by that server, and many yes/no questions about the same figures at different shares reveal more than one. Pilot: the node lands with its proof deferred and the in-browser result is a preview, not a receipt."
resource: https://ainumbers.co/chaingraph/art-811-check-dti-within-policy-private.html
tags: ["compliance_control", "wave-142", "mcp:check_dti_within_policy_private"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-811-check-dti-within-policy-private.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-811-check-dti-within-policy-private.html
    title: "public tool page"
---

# Private-Input Debt-to-Income Within Policy Check

> Exports a decision via MCP `check_dti_within_policy_private` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-811-check-dti-within-policy-private.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-811-check-dti-within-policy-private.md) — §10.2.
