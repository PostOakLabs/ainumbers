# Crypto-Asset Tax Reporting (CARF / DAC8 / 1099-DA)

CARF/DAC8 reportable classification > cost-basis and gain/loss calculation > IRS Form 1099-DA assembly > CASP readiness scoring.

- Page: https://ainumbers.co/chaingraph/chains/crypto-tax-reporting.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/crypto-tax-reporting.md

## Workflow chain: Crypto-Asset Tax Reporting (CARF / DAC8 / 1099-DA)

CARF/DAC8 reportable classification > cost-basis and gain/loss calculation > IRS Form 1099-DA assembly > CASP readiness scoring.

Domain: Digital-Asset Rails

### Steps

1. 465-carf-dac8-reportable-classifier
   reportable_users and reportable_txns feed Stage 2 basis calc
2. 466-crypto-cost-basis-gain-calculator
   gain_loss_schedule feeds Stage 3 1099-DA assembly
3. 467-form-1099-da-generator
   filing_records feed Stage 4 readiness scoring
4. 468-casp-tax-reporting-readiness-scorer
   Exports crypto-tax reporting Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
