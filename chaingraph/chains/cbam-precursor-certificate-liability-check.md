# CBAM Precursor Certificate Liability Check

Price a complex good in CBAM certificates in three independent runs plus a session receipt: roll up precursor emissions for a declared final good and quantity (ART-72), calculate consignment embedded emissions from declared direct data and a declared precursor total (ART-69), then model the certificate liability, holding schedule and surrender deadline from the declared embedded total (ART-71), closing with a session receipt aggregating the run execution hashes (CRY-05). Each run computes from its own declared inputs. This chain is decision support, not a filed CBAM declaration, not a verification, and not a surrender of certificates.

- Page: https://ainumbers.co/chaingraph/chains/cbam-precursor-certificate-liability-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbam-precursor-certificate-liability-check.md

## Workflow chain: CBAM Precursor Certificate Liability Check

Price a complex good in CBAM certificates in three independent runs plus a session receipt: roll up precursor emissions for a declared final good and quantity (ART-72), calculate consignment embedded emissions from declared direct data and a declared precursor total (ART-69), then model the certificate liability, holding schedule and surrender deadline from the declared embedded total (ART-71), closing with a session receipt aggregating the run execution hashes (CRY-05). Each run computes from its own declared inputs. This chain is decision support, not a filed CBAM declaration, not a verification, and not a surrender of certificates.

Domain: CBAM

### Steps

1. art-72-cbam-precursor-emissions-aggregator
   Rolls up embedded emissions across declared precursors for a declared final good and quantity, with a per-precursor breakdown, a mass-fraction total, and a data quality grade. The 2028 pre-consumer-scrap rule is applied only when a scrap input share is declared, and its credit modelling is a preliminary approximation to verify against final text.
2. art-69-cbam-embedded-emissions-calculator
   Calculates consignment embedded emissions from declared direct and indirect data, a declared good category, country of origin and quantity, plus a declared precursor total cited from the step 1 run. The run states its emissions basis as actual or default in its own record, and its indirect component uses the kernel built-in factor described on the chain page.
3. art-71-cbam-certificate-cost-engine
   Models certificate liability from a declared embedded total, a declared factor year, declared EUA prices and a declared origin carbon price, with a de minimis screen, a quarterly holding schedule, a purchase window and a surrender deadline. The 2026 vintage uses quarterly-average-of-quarter-of-importation pricing; weekly closing-average pricing applies from 2027 onward. Repurchase and cancellation are not modelled by this step.
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run execution hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: What does this complex good cost in CBAM certificates, on declared inputs?
Run the AINumbers MCP tool `run_chain` with {"chain":"cbam-precursor-certificate-liability-check"} and read `art-71-cbam-certificate-cost-engine.certificates_required`.
Re-run with `inputs` for `art-71-cbam-certificate-cost-engine`, reusing the values that result echoed, with `eua_reference_price` changed so the EUA reference price is higher. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cbam-precursor-certificate-liability-check.html
