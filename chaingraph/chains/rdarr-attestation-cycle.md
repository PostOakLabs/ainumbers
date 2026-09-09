# RDARR Management-Body Attestation Cycle

Two-step attestation cycle for risk data aggregation and risk reporting. The attestation is the deliverable: step 1 re-derives a stated risk-report figure from a declared tabular extract under a declared aggregation policy, so the signature is backed by a recomputed number rather than a self-assessment; step 2 scores the deterministic quality metrics against policy-supplied thresholds, each labelled with its ECB Guide prerequisite area. Step 1 is gated review_required when any source line is excluded from the recompute, with the risk-data owner as reviewer. Step 2 is gated dual_control(2) for periodic attestation release, with one of the two distinct approver identities bound to a management-body role. The recompute is evidence for the institution's own internal attestation; it is not a supervisory submission and carries no supervisory pass mark.

- Page: https://ainumbers.co/chaingraph/chains/rdarr-attestation-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rdarr-attestation-cycle.md

## Workflow chain: RDARR Management-Body Attestation Cycle

Two-step attestation cycle for risk data aggregation and risk reporting. The attestation is the deliverable: step 1 re-derives a stated risk-report figure from a declared tabular extract under a declared aggregation policy, so the signature is backed by a recomputed number rather than a self-assessment; step 2 scores the deterministic quality metrics against policy-supplied thresholds, each labelled with its ECB Guide prerequisite area. Step 1 is gated review_required when any source line is excluded from the recompute, with the risk-data owner as reviewer. Step 2 is gated dual_control(2) for periodic attestation release, with one of the two distinct approver identities bound to a management-body role. The recompute is evidence for the institution's own internal attestation; it is not a supervisory submission and carries no supervisory pass mark.

Domain: Bank Capital & Credit Risk

### Steps

1. art-480-rdarr-aggregation-recompute
   Recomputed figure, signed delta against the reported figure, and the per-level contribution breakdown localise a break to one roll-up node; the same extract feeds the quality scorecard
2. art-481-rdarr-quality-scorecard
   Per-metric pass/breach plus an overall scorecard status, each metric labelled by ECB Guide prerequisite area, released under dual control into the accountability evidence bundle for the cycle. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
