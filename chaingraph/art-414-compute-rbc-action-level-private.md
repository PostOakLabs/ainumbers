# Private-Input NAIC RBC Action Level

Computes the NAIC Risk-Based Capital action-level tier from a privately held Total Adjusted Capital and Authorized Control Level RBC, emitting only the tier (NO_ACTION through MANDATORY_CONTROL) without disclosing the underlying dollar figures. Carries an OCG Standard §25 ocg-private-input@1 declaration: the capital components are committed via sha256-salted@1 in policy_parameters.rbc_components_commitment, never in the clear. Private-input variant of compute_rbc_action_level (art-254); use that public-input kernel when disclosure of the capital figures is acceptable; use this one when it is not. ZERO PII disclosed: only the action-level tier is public.

- Page: https://ainumbers.co/chaingraph/art-414-compute-rbc-action-level-private.html
- Markdown twin: https://ainumbers.co/chaingraph/art-414-compute-rbc-action-level-private.md
- MCP tool: compute_rbc_action_level_private (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- table_version (unknown, required)

## Outputs

- action_level_code (string, optional)
- action_level_description (string, optional)
- action_level_label (string, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "rbc_components_commitment": "sha256:12e43a55ca7616950fd6ff82588aa2002787dc8acea63566dd2e478641783225",
  "table_version": "NAIC-RBC-ACTION-LEVELS-2024",
  "table_source": "NAIC RBC Instructions (2024 edition): Life RBC (LR023), P&C RBC (Exhibit 1), Health RBC (HR-1). NAIC Model Laws: Life Insurance RBC Model Law #312 (life), #315 (P&C), #315H (health).",
  "insurer_type": "pc"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_rbc_action_level_private` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
