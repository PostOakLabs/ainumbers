---
type: DecisionTool
title: "Attested Artifact Subject Binder"
description: "Computes the SPEC.md section 27.4 attested-artifact subject identifier for the sealed output of a pinned non-OCG producer: a spreadsheet, a reconciliation export, a report builder's PDF, anything with a content-addressed manifest but no kernel, no node and no chain. The identifier is sha256 over the JCS canonicalisation of exactly three members, tool_ref plus inputs_digest plus artifact, on the single canonical hash path; there is no fourth member and no wall clock, run identifier, host or session state enters it, so a verifier that never executed the producer recomputes the same value offline from the echoed preimage. tool_ref.manifest_digest is the chainless analogue of the section 17 kernel_digest and is what makes the producer tamper-evident rather than merely its output; its absence is reported, never assumed. Digest strings are hashed verbatim as declared and are never rewritten, so a malformed digest is named rather than silently normalised. Stated limit, normative: an attested-artifact subject carries no section 18 compute proof and no section 16 or 17 re-execution claim, it never evidences that the producer's arithmetic is correct, and the artifact omits replay_verified entirely rather than setting it false because no replay was attempted. This node identifies a subject so that separately signed section 27 approval records can name it; it signs nothing itself and asserts no regulator acceptance or filing sufficiency."
resource: https://ainumbers.co/chaingraph/art-502-bind-attested-subject.html
tags: ["compliance_control", "wave-77", "mcp:bind_attested_subject"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-502-bind-attested-subject.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-502-bind-attested-subject.html
    title: "public tool page"
---

# Attested Artifact Subject Binder

> Exports a decision via MCP `bind_attested_subject` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-502-bind-attested-subject.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-502-bind-attested-subject.md) — §10.2.
