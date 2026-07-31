---
type: DecisionTool
title: "Dual Control Certification Evidence"
description: "Decides whether a required number of distinct named identities have each filed a signed section 27 approval record over one sealed subject in one required role, and reports every record it could not count and why. This is the first production use of the section 27.3 integer threshold construction, and it is regime agnostic by design: the regime label is free text that is never interpreted, so one surface serves a chief executive plus chief financial officer certification at a threshold of two, a chief executive or chief operating officer certification at a threshold of one, and an audit sign-off, without a separate node per regime. The trap it exists to catch is identity. Counting is by distinct identity, never by record and never by signing key, so one human rotating keys counts once and one human signing twice counts once, and every collapse is reported with the record hashes and the distinct verification methods folded together rather than applied silently. A threshold over fewer than the required number of distinct approvers is unsatisfied and never auto-passes; an absent subject, an unstated threshold, an unrecognised role, a read-only examiner role and an empty record set each resolve to a stated reason rather than a fall-through. An unsigned approval record is not conformant evidence and is rejected with its reason, including where the caller declared it signed and the record carries no proof bound to the named identity. Section 27.8 parity is enforced in the verdict: an agent-filed record counts only when a human principal delegated that exact role in a signed mandate whose validity window contains the caller-supplied as-of date, and an agent that prepared the subject can never approve it. No clock is read anywhere, so a time-boxed record can never resolve to a silent permanent pass. It counts approvals and computes nothing about what was certified: no reserve composition, no eligible-asset determination and no ratio. Stated boundary: this evidences that named humans took responsibility. It carries no claim of regulator acceptance, it does not serve as a filing, and it makes no assertion that the certified numbers are correct."
resource: https://ainumbers.co/chaingraph/art-503-build-dual-control-certification.html
tags: ["compliance_control", "wave-78", "mcp:build_dual_control_certification"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-503-build-dual-control-certification.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-503-build-dual-control-certification.html
    title: "public tool page"
---

# Dual Control Certification Evidence

> Exports a decision via MCP `build_dual_control_certification` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-503-build-dual-control-certification.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-503-build-dual-control-certification.md) — §10.2.
