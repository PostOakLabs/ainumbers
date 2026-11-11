# IRRBB NMD Ladder SOT EVE Check

Check interest rate risk in the banking book in three independent runs plus a session receipt: map non-maturity deposit balances into a bucketed net repricing gap schedule under a caller-declared behavioral allocation (ART-442), sweep the prescribed US parallel shock ladder over that schedule and name the rung with the lowest delta-EVE (ART-369), then compare that worst delta-EVE against 15 percent of Tier 1 capital as a ladder-based proxy outlier indication (ART-184), closing with a session receipt aggregating the run execution hashes (CRY-05). All balances, allocations, betas, gaps, and capital are caller-supplied inputs; each run is an independent recompute from its own declared inputs. This chain is an analytical check and a comparison against a threshold under a stated ladder.

- Page: https://ainumbers.co/chaingraph/chains/nmd-ladder-sot-eve-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/nmd-ladder-sot-eve-check.md

## Workflow chain: IRRBB NMD Ladder SOT EVE Check

Check interest rate risk in the banking book in three independent runs plus a session receipt: map non-maturity deposit balances into a bucketed net repricing gap schedule under a caller-declared behavioral allocation (ART-442), sweep the prescribed US parallel shock ladder over that schedule and name the rung with the lowest delta-EVE (ART-369), then compare that worst delta-EVE against 15 percent of Tier 1 capital as a ladder-based proxy outlier indication (ART-184), closing with a session receipt aggregating the run execution hashes (CRY-05). All balances, allocations, betas, gaps, and capital are caller-supplied inputs; each run is an independent recompute from its own declared inputs. This chain is an analytical check and a comparison against a threshold under a stated ladder.

Domain: IRRBB

### Steps

1. art-442-nmd-behavioral-repricing-mapper
   Maps caller-declared non-maturity deposit segment balances into a bucketed net repricing gap schedule using a caller-declared behavioral allocation and a deposit beta. The schedule uses the bucket keys on_1m, m1_y1, y1_y3, y3_y5, y5_y10, y10_plus, the same keys the step 2 run declares for its repricing gaps. No decay curve is supplied by this step.
2. art-369-run-rate-shock-ladder
   Sweeps the prescribed parallel magnitudes (+100, +200, +300, +400 basis points and their negatives) over a bucketed repricing gap schedule, reporting a duration-weighted delta-EVE leg and a 12-month cumulative-gap delta-NII leg per shock, with worst_scenario naming the rung with the lowest delta-EVE. The schedule in the chain page worked example is the step 1 schedule, declared again with the same bucket keys. worst_scenario reads as a ladder magnitude, for example parallel_down_400bp.
3. art-184-irrbb-sot-eve-evaluator
   Compares the worst delta-EVE cited from the step 2 run against 15 percent of caller-declared Tier 1 capital and reports a ladder-based proxy outlier indication. The step 3 run takes worst_delta_eve as a caller-passed field into eve_shock.worst_delta_eve, since the step 3 node declared predecessor is art-183, and the step 2 to step 3 link is a caller field pass. In the chain page worked example the step 2 run reports worst_delta_eve -246200 and the step 3 run compares it against Tier 1 capital 1000000, giving 24.62 percent and eve_outlier true as a ladder-based proxy outlier indication.
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run execution hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Under the US parallel ladder, what is the ladder-based proxy outlier indication against 15 percent of Tier 1 capital?
Run the AINumbers MCP tool `run_chain` with {"chain":"nmd-ladder-sot-eve-check"} and read `art-184-irrbb-sot-eve-evaluator.eve_outlier`.
Re-run with `inputs` for `art-184-irrbb-sot-eve-evaluator`, reusing the values that result echoed, with `capital` changed so Tier 1 capital is larger. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/nmd-ladder-sot-eve-check.html
