---
type: DecisionTool
title: "Swift CSP Assessor Independence Eligibility"
description: "Checks eligibility of a Swift CSCF Independent Assessment Framework assessment: route (internal 2nd/3rd line vs external) against a policy-supplied permitted-routes table, claimed assessor certifications against a policy-supplied required set, a distinct-identity independence test over a declared identity set, and assessment-date validity against the attestation deadline. Returns eligible/ineligible with the first failing predicate named."
resource: https://ainumbers.co/chaingraph/art-487-assessor-independence-check.html
tags: ["compliance_mandate", "swift", "cscf", "mcp:check_assessor_independence"]
timestamp: 2026-07-27
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
