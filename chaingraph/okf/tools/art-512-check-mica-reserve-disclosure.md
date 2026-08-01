---
type: DecisionTool
title: "Check MiCA Reserve Disclosure"
description: "Checks a token issuer's published reserve disclosure, the amount in circulation and the value and composition of the reserve, against the composition, concentration, segregation and publication-cadence terms the reader supplies. Deterministic and backward-looking: it reads what was published and compares it to declared rules, and contains no simulation of any kind. Coverage is the reserve total against tokens in circulation, with the surplus or shortfall. Composition tests each component against the caller's declared eligible asset classes and per-class concentration limits, listing every component that falls outside and keeping its amount inside the reserve total, because excluding it would flatter the coverage figure. Segregation tests the segregated proportion against the declared minimum, and lists every component whose custodian type the caller did not declare acceptable. Cadence names each period that ran longer than the declared interval with no publication, individually and with its dates, never as a count. HARD FENCE: the eligible asset classes, concentration limits, minimum segregated percentage, acceptable custodian types and disclosure cadence are every one of them a caller input, pinned in the artifact and shown on screen. This kernel ships no reporting template, no eligible-asset table and no issuer library, performs no lookups of any kind (zero-egress), and makes no claim about what the current rules are, so a rule change makes an old receipt dated rather than wrong. The one regime constant is the e-money-token minimum of 30 percent, applied only when the caller declared nothing, labelled at source in the receipt; for an asset-referenced token an absent minimum raises judgment_required naming the field rather than inventing a threshold. Every verdict is against the caller's declared rules: this is not a determination that the issuer complies, not legal advice, and not a submission. Where a named human attests the check, the dual-control certification surface art-503-build-dual-control-certification is reused and no second threshold evaluator is built. Distinct from rca-02-mica-reserve-stress, which is a Monte Carlo redemption stress asking whether the reserve survives a run, a forward-looking simulation this node neither imports nor edits, and from art-105-mica-token-service-scoper and tools/332-mica-casp-authorization-checker, neither of which reads a reserve disclosure. Out of scope: redemption stress simulation, authorisation and service scoping, white-paper conformance, template validation, any statement that an issuer is or is not compliant, and any coverage ratio about our own estate."
resource: https://ainumbers.co/chaingraph/art-512-check-mica-reserve-disclosure.html
tags: ["compliance_mandate", "wave-79", "mcp:check_mica_reserve_disclosure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-512-check-mica-reserve-disclosure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-512-check-mica-reserve-disclosure.html
    title: "public tool page"
---

# Check MiCA Reserve Disclosure

> Exports a decision via MCP `check_mica_reserve_disclosure` — mandate type `compliance_mandate`.

**Context:** No statutory filing deadline is encoded. The publication cadence is a caller input, because a bundled cadence is a standing duty that goes silently false when the terms change.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-512-check-mica-reserve-disclosure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-512-check-mica-reserve-disclosure.md) — §10.2.
