---
type: DecisionTool
title: "Dependent Care FSA vs. CDCTC Optimizer"
description: "Compare a Dependent Care FSA (IRC section 129 exclusion) against the Child and Dependent Care Tax Credit (IRC section 21) plus the optimal combination, with FICA savings on the contribution. Three strategy cards, a $250-grid optimum sweep, and a full OCG v0.4 artifact. Refuses malformed inputs with named reasons; money is float USD exactly as the source computes it. Ported from ApexLogics Apex #130 (AL-137, CC BY 4.0), fetched 2026-10-13, sha256 fec17792. The kernel carries an explicit as_of whose tax year selects the statutory table: 2026+ applies Pub. L. 119-21 sections 70404/70405 ($7,500/$3,750 exclusion cap, 50%/35%/20% applicable-percentage schedule at $2,000/$4,000 steps), earlier years the prior text; a verification-only apex_page ruleset reproduces the source page value-for-value (inputSchema registration drops it; 88/88 payload vectors reproduce both rulesets at land). DIFFERS rows D1-D7 are resolved to the fetched statute with the MFS case kept as Apex arithmetic plus the ART765_CDCTC_MFS_BARRED_BY_SECTION_21E2 flag (grader caveat, open question left to Tim)."
resource: https://ainumbers.co/chaingraph/art-765-dependent-care-fsa-cdctc-optimizer.html
tags: ["dependent_care_fsa_cdctc_record", "wave-134", "mcp:estimate_dc_fsa_cdctc_split"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-765-dependent-care-fsa-cdctc-optimizer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-765-dependent-care-fsa-cdctc-optimizer.html
    title: "public tool page"
---

# Dependent Care FSA vs. CDCTC Optimizer

> Exports a decision via MCP `estimate_dc_fsa_cdctc_split` — mandate type `dependent_care_fsa_cdctc_record`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-765-dependent-care-fsa-cdctc-optimizer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-765-dependent-care-fsa-cdctc-optimizer.md) — §10.2.
