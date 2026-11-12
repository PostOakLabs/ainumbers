# eSLR Recalibration Call Report Check

A GSIB or its covered depository subsidiary recomputes leverage under the recalibrated enhanced supplementary leverage ratio, maps balance sheet and regulatory capital into FFIEC Call Report schedules RC and RC-R, and runs the published Call Report edit checks over the filed figures before submission. The chain answers one question: do the ratios the bank computed survive, unchanged and internally consistent, into the schedules it files? Schedule RC-R outputs map to RC-R Part I items 56.a and 56.b, FFIEC 031, from the 30 June 2026 report. Each run computes from its own declared inputs, and each run hash is cited in the session receipt. This chain does not file a Call Report, does not derive GSIB status or the method-1 surcharge, and does not cover LTD or TLAC conforming changes.

- Page: https://ainumbers.co/chaingraph/chains/eslr-recalibration-call-report-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eslr-recalibration-call-report-check.md

## Workflow chain: eSLR Recalibration Call Report Check

A GSIB or its covered depository subsidiary recomputes leverage under the recalibrated enhanced supplementary leverage ratio, maps balance sheet and regulatory capital into FFIEC Call Report schedules RC and RC-R, and runs the published Call Report edit checks over the filed figures before submission. The chain answers one question: do the ratios the bank computed survive, unchanged and internally consistent, into the schedules it files? Schedule RC-R outputs map to RC-R Part I items 56.a and 56.b, FFIEC 031, from the 30 June 2026 report. Each run computes from its own declared inputs, and each run hash is cited in the session receipt. This chain does not file a Call Report, does not derive GSIB status or the method-1 surcharge, and does not cover LTD or TLAC conforming changes.

Domain: Bank Capital & Credit Risk

### Steps

1. art-364-compute-lcr-nsfr-leverage
   Leverage run over caller-supplied positions. Cited outputs: leverage.leverage_ratio_pct, leverage.total_exposure_musd, leverage.gsib_leverage_buffer_pct in percentage points (gsib_bucket x 0.5, kernel line 118). Its execution hash is cited in the session receipt.
2. art-432-call-report-rc-balance-sheet
   Schedule RC run over caller-declared FFIEC 031 line items. Cited outputs: total_assets_usd (RCON2170), total_liabilities_usd (RCON2948), total_equity_capital_usd (RCON3210), with the balance-sheet identity check. Its execution hash is cited in the session receipt.
3. art-433-call-report-rcr-capital
   Schedule RC-R run over caller-declared capital components. Cited outputs: ratios.supplementary_leverage_ratio_pct and the eslr block (buffer_pct, required_slr_pct, pass). The caller copies the art-364 gsib_leverage_buffer_pct by hand, converts percentage points to a fraction by dividing by 100, applies the subsidiary cap, and enters the result as eslr_buffer_pct. The caller also converts total_exposure_musd to USD by multiplying by 1,000,000 for total_leverage_exposure_usd. The 0.02 default is never used. Its execution hash is cited in the session receipt.
4. art-434-call-report-edit-check-gate
   Edit-check gate over the art-432 and art-433 output payloads. Cited outputs: per-check pass/fail verdicts and gate_status auto_pass or review_required. The art-432 and art-433 output payloads are the inputs this gate checks; both links are declared graph edges. Its execution hash is cited in the session receipt.
5. cry-05-agent-action-audit-trail-aggregator
   Session receipt: one SHA-256 Merkle root over the ordered execution hashes of the runs above, with per-leaf inclusion proofs. Terminal stage. This step aggregates hashes and carries no compute proof of its own.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does the filed supplementary leverage ratio still clear the recalibrated eSLR buffer after capping?
Run the AINumbers MCP tool `run_chain` with {"chain":"eslr-recalibration-call-report-check"} and read `art-433-call-report-rcr-capital.eslr.pass`.
Re-run with `inputs` for `art-433-call-report-rcr-capital`, reusing the values that result echoed, with `eslr_buffer_pct` set to 0.0075. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/eslr-recalibration-call-report-check.html
