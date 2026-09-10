# NAIC RBC Action Level Calculator

Computes NAIC Risk-Based Capital (RBC) action level classification for US P&C, life, and health insurers. RBC ratio = TAC / ACL * 100%. Action levels: NO_ACTION (>=200%), COMPANY_ACTION (150-200%), REGULATORY_ACTION (100-150%), AUTHORIZED_CONTROL (70-100%), MANDATORY_CONTROL (<70%). Also runs the NAIC trend test (10+ ppt decline two consecutive years with ratio <250%) when prior-year data supplied. Applies NAIC RBC Model Laws #312 (life), #315 (P&C), #315H (health). Use in insurer-rbc-action-level chain (gated on NO_ACTION). ZERO PII: capital totals only.

- Page: https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.html
- Markdown twin: https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.md
- MCP tool: compute_rbc_action_level (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- authorized_control_level (unknown, required)
- insurer_type (unknown, required)
- prior_year_rbc_ratio (unknown, required)
- total_adjusted_capital (unknown, required)
- two_year_rbc_ratio (unknown, required)

## Outputs

- action_level_code (string, optional)
- action_level_description (string, optional)
- action_level_label (string, optional)
- action_levels_reference (array, optional)
- authorized_control_level (integer, optional)
- headroom_to_next_level_pct (integer, optional)
- insurer_type (string, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- prior_year_rbc_ratio (string, optional)
- rbc_ratio_pct (integer, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- threshold_breached_pct (string, optional)
- total_adjusted_capital (integer, optional)
- trend_test_applicable (boolean, optional)
- trend_test_triggered (boolean, optional)
- two_year_rbc_ratio (string, optional)

## Sample

```json
{
  "total_adjusted_capital": 300000000,
  "authorized_control_level": 100000000,
  "insurer_type": "pc"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_rbc_action_level` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
