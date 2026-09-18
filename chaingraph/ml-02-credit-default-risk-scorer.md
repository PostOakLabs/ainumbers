# Credit Default Risk Scorer

Logistic regression PD scorer on synthetic loan portfolio with Basel 3.1 F-IRB / A-IRB / SA RWA comparison (BCBS d424 formula, Φ⁻¹ Horner rational approximation). AUC-ROC trapezoid, KS statistic, Gini coefficient (EBA GL/2017/16 model performance thresholds). Chains from ART-05 (EU AI Act conformity). Feeds SIM-03 (Basel RWA Scenario Modeler).

- Page: https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.md
- MCP tool: score_credit_default_risk (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_class (any, required): type not evidenced by kernel source
- lgd (any, required): type not evidenced by kernel source
- maturity_yrs (any, required): Duration in years; type not evidenced by kernel source
- n_loans (number, required)
- pd_threshold (any, required): type not evidenced by kernel source
- preset (any, required): type not evidenced by kernel source
- seed (any, required): type not evidenced by kernel source
- target_default_rate (any, required): type not evidenced by kernel source

## Outputs

- auc_roc (number, optional)
- compliance_flags (array, optional)
- expected_loss_gbp (integer, optional)
- gini_coefficient (number, optional)
- high_pd_loans (integer, optional)
- irb_capital_gbp (integer, optional)
- irb_rwa_gbp (integer, optional)
- irb_vs_sa_saving (integer, optional)
- ks_statistic (number, optional)
- n_defaults_observed (integer, optional)
- n_loans_scored (integer, optional)
- portfolio_pd (number, optional)
- sa_capital_gbp (integer, optional)
- sa_rwa_gbp (integer, optional)
- total_ead_gbp (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "n_loans": 10,
  "asset_class": "retail_mortgage",
  "target_default_rate": 0.05,
  "lgd": 0.45,
  "maturity_yrs": 2.5,
  "pd_threshold": 0.5,
  "seed": 11
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_credit_default_risk` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
