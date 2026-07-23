---
type: DecisionTool
title: "IFRS 17 Loss Component Roll-Forward Tracker"
description: "Tracks the IFRS 17 para 50 loss-component roll-forward across periods: opening balance, additional loss recognised on new onerous contracts, reversal from subsequent favourable experience (capped so it never reverses more than the available balance), other adjustments, and release to profit or loss (capped at the pre-release balance). Delta over validate_ifrs17_csm_rollforward (art-178), which resets the loss component to a single period's shortfall and does not track the component's own multi-period roll-forward or its release pattern. IFRS 17 para 50, BC323-BC326. NaN-safe numeric validation on all inputs. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-448-ifrs17-loss-component-tracker.html
tags: ["compliance_mandate", "wave-32", "mcp:track_ifrs17_loss_component_rollforward"]
timestamp: 2026-07-14
---

# IFRS 17 Loss Component Roll-Forward Tracker

> Exports a decision via MCP `track_ifrs17_loss_component_rollforward` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-448-ifrs17-loss-component-tracker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IFRS 17 CSM Roll-Forward Validator](./art-178-ifrs17-csm-rollforward-validator.md)

**Feeds:** _terminal node_
