---
type: DecisionTool
title: "TMPG Fails-Charge Recompute"
description: "Recomputes the NY Fed Treasury Market Practices Group fails-charge claim a buyer presents to a failing seller on a UST, agency, or agency-MBS settlement fail: charge = max(0, 3% minus the caller-declared reference rate) / 360 x par amount x days failed, per the published trading practice (2016 revision). Accepts a batch of fails in one pass, each with its own par amount, reference rate, and day count, and diffs the recomputed charge against a caller-declared claimed amount within a caller-declared tolerance -- never a default. A fail with no claimed amount contributes an INDETERMINATE line rather than a silent pass. Overall verdict DIVERGES if any fail's recomputed charge falls outside tolerance of its claimed amount; INDETERMINATE if every fail is within tolerance or unclaimed but at least one has no claimed amount to diff, or if the tolerance itself, or every fail, is absent; MATCHES only when every fail carries a claimed amount and every one agrees within tolerance. Par and claimed amounts are integer minor units, so the arithmetic is exact; recomputed charges round to the nearest minor unit. Performs arithmetic only over caller-declared par amounts, reference rates, day counts, and claimed amounts -- does not source, derive, or independently verify fail status, par amounts, or reference rates from any feed, and makes no TMPG/NY Fed endorsement claim. Clause: NY Fed TMPG fails-charge trading practice (2016 revision); confirm current text at newyorkfed.org before relying on a computed figure for a live claim."
resource: https://ainumbers.co/chaingraph/art-575-tmpg-fails-charge-recompute.html
tags: ["compliance_control", "wave-94", "mcp:recompute_tmpg_fails_charge"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-575-tmpg-fails-charge-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-575-tmpg-fails-charge-recompute.html
    title: "public tool page"
---

# TMPG Fails-Charge Recompute

> Exports a decision via MCP `recompute_tmpg_fails_charge` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-575-tmpg-fails-charge-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-575-tmpg-fails-charge-recompute.md) — §10.2.
