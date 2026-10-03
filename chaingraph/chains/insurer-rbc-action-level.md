# Insurer RBC Action Level Assessment

Gated two-step chain for NAIC RBC capital adequacy assessment and claims STP economics. Step 1 computes the RBC action level (TAC/ACL ratio) and classifies into NO_ACTION / COMPANY_ACTION / REGULATORY_ACTION / AUTHORIZED_CONTROL / MANDATORY_CONTROL per NAIC Model Laws #312/#315/#315H. Gate on /action_level_code: if NO_ACTION (above 200% ACL), the chain ends - insurer is well-capitalised and no corrective action is required. Default (below 200% ACL): Step 2 computes claims STP economics to model the financial impact of automation investment as a capital restoration pathway. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/insurer-rbc-action-level.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/insurer-rbc-action-level.md

## Workflow chain: Insurer RBC Action Level Assessment

Gated two-step chain for NAIC RBC capital adequacy assessment and claims STP economics. Step 1 computes the RBC action level (TAC/ACL ratio) and classifies into NO_ACTION / COMPANY_ACTION / REGULATORY_ACTION / AUTHORIZED_CONTROL / MANDATORY_CONTROL per NAIC Model Laws #312/#315/#315H. Gate on /action_level_code: if NO_ACTION (above 200% ACL), the chain ends - insurer is well-capitalised and no corrective action is required. Default (below 200% ACL): Step 2 computes claims STP economics to model the financial impact of automation investment as a capital restoration pathway. ZERO PII BY CONSTRUCTION.

Domain: Insurance & Reinsurance

### Steps

1. art-254-compute-rbc-action-level
   RBC ratio (TAC/ACL%), action_level_code, and headroom_to_next_level_pct. Gate on /action_level_code: NO_ACTION exits (well-capitalised). Default (below 200% ACL): proceed to claims STP economics model.
2. art-257-calculate-claims-stp-economics
   Claims STP ROI: NPV, IRR, payback_years, net_annual_benefit, and per-claim cost reduction. Final stage - models automation investment as capital improvement lever.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The year-end ratio is filed. Which NAIC RBC action level does the company land on, and how far is the next trigger?
Run the AINumbers MCP tool `run_chain` with {"chain":"insurer-rbc-action-level"} and read `art-254-compute-rbc-action-level.action_level_code`.
Re-run with `inputs` for `art-254-compute-rbc-action-level`, reusing the values that result echoed, with `total_adjusted_capital` set to 60000000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/insurer-rbc-action-level.html
