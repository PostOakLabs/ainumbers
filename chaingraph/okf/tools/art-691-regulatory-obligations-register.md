---
type: DecisionTool
title: "Regulatory Obligations Register"
description: "A regime-agnostic rule-to-obligation-to-evidence register verdict: obligations in (rule_id, owner, control_ids, evidence_refs), coverage math out (owner and evidence percentages, control-linkage count, the unassigned list, one FAIL finding per failing check, and an overall COVERED or GAPS_FOUND determination). Five stages in one pure compute(): intake with fail-closed shape validation (a missing rule_id zeroes the register rather than producing partial counts), owner coverage, control linkage, evidence linkage, verdict. This is the spine the exam-readiness and attestation packs later hang off, per OBLIGATIONS-REGISTER-BUILD-SPEC.md (Tim-approved gap-scan slate, 2026-09-03; the estate previously had no rule-to-obligation-to-evidence register: the BaaS control mapper at tools/152-baas-provider-comparator.html maps controls to frameworks inside one BaaS scope and is linked here as the pattern source, not duplicated). Owner and evidence coverage are the gated checks; control linkage is measured but never gates the verdict, matching the spec's own worked example (control_linked 2 of 3 with no control finding). All inputs are synthetic identifiers; the node stores nothing, calls nothing, and cites no external regime: thresholds are internal design (100 percent owner and evidence coverage required for COVERED, coverage percentages rounded to one decimal), so a reader holding any regulator's rulebook uses this as the register arithmetic, not as a statement of what that regime requires. The worked example's canonical {policy_parameters, output_payload} preimage and its pinned execution_hash bdf74ddc2f836c5e34b374d65f915e96684b061792283d775b08f2e9cd34ba67 are preserved in the spec and carried as this node's oracle-backed golden fixture; compute() reproduces that payload byte-identically."
resource: https://ainumbers.co/chaingraph/art-691-regulatory-obligations-register.html
tags: ["compliance_control", "wave-113", "mcp:compute_regulatory_obligations_register"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-691-regulatory-obligations-register.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-691-regulatory-obligations-register.html
    title: "public tool page"
---

# Regulatory Obligations Register

> Exports a decision via MCP `compute_regulatory_obligations_register` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-691-regulatory-obligations-register.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-691-regulatory-obligations-register.md) — §10.2.
