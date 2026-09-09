# On-Chain Cash-Leg Finality Checker

Validate USDC/deposit-token cash-leg finality, reserve attestation, and GENIUS Act / MiCA compliance for Canton settlement. Emits a finality_verdict and GENIUS PPSI / MiCA EMT conformance flags.

- Page: https://ainumbers.co/tools/506-onchain-cash-leg-finality-checker.html
- Markdown twin: https://ainumbers.co/tools/506-onchain-cash-leg-finality-checker.md
- MCP tool: check_cash_leg_finality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cash_leg_type (string, required): Type of on-chain cash instrument.
- amount (number, required): Settlement amount in stated currency.
- currency (string, required)
- finality_model (string, required): Cash-leg finality mechanism. Assessed against CPMI-IOSCO PFMI Principles 8 and 12.
- jurisdiction (string, required): Regulatory jurisdiction. us → GENIUS Act check; eu → MiCA Title III check.
- reserve_attestation_available (boolean, optional)
- cash_pct (number, optional): Cash / FDIC-insured deposit % of reserves.
- tbills_pct (number, optional): T-bills ≤93 days % of reserves.
- repo_pct (number, optional): Fed overnight repo % of reserves.
- depeg_defined (boolean, optional)
- depeg_threshold (number, optional): Depeg circuit-breaker trigger % (default 0.5). >1.0 → DEPEG_THRESHOLD_WIDE.
- redemption_window (string, optional)

## Outputs

- verdict (string, optional)
- finality_flag (string, optional)
- genius_status (string, optional)
- mica_status (string, optional)
- compliance_flags (object, optional)
- mandate_type (string, optional)

## Sample

```json
{
  "finality_model": "atomic_dvp_bound",
  "jurisdiction": "us",
  "reserve_attestation": true,
  "cash_pct": 60,
  "tbills_pct": 35,
  "repo_pct": 5,
  "depeg_bps": 2,
  "redemption_window": "t0"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_cash_leg_finality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
