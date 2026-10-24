# Garnishment Withholding Check

Verify a paycheck's garnishment withholding in three recompute stages: first compute federal income tax withholding by the IRS Publication 15-T percentage method for the declared tax year edition (ART-338), then compute gross-to-net pay with FICA at that year's Social Security wage base (ART-339), then recompute how much of the employee's disposable earnings each order in a caller-declared garnishment stack may lawfully withhold under the CCPA Title III caps, compared against a garnishment notice where one is supplied (ART-572), closing with a session receipt aggregating the run's execution hashes (CRY-05). Wage, filing, deduction, and order figures are caller-supplied inputs; each stage is an independent recompute from its own declared inputs. A mismatch is an arithmetic finding, never a legal determination about an order's validity. Not legal advice and not tax advice.

- Page: https://ainumbers.co/chaingraph/chains/garnishment-withholding-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/garnishment-withholding-check.md

## Workflow chain: Garnishment Withholding Check

Verify a paycheck's garnishment withholding in three recompute stages: first compute federal income tax withholding by the IRS Publication 15-T percentage method for the declared tax year edition (ART-338), then compute gross-to-net pay with FICA at that year's Social Security wage base (ART-339), then recompute how much of the employee's disposable earnings each order in a caller-declared garnishment stack may lawfully withhold under the CCPA Title III caps, compared against a garnishment notice where one is supplied (ART-572), closing with a session receipt aggregating the run's execution hashes (CRY-05). Wage, filing, deduction, and order figures are caller-supplied inputs; each stage is an independent recompute from its own declared inputs. A mismatch is an arithmetic finding, never a legal determination about an order's validity. Not legal advice and not tax advice.

Domain: Payroll & Tax Compliance

### Steps

1. art-338-compute-federal-withholding
   Computes federal income tax withholding by the IRS Publication 15-T percentage method, Worksheet 1A, for a 2020-or-later Form W-4; tax_year is a required input and selects the edition, and an unsupported year fails closed rather than defaulting
2. art-339-compute-gross-to-net
   Computes gross-to-net pay: FICA (Social Security 6.2 percent up to the selected tax year's OASDI wage base, Medicare 1.45 percent uncapped, Additional Medicare Tax 0.9 percent over the statutory threshold), pretax deduction ordering, and net pay
3. art-572-multi-garnishment-stacking-recompute
   Recomputes, for one stated pay period, how much of an employee's disposable earnings each order in a caller-declared garnishment stack may lawfully withhold under the CCPA Title III caps, and compares the recomputed per-order withholding against a garnishment notice where one is supplied
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Two garnishment orders hit the same paycheck. After federal withholding and FICA, how much can each order lawfully take under the CCPA caps?
Run the AINumbers MCP tool `run_chain` with {"chain":"garnishment-withholding-check"} and read `art-572-multi-garnishment-stacking-recompute.verdict`.
Re-run with `inputs` for `art-572-multi-garnishment-stacking-recompute`, reusing the values that result echoed, with `gross_minor_units` set to 120000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/garnishment-withholding-check.html
