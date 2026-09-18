# T+1 Settlement Readiness Diagnostic

12-question A-F diagnostic scoring a firm's readiness for the coordinated EU/UK/CH T+1 move (11 Oct 2027) against the Industry Roadmap phases, grading trade-date allocation/confirmation (the Dec-2026 23:00 CET machine-readable mandate), SSI automation, funding compression and CSDR-penalty exposure, and routing to the right settlement-discipline chain.

- Page: https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.md
- MCP tool: run_t1_readiness_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allocation_confirmation_timing (any, optional): type not evidenced by kernel source
- corporate_actions_readiness (any, optional): type not evidenced by kernel source
- csd_participations (any, optional): type not evidenced by kernel source
- firm_type (any, optional): type not evidenced by kernel source
- fx_funding_compression (any, optional): type not evidenced by kernel source
- instrument_classes (any, optional): type not evidenced by kernel source
- jurisdictions (any, optional): type not evidenced by kernel source
- matching_method (any, optional): type not evidenced by kernel source
- partial_settlement_enabled (any, optional): type not evidenced by kernel source
- penalty_exposure_monitoring (any, optional): type not evidenced by kernel source
- ssi_automation (any, optional): type not evidenced by kernel source

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
