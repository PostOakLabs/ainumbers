# Canton Tokenization Readiness Diagnostic

12-question weighted diagnostic across six readiness domains for Canton Network pilots: settlement ops, custody, cash-leg, privacy, AML/KYA, and capital. Routes to the correct workflow chain based on gap scores.

- Page: https://ainumbers.co/tools/503-canton-tokenization-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/tools/503-canton-tokenization-readiness-diagnostic.md
- MCP tool: diagnose_canton_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity_name (string, required): Illustrative entity name
- lei (string, optional): Legal Entity Identifier (optional, 20 chars)
- entity_type (string, required)
- q1 (boolean, required): Has your ops team tested atomic DvP/PvP settlement end-to-end?
- q2 (boolean, required): Do you have a settlement-failure / unwind procedure defined?
- q3 (boolean, required): Are your target assets DTC-eligible or Fed-eligible?
- q4 (boolean, required): Have you mapped tokenized assets to HQLA tiers?
- q5 (boolean, required): Have you identified a regulated cash-leg provider (USDC, deposit token)?
- q6 (boolean, required): Has your cash-leg provider completed a reserve attestation?
- q7 (boolean, required): Have you configured Daml party visibility / sub-transaction privacy?
- q8 (boolean, required): Does your privacy config satisfy AML / audit disclosure obligations?
- q9 (boolean, required): Have you completed counterparty KYA for Canton onboarding?
- q10 (boolean, required): Have you screened all parties against FATF Travel Rule requirements?
- q11 (boolean, required): Have you assessed SCO60 Group 1a treatment for your tokenized assets?
- q12 (boolean, required): Have you engaged your prudential regulator on the Canton pilot?

## Outputs

- domain_scores (object, required)
- gaps (array, required)
- total_score (number, required)
- verdict (string, required)

## Sample

```json
{
  "q1": "yes",
  "q2": "yes",
  "q3": "no",
  "q4": "no",
  "q5": "no",
  "q6": "no",
  "q7": "no",
  "q8": "no",
  "q9": "no",
  "q10": "no",
  "q11": "no",
  "q12": "no"
}
```

## Verify

Run the sample policy_parameters through MCP tool `diagnose_canton_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
