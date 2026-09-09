# Compute Disparate Impact Metrics

Computes three fair lending disparate impact metrics from aggregate lending counts: 4/5ths (80%) rule (adverse_impact_ratio) per EEOC 29 CFR §1607.4(D), z-statistic for statistical significance of the approval-rate difference, and standardised mean difference (Cohen's d). Inputs are aggregate counts only; no individual applicant records, names, demographic identifiers, or scores. ZERO PII BY CONSTRUCTION. EEOC Uniform Guidelines on Employee Selection Procedures (29 CFR §1607), HMDA/Reg C.

- Page: https://ainumbers.co/chaingraph/art-229-compute-disparity-metrics.html
- Markdown twin: https://ainumbers.co/chaingraph/art-229-compute-disparity-metrics.md
- MCP tool: compute_disparity_metrics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- group_a_approvals (number, optional)
- group_a_label (unknown, required)
- group_a_total (number, optional)
- group_b_approvals (number, optional)
- group_b_label (unknown, required)
- group_b_total (number, optional)

## Outputs

- adverse_impact_ratio (number, optional)
- four_fifths_flag (boolean, optional)
- four_fifths_result (string, optional)
- four_fifths_threshold (number, optional)
- group_a (object, optional)
- group_b (object, optional)
- n_total (integer, optional)
- odds_ratio (number, optional)
- pii_note (string, optional)
- pooled_proportion (number, optional)
- regulatory_basis (string, optional)
- standardized_mean_difference (number, optional)
- table_source (string, optional)
- table_version (string, optional)
- two_proportion_z (number, optional)
- z_critical_flag_onetail_05 (boolean, optional)
- z_critical_flag_twotail_05 (boolean, optional)
- zero_pii_confirmation (string, optional)

## Sample

```json
{
  "group_a_label": "protected_class",
  "group_b_label": "control_group",
  "group_a_approvals": 70,
  "group_a_total": 100,
  "group_b_approvals": 90,
  "group_b_total": 100
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_disparity_metrics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
