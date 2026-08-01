---
type: DecisionTool
title: "Identity-Proofing Assurance Level Evaluator"
description: "Rates whether a DECLARED identity-evidence set reaches a DECLARED target level of a caller-supplied, versioned assurance-level framework (the art-444 policy-input pattern) -- never a hardcoded framework such as NIST 800-63-3 or eIDAS. The level definition supplies levels ordered lowest-to-highest rigor, each with criteria naming a required evidence type and a numeric min_strength on a caller-normalized 0-100 scale; the kernel never interprets a framework's own named tiers. A criterion the definition cannot express (no required_evidence_type or no min_strength) is flagged IAL_DEFINITION_INSUFFICIENT, distinct from IAL_SHORTFALL (evidence present but not meeting a well-formed criterion) -- the two are never conflated. When the target level is not met, achieved level falls back to the highest fully-met level below it. This node rates an evidence set against a declared policy; it does NOT assert that a person is who they claim to be, and no output or copy implies verification of a natural person. No identity attributes are ever computed over -- evidence items are types, strengths and verification methods, with an optional opaque attribute reference (caller-supplied, no commitment scheme claimed by this node) carried through unread, never a plaintext value. No approver identity, signature, approval field or role -- manual review/EDD escalation is a separate signed §27 human_accountability_record, not minted by this kernel. This is the assurance-LEVEL evaluator specifically, distinct from any private-check-receipt evidencing scheme or a re-verification-cadence evaluator (neither built in this exercise). Not 490-eudi-kyc-flow-designer (an eIDAS/LoA-specific flow-design tool) -- this is framework-agnostic by construction and takes any structurally-expressible level definition as a policy input, with no dependency on any named jurisdiction or procurement."
resource: https://ainumbers.co/chaingraph/art-523-identity-proofing-assurance-level.html
tags: ["regulatory_reporting", "wave-72", "mcp:compute_identity_proofing_assurance_level"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-523-identity-proofing-assurance-level.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-523-identity-proofing-assurance-level.html
    title: "public tool page"
---

# Identity-Proofing Assurance Level Evaluator

> Exports a decision via MCP `compute_identity_proofing_assurance_level` — mandate type `regulatory_reporting`.

**Context:** An ongoing identity-assurance evidencing capability, jurisdiction-neutral by design -- every regime fact is a caller-supplied policy input, so there is no filing deadline of its own.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-523-identity-proofing-assurance-level.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-523-identity-proofing-assurance-level.md) — §10.2.
