# Reg E Remittance Disclosure Consistency Check

Deterministic recompute of the Reg E Subpart B (12 CFR 1005.31, implementing Dodd-Frank section 1073) remittance disclosure arithmetic identity: amount_received = (send_amount - total_fees) x exchange_rate. The caller supplies a provider's already-disclosed send amount, total fees, exchange rate, and recipient amount (all as integer cents / a rate scaled by 1,000,000, no floats); this kernel recomputes the identity and reports amount_recipient_recomputed, disclosure_consistent, and the exact discrepancy amount if any. Never fetches a live rate and never generates a fresh disclosure of its own - it verifies that numbers a provider already disclosed are internally consistent. Distinct from art-248-compute-remittance-disclosure, which computes a disclosure from scratch rather than checking one against a caller-declared recipient figure.

- Page: https://ainumbers.co/chaingraph/art-550-reg-e-remittance-disclosure-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-550-reg-e-remittance-disclosure-check.md
- MCP tool: check_reg_e_remittance_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amount_recipient_disclosed_cents (unknown, required)
- as_of (unknown, required)
- exchange_rate_disclosed_e6 (unknown, required)
- send_amount_cents (unknown, required)
- total_fees_disclosed_cents (unknown, required)

## Outputs

- amount_recipient_disclosed_cents (integer, optional)
- amount_recipient_recomputed_cents (integer, optional)
- amount_recipient_recomputed_display (string, optional)
- as_of (string, optional)
- disclosure_consistent (boolean, optional)
- discrepancy_amount_cents (integer, optional)
- discrepancy_amount_display (string, optional)
- exchange_rate_disclosed_display (string, optional)
- exchange_rate_disclosed_e6 (integer, optional)
- note (string, optional)
- rationale (array, optional)
- regulatory_basis (string, optional)
- rejected_inputs (array, optional)
- send_amount_cents (integer, optional)
- total_fees_disclosed_cents (integer, optional)

## Sample

```json
{
  "as_of": "2026-08-01",
  "send_amount_cents": 50000,
  "total_fees_disclosed_cents": 1500,
  "exchange_rate_disclosed_e6": 850000,
  "amount_recipient_disclosed_cents": 41225
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_reg_e_remittance_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
