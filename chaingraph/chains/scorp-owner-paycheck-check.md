# S-Corp Owner Paycheck Check

Model an S-Corp owner's paycheck in four independent stages: first model the S-Corp election break-even from caller-declared net self-employment income, a caller-declared reasonable W-2 salary share, and a caller-declared annual admin cost (ART-713), then compute federal income tax withholding by the IRS Publication 15-T percentage method for the declared tax year edition (ART-338), then compute gross-to-net pay with FICA at that year's Social Security wage base (ART-339), closing with a session receipt aggregating the run's execution hashes (CRY-05). The salary share is a caller input; this chain does not decide whether a salary is reasonable, and it makes no claim that any salary used is an IRS-reasonable salary. In the break-even stage, the 0.9 percent Additional Medicare Tax is a stated caveat only, not a modeled term. Filing status and the owner health premium are echoed but excluded from the break-even arithmetic, and an admin cost outside the 1,500 dollar to 3,000 dollar annual guidance band is honored and flagged, never clamped. Federal only; state withholding is out of scope. Not tax advice.

- Page: https://ainumbers.co/chaingraph/chains/scorp-owner-paycheck-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/scorp-owner-paycheck-check.md

## Workflow chain: S-Corp Owner Paycheck Check

Model an S-Corp owner's paycheck in four independent stages: first model the S-Corp election break-even from caller-declared net self-employment income, a caller-declared reasonable W-2 salary share, and a caller-declared annual admin cost (ART-713), then compute federal income tax withholding by the IRS Publication 15-T percentage method for the declared tax year edition (ART-338), then compute gross-to-net pay with FICA at that year's Social Security wage base (ART-339), closing with a session receipt aggregating the run's execution hashes (CRY-05). The salary share is a caller input; this chain does not decide whether a salary is reasonable, and it makes no claim that any salary used is an IRS-reasonable salary. In the break-even stage, the 0.9 percent Additional Medicare Tax is a stated caveat only, not a modeled term. Filing status and the owner health premium are echoed but excluded from the break-even arithmetic, and an admin cost outside the 1,500 dollar to 3,000 dollar annual guidance band is honored and flagged, never clamped. Federal only; state withholding is out of scope. Not tax advice.

Domain: HR & Benefits Compliance

### Steps

1. art-713-scorp-election-break-even
   Models the S-Corp election break-even from caller-declared net self-employment income, a caller-declared reasonable W-2 salary share, and a caller-declared annual admin cost; outputs include the break-even income at which electing starts to pay and the QBI section 199A trade-off. The salary share is a caller input; this stage does not decide whether a salary is reasonable, and no claim is made that any salary used is an IRS-reasonable salary.
2. art-338-compute-federal-withholding
   Computes federal income tax withholding by the IRS Publication 15-T percentage method, Worksheet 1A, for a 2020-or-later Form W-4; tax_year is a required input and selects the edition, and an unsupported year fails closed rather than defaulting
3. art-339-compute-gross-to-net
   Computes gross-to-net pay: FICA (Social Security 6.2 percent up to the selected tax year's OASDI wage base, Medicare 1.45 percent uncapped, Additional Medicare Tax 0.9 percent on cumulative wages over 200,000 dollars per IRC 3101(b)(2)), pretax deduction ordering, and net pay
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A sole proprietor nets $150,000 a year. At what income does S-Corp election start to pay, and what happens if the salary share rises?
Run the AINumbers MCP tool `run_chain` with {"chain":"scorp-owner-paycheck-check"} and read `art-713-scorp-election-break-even.break_even_income`.
Re-run with `inputs` for `art-713-scorp-election-break-even`, reusing the values that result echoed, with `reasonable_salary_pct` set to 60. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/scorp-owner-paycheck-check.html
