# Open Banking Consent Flow Stress Simulator

Monte Carlo stress simulation of PSD2/FAPI 2.0/CDR consent lifecycle FSM (INIT→REDIRECT→AUTH→AUTHORIZED→ACTIVE→FAILED/EXPIRED/REVOKED). Configurable failure probabilities per transition stage, terminal state distribution, ASPSP SCA availability compliance check (95% threshold). Chains from PNR-01 (DORA ICT cascade).

- Page: https://ainumbers.co/chaingraph/sim-07-open-banking-consent-flow-stress.html
- Markdown twin: https://ainumbers.co/chaingraph/sim-07-open-banking-consent-flow-stress.md
- MCP tool: simulate_consent_stress (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- nConsents (number, required)
- pAuthFail (number, required)
- pExpiry (number, required)
- pRedirectFail (number, required)
- pRevoke (number, required)
- pTokenFail (number, required)
- regime (unknown, required)
- seed (number, required)

## Outputs

- consents_active (integer, optional)
- consents_expired (integer, optional)
- consents_failed (integer, optional)
- consents_revoked (integer, optional)
- mean_fsm_steps (number, optional)
- regulatory_regime (string, optional)
- stage_failures (object, optional)
- success_rate (number, optional)
- total_flows (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "nConsents": 500,
  "seed": 42,
  "regime": "psd2",
  "pRedirectFail": 0.03,
  "pAuthFail": 0.08,
  "pTokenFail": 0.02,
  "pExpiry": 0.05,
  "pRevoke": 0.04
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_consent_stress` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
