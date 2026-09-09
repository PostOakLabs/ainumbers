# Private-Input Capital Adequacy Check

Checks a privately held eligible-capital and risk-weighted-assets figure against a pinned regulatory minimum (Basel III/3.1 CET1, or Solvency II SCR coverage), emitting only an above/below-minimum verdict and tier without disclosing capital or RWA. Carries an OCG Standard §25 ocg-private-input@1 declaration: the capital inputs are committed via sha256-salted@1 in policy_parameters.capital_inputs_commitment, never in the clear. Private-input variant of compute_basel31_delta (art-07) / calculate_solvency2_scr_ratio (art-180); use those public-input kernels when disclosure of the capital figures is acceptable; use this one when it is not. ZERO PII disclosed: only the above/below-minimum verdict is public.

- Page: https://ainumbers.co/chaingraph/art-415-check-capital-adequacy-private.html
- Markdown twin: https://ainumbers.co/chaingraph/art-415-check-capital-adequacy-private.md
- MCP tool: check_capital_adequacy_private (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- regulatory_minimum_pct (unknown, required): Percentage value

## Outputs

- above_minimum (boolean, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- regulatory_minimum_pct (number, optional)
- tier (string, optional)

## Sample

```json
{
  "capital_inputs_commitment": "sha256:9b88a33cf57fd0048ac98cecbfbb26f1b29401374bc524a3bb4c3ea098f7e81b",
  "regulatory_minimum_pct": 10.5,
  "regulatory_citation": "Basel III/3.1 CET1 minimum incl. capital conservation buffer (BCBS d424); Solvency II SCR coverage minimum 100% (Delegated Regulation (EU) 2015/35).",
  "regime": "basel3.1"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_capital_adequacy_private` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
