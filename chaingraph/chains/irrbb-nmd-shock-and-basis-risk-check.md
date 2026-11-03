# IRRBB NMD Shock and Basis Risk Check

Check interest rate risk in the banking book in three independent runs plus a session receipt: map non-maturity deposit balances into a bucketed net repricing gap schedule under a caller-declared behavioral allocation (ART-442), sweep the prescribed parallel shock ladder over that schedule and name the binding rung (ART-369), then run the basis-risk calculation at the binding rung cited from the ladder run (ART-443), closing with a session receipt aggregating the run's execution hashes (CRY-05). All balances, allocations, betas, and gaps are caller-supplied inputs; each run is an independent recompute from its own declared inputs. This chain is an analytical check, not a regulatory filing and not a capital adequacy determination.

- Page: https://ainumbers.co/chaingraph/chains/irrbb-nmd-shock-and-basis-risk-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/irrbb-nmd-shock-and-basis-risk-check.md

## Workflow chain: IRRBB NMD Shock and Basis Risk Check

Check interest rate risk in the banking book in three independent runs plus a session receipt: map non-maturity deposit balances into a bucketed net repricing gap schedule under a caller-declared behavioral allocation (ART-442), sweep the prescribed parallel shock ladder over that schedule and name the binding rung (ART-369), then run the basis-risk calculation at the binding rung cited from the ladder run (ART-443), closing with a session receipt aggregating the run's execution hashes (CRY-05). All balances, allocations, betas, and gaps are caller-supplied inputs; each run is an independent recompute from its own declared inputs. This chain is an analytical check, not a regulatory filing and not a capital adequacy determination.

Domain: IRRBB

### Steps

1. art-442-nmd-behavioral-repricing-mapper
   Maps caller-declared non-maturity deposit segment balances into a bucketed net repricing gap schedule using a caller-declared behavioral allocation and a deposit beta. The schedule uses the bucket keys on_1m, m1_y1, y1_y3, y3_y5, y5_y10, y10_plus, the same keys the step 2 run declares for its repricing gaps. No decay curve is supplied by this step.
2. art-369-run-rate-shock-ladder
   Sweeps the prescribed parallel magnitudes (+100, +200, +300, +400 basis points and their negatives) over a bucketed repricing gap schedule, reporting a duration-weighted delta-EVE leg and a 12-month cumulative-gap delta-NII leg per shock, with worst_scenario naming the rung with the lowest delta-EVE. The schedule in the chain page worked example is the step 1 schedule, declared again with the same bucket keys.
3. art-443-irrbb-basis-risk-nii-shock-calculator
   Runs at the binding rung cited from the step 2 run: the step 3 run uses reference_shock_bps equal to the shock of the worst_scenario reported by the step 2 run. In the chain page worked example the step 2 run reports worst_scenario parallel_down_400bp, so the step 3 run uses reference_shock_bps -400. Each priced index carries a caller-declared beta against that reference shock, and the step reports the incremental delta-NII from indices not moving in lockstep.
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Rates move. Which shock rung hurts our economic value most, and how large is the loss?
Run the AINumbers MCP tool `run_chain` with {"chain":"irrbb-nmd-shock-and-basis-risk-check"} and read `art-369-run-rate-shock-ladder.worst_scenario`.
Re-run with `inputs` for `art-369-run-rate-shock-ladder`, reusing the values that result echoed, with `nii_12m_gap` changed so the 12-month NII gap is larger. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/irrbb-nmd-shock-and-basis-risk-check.html
