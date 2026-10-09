---
type: DecisionTool
title: "S-Corp Election Break-Even Modeler"
description: "S-Corp election break-even modeler: from net self-employment income, a reasonable W-2 salary share and an annual admin cost, compute the sole-proprietor SE tax, the S-Corp payroll tax, the SE-tax saving net of admin cost, the five-year saving, and the 500-step-grid break-even income at which electing starts to pay, plus a QBI section 199A trade-off output weighing payroll-tax saved against the 20% deduction value lost on wages paid at the adjudicated 19.8% effective rate, with income-threshold and SSTB caveats as flags. 2026 figures: SS wage base $184,500 with cap logic on both sides (SS legs cap at the base, Medicare 2.9% continues uncapped) and the 92.35% SE factor applied to net earnings from self-employment only, never to W-2 wages (IRS Topic 554). That D4 treatment is the adjudication of record for this port (Tim, 2026-10-06): Apex #111 applies the factor to the wage and carries the error, so the S-Corp-side outputs intentionally differ from the source by the documented amount while the sole-prop side is source-identical. Filing status and the owner health premium are accepted and echoed but excluded from the tax arithmetic (source DIFFERS D1/D2, preserved); the 0.9% Additional Medicare Tax stays a stated caveat, not a modeled term. Admin cost carries a ~$1,500–$3,000/yr guidance band: values outside it are honored, never clamped, and flagged. Ported from ApexLogics display_number #111 (AL-118), CC BY 4.0, per the APEX-PORT fleet plan (payload APEXPORT-SC111, GRADES 8fb2772d)."
resource: https://ainumbers.co/chaingraph/art-713-scorp-election-break-even.html
tags: ["readiness_diagnostic", "wave-123", "mcp:model_scorp_break_even"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-713-scorp-election-break-even.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-713-scorp-election-break-even.html
    title: "public tool page"
---

# S-Corp Election Break-Even Modeler

> Exports a decision via MCP `model_scorp_break_even` — mandate type `readiness_diagnostic`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-713-scorp-election-break-even.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-713-scorp-election-break-even.md) — §10.2.
