# Canton DvP Atomicity Validator

Validate atomic DvP settlement on Canton Network against PFMI Principle 12. Generate a counterparty-verifiable settlement-readiness attestation with execution_hash. Eliminates Herstatt risk.

- Page: https://ainumbers.co/tools/507-canton-dvp-atomicity-validator.html
- Markdown twin: https://ainumbers.co/tools/507-canton-dvp-atomicity-validator.md
- MCP tool: validate_canton_dvp_atomicity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- trade_id (string, required)
- instrument (string, optional)
- notional (number, required)
- securities_currency (string, optional)
- custodian (string, optional)
- cash_type (string, optional)
- cash_amount (number, optional)
- cash_currency (string, optional)
- platform (string, required)
- atomicity (string, required)
- finality (string, required)
- unwind_procedure (boolean, optional)
- dtc_fed_eligible (boolean, optional)
- netting_enabled (boolean, optional)

## Outputs

- verdict (string, optional)
- atomicity_flag (string, optional)
- finality_flag (string, optional)
- herstatt_flag (string, optional)
- compliance_flags (object, optional)
- pacs008 (object, optional)
- execution_hash (string, optional)

## Sample

```json
{
  "settlement_mechanism": "atomic_dvp",
  "platform": "canton_daml",
  "finality_type": "irrevocable_realtime",
  "unwind_protection": true,
  "cash_type": "cbdc",
  "settlement_amount": 1000000,
  "currency": "USD"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_canton_dvp_atomicity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
