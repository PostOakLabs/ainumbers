---
type: DecisionTool
title: "Authzen Conformance Fixture"
description: "Evaluates the 8-decision AuthZEN Authorization API 1.0 certification fixture (AUTHZEN-CONFORMANCE-BUILD-SPEC.md) through the spec-mandated subject/action/resource/context request envelope (Information Model §5, Access Evaluation API §6.1-6.2), against a local hand-authored FIXTURE_POLICY. AuthZEN is an OpenID Foundation open specification rather than a regulation or legal instrument , standards_basis is implements_standard against a published spec, per SO #38 Step 0. The spec itself is silent on PDP decision logic (§2: 'policy language... beyond the scope of this specification'), so the 8 decision outcomes are mechanical, hand-authored test-fixture policy (role/resource-state/action-parameter rules), not spec-mandated content; what IS spec-mandated and cited below is the request/response envelope shape and the boolean-only Decision semantics the fixture is expressed through. Also checks the §6.1 'context is OPTIONAL and must not change the decision' invariant on every decision."
resource: https://ainumbers.co/chaingraph/art-651-authzen-conformance-fixture.html
tags: ["compliance_control", "wave-104", "mcp:compute_authzen_conformance_fixture"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-651-authzen-conformance-fixture.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-651-authzen-conformance-fixture.html
    title: "public tool page"
---

# Authzen Conformance Fixture

> Exports a decision via MCP `compute_authzen_conformance_fixture` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-651-authzen-conformance-fixture.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-651-authzen-conformance-fixture.md) — §10.2.
