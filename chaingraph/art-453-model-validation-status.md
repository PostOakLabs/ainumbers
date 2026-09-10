# Model Validation Status Assessor

Determines a model's SR 26-2 validation status by combining its proportionality tier, last-validation date, and most recent outcome-analysis result against a tier-based revalidation cadence (high=365 days, moderate=730, limited=1095, overridable). Returns validated / conditionally-approved / validation-overdue / restricted-use / validation-required plus days-since-validation and next-due-in-days. Third and final node in the model-passport lifecycle (after art-450 inventory entry and art-451 outcome-analysis comparison) - the passport's headline field. Dates are caller-declared (as_of_date) and diffed with integer civil-calendar arithmetic, never the system clock, so the result is fully deterministic. Distinct from the shipped program-level gap analyzers (tools 339/451 SR 26-02 and SR 11-7 gap assessors), which score an institution's overall MRM program rather than one model's cadence status. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-453-model-validation-status.html
- Markdown twin: https://ainumbers.co/chaingraph/art-453-model-validation-status.md
- MCP tool: assess_model_validation_status (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- cadence_days_override (unknown, required)
- last_validation_date (unknown, required)
- outcome_status (unknown, required)
- tier (unknown, required)

## Outputs

- as_of_date (string, optional)
- cadence_days (integer, optional)
- days_since_validation (integer, optional)
- last_validation_date (string, optional)
- never_validated (boolean, optional)
- next_validation_due_days (integer, optional)
- outcome_status (string, optional)
- overdue (boolean, optional)
- tier (string, optional)
- validation_status (string, optional)

## Sample

```json
{
  "tier": "high",
  "last_validation_date": "2025-08-01",
  "as_of_date": "2026-01-15",
  "outcome_status": "pass"
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_model_validation_status` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
