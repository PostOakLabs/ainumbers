---
type: DecisionTool
title: "Validator Change-Control Receipt"
description: "Turns one permissioned-validator event on an Avalanche Evergreen L1 -- a validator add, remove, or weight change -- into change-control evidence in the shape the SOX/ICFR control family already uses: the authorization chain of named identities, the weight delta and its share-of-total effect against a caller-supplied total network stake, and a quorum verdict comparing the caller's declared approval-quorum policy against what the caller states was achieved, plus a structural exceptions list (nonzero prior weight on an add, nonzero posterior weight on a remove, no delta on a weight change, an unauthorized change, an achieved-quorum count exceeding the number of named authorizers). Fail-closed on required inputs: a missing or null prior_weight or posterior_weight is no statement at all and never reads as a stated zero (which would silently encode a from-zero add or a slash-to-zero), a missing or blank as_of never records undated evidence, and a missing quorum number leaves the quorum UNQUANTIFIED rather than met; every required-field deletion raises an exception and escalates. Statedness is strict: a weight, the total stake or a quorum number counts as a statement only as a finite number or one strict decimal-string form (the tool page sends DOM input strings), so an empty string, a blank, a boolean, an array or a junk string refuses NOT_STATED (never a coerced stated zero, an unstated field echoes as null and no delta or share is derived from it), a negative refuses NEGATIVE (never clamped, so no silent from-zero add or slash-to-zero), quorum counts must additionally be whole numbers, and as_of, effective_epoch and validator_ref must be non-empty strings (a non-string scalar is a missing statement, never coerced into a present one). No baked-in quorum threshold: quorum_required is the caller's own policy for that Evergreen L1, exactly as art-445/art-494 refuse to bake in their own thresholds. No chain observation, no P-Chain query, no RPC: the event is transcribed by the caller. Not X: use art-503 for a §27 dual-control certification that counts distinct approvers against a statutory-or-policy threshold across a subject; this node evidences one validator-set change event, not an approval-count certification. compliance_control. Zero PII: validator_ref and every authorizing identity are opaque references. Input truthfulness is strict: an as_of that is not a real calendar date in exact YYYY-MM-DD form (an impossible day, month or zero date) refuses AS_OF_INVALID_DATE and is never recorded as the receipt date, an integer magnitude beyond 2^53 refuses UNSAFE_INTEGER and echoes null (its JSON round-trip already prints a different number, and it is carried as null in the artifact preimage so the receipt never launders an unrepresentable value), only real non-empty strings are authorizing identities (a number, boolean, object or array entry refuses AUTHORIZING_IDENTITY_NOT_A_STRING and is never coerced into the chain or counted toward quorum), and change_type is an exact allowlist match where padding is a different value, not a tolerated one."
resource: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html
tags: ["compliance_control", "wave-78", "mcp:build_validator_change_control_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-497-validator-change-control-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html
    title: "public tool page"
---

# Validator Change-Control Receipt

> Exports a decision via MCP `build_validator_change_control_receipt` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-497-validator-change-control-receipt.md) — §10.2.
