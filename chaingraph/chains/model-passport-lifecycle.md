# Model Passport Lifecycle

Linear three-step chain building an SR 26-2 model passport. Step 1 registers a model-inventory record with a completeness score and proportionality tier (art-450). Step 2 backtests the model's period predicted-vs-actual outcomes against a caller-declared error tolerance (art-451). Step 3 determines the model's SR 26-2 validation status from its tier, last-validation date, and the outcome-analysis result, applying a tier-based revalidation cadence (art-453), which also carries a terminal §27 review_required accountability gate on a restricted_use validation status.

- Page: https://ainumbers.co/chaingraph/chains/model-passport-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/model-passport-lifecycle.md

## Workflow chain: Model Passport Lifecycle

Linear three-step chain building an SR 26-2 model passport. Step 1 registers a model-inventory record with a completeness score and proportionality tier (art-450). Step 2 backtests the model's period predicted-vs-actual outcomes against a caller-declared error tolerance (art-451). Step 3 determines the model's SR 26-2 validation status from its tier, last-validation date, and the outcome-analysis result, applying a tier-based revalidation cadence (art-453), which also carries a terminal §27 review_required accountability gate on a restricted_use validation status.

Domain: Bank Capital & Credit Risk

### Steps

1. art-450-model-inventory-entry
   Model-inventory record with proportionality tier and completeness score. Passes to outcome-analysis backtest.
2. art-451-model-outcome-analysis
   Predicted-vs-actual outcome backtest with pass/fail status against the declared breach-rate tolerance. Passes to validation-status determination.
3. art-453-model-validation-status
   Final SR 26-2 validation status, days-since-validation, and next-due-in-days. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
