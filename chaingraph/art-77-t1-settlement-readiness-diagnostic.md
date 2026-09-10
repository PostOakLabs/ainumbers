# T+1 Settlement Readiness Diagnostic

12-question A-F diagnostic scoring a firm's readiness for the coordinated EU/UK/CH T+1 move (11 Oct 2027) against the Industry Roadmap phases, grading trade-date allocation/confirmation (the Dec-2026 23:00 CET machine-readable mandate), SSI automation, funding compression and CSDR-penalty exposure, and routing to the right settlement-discipline chain.

- Page: https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.md
- MCP tool: run_t1_readiness_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allocation_confirmation_timing (unknown, optional)
- corporate_actions_readiness (unknown, optional)
- csd_participations (unknown, optional)
- firm_type (unknown, optional)
- fx_funding_compression (unknown, optional)
- instrument_classes (unknown, optional)
- jurisdictions (unknown, optional)
- matching_method (unknown, optional)
- partial_settlement_enabled (unknown, optional)
- penalty_exposure_monitoring (unknown, optional)
- ssi_automation (unknown, optional)

## Outputs

- binding_deadline (object, optional)
- dim_scores (object, optional)
- dual_date_note (string, optional)
- firm_type (string, optional)
- gap_checklist (array, optional)
- jurisdictions (array, optional)
- note (string, optional)
- overall_score (integer, optional)
- primary_recommendation (string, optional)
- readiness_grade (string, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_t1_readiness_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
