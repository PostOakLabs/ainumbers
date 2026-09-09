# Allocation Decision Receipt

Linear three-step chain instantiating the allocation-decision-receipt pattern on a collateral-allocation worked example. Step 1 classifies each candidate asset's DTC/Fed eligibility and Basel HQLA tier. Step 2 applies the Basel CRE22 comprehensive-approach haircut to each eligible candidate. Step 3 re-derives whether the allocation actually chosen is explained by the declared objective over the eligibility and haircut snapshots that were true at the time, reporting a reproducibility verdict and the binding constraint behind any divergence. All three steps always run; the node's re-derivation logic is portable to any optimizer, this chain is one collateral instance of it.

- Page: https://ainumbers.co/chaingraph/chains/allocation-decision-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/allocation-decision-receipt.md

## Workflow chain: Allocation Decision Receipt

Linear three-step chain instantiating the allocation-decision-receipt pattern on a collateral-allocation worked example. Step 1 classifies each candidate asset's DTC/Fed eligibility and Basel HQLA tier. Step 2 applies the Basel CRE22 comprehensive-approach haircut to each eligible candidate. Step 3 re-derives whether the allocation actually chosen is explained by the declared objective over the eligibility and haircut snapshots that were true at the time, reporting a reproducibility verdict and the binding constraint behind any divergence. All three steps always run; the node's re-derivation logic is portable to any optimizer, this chain is one collateral instance of it.

Domain: Bank Capital & Credit Risk

### Steps

1. 505-tokenized-collateral-eligibility-checker
   DTC/Fed eligibility and Basel HQLA tier of each candidate feed the haircut step's eligibility snapshot.
2. art-444-collateral-haircut-engine
   Basel CRE22 haircut applied per candidate feeds the haircut-table-version input to the allocation re-derivation.
3. art-515-build-allocation-decision-receipt
   Re-derives the chosen allocation against the declared objective over the eligibility schedule and haircut snapshots from steps 1-2. Reproducibility verdict, delta, and binding constraint are the chain output. Terminal stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
