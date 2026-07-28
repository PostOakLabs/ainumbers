---
type: DecisionTool
title: "Swift CSP Assessor Independence Eligibility"
description: "Checks eligibility of a Swift CSCF Independent Assessment Framework assessment: assessment route (internal 2nd/3rd line vs external) against a policy-supplied permitted-routes-per-architecture-type table, claimed assessor certifications against a policy-supplied required set, an independence-from-implementer test over a declared identity set using distinct-identity counting so one person wearing two hats cannot satisfy both sides, and assessment-date validity against the attestation deadline. Returns eligible/ineligible with the first failing predicate named. Not an accreditation of the assessor and not a Swift endorsement -- an eligibility check over the firm's own declared facts."
resource: https://ainumbers.co/chaingraph/art-487-assessor-independence-check.html
tags: ["compliance_mandate", "wave-66", "mcp:check_assessor_independence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-487-assessor-independence-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-487-assessor-independence-check.html
    title: "public tool page"
---

# Swift CSP Assessor Independence Eligibility

> Exports a decision via MCP `check_assessor_independence` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-487-assessor-independence-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-487-assessor-independence-check.md) — §10.2.
