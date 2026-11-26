---
type: DecisionTool
title: "Assess Sandbox Application Readiness"
description: "Assesses a regulatory sandbox application against a declared regulator profile's eligibility criteria and test-parameter limits: the applicant declares per-criterion status (met, partially_met, not_met) with evidence refs, requested test parameters (duration, customer cap, per-customer and aggregate value caps, eligible customer types), the four common safeguards (consumer redress, AML/CFT controls, data protection, disclosure to participants) and the exit plan; the node returns READY, READY_WITH_GAPS or NOT_ELIGIBLE with sorted gaps, parameter breaches against profile caps, missing safeguards and per-item source cites. Profiles are data: generic (jurisdiction-neutral rubric; its only number is this tool's own disclosed 250-customer default) and cbob (Central Bank of The Bahamas Guidance Note for Participation in the Regulatory Sandbox Framework, issued 8 October 2026: duration cap 12 months per paragraph 28; customer, transaction and cash limits are set per application by ORSAC so the profile asserts no number there). A cap the pinned source does not fix is null and is never invented. The Bermuda Monetary Authority profile is not shipped: at authoring time the BMA had no published sandbox framework text for payment applicants and its AI Payments Hub remained consultation-stage. Any mandatory criterion not_met or a missing exit plan gives NOT_ELIGIBLE (the note requires an exit-plan assessment at paragraphs 17 xii and 18 iv). Unknown profile, unknown criterion id and invalid status are refused by name with verdict null. Synthetic inputs only; the node names no regulator staff and implies no endorsement; zero network, zero PII."
resource: https://ainumbers.co/chaingraph/798-assess-sandbox-application-readiness.html
tags: ["compliance_control", "wave-141", "mcp:assess_sandbox_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/798-assess-sandbox-application-readiness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/798-assess-sandbox-application-readiness.html
    title: "public tool page"
---

# Assess Sandbox Application Readiness

> Exports a decision via MCP `assess_sandbox_readiness` — mandate type `compliance_control`.

**Context:** No dated regulatory deadline: this node scores an application draft against declared criteria and caps; it does not track a filing window.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/798-assess-sandbox-application-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/798-assess-sandbox-application-readiness.md) — §10.2.
