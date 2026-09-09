# Regulatory Report Submission Cycle (Published Edit Checks)

Two-step pre-submission cycle over a report instance and a freely published rule set. Step 1 evaluates the instance against policy-supplied validity and quality edits, keyed by the published edit identifier, and records which deactivated rules were suppressed so a stood-down rule cannot produce a false failure. Step 2 computes period-over-period variance per line item against policy-supplied materiality thresholds and flags which movements require a written explanation. Step 1 is gated hold on any hard-rule failure, and in that state the cycle stops before a submission bundle is produced. Step 2 is gated dual_control(2) for filing release, satisfied by a preparer and a distinct signing-officer approver; a flagged material movement carrying no explanation annotation holds the release for review, and the submitter identity is recorded separately at transmission. The bundle is the filer's own evidence and does not satisfy any issuer's submission requirement.

- Page: https://ainumbers.co/chaingraph/chains/regrpt-submission-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/regrpt-submission-cycle.md

## Workflow chain: Regulatory Report Submission Cycle (Published Edit Checks)

Two-step pre-submission cycle over a report instance and a freely published rule set. Step 1 evaluates the instance against policy-supplied validity and quality edits, keyed by the published edit identifier, and records which deactivated rules were suppressed so a stood-down rule cannot produce a false failure. Step 2 computes period-over-period variance per line item against policy-supplied materiality thresholds and flags which movements require a written explanation. Step 1 is gated hold on any hard-rule failure, and in that state the cycle stops before a submission bundle is produced. Step 2 is gated dual_control(2) for filing release, satisfied by a preparer and a distinct signing-officer approver; a flagged material movement carrying no explanation annotation holds the release for review, and the submitter identity is recorded separately at transmission. The bundle is the filer's own evidence and does not satisfy any issuer's submission requirement.

Domain: Bank Capital & Credit Risk

### Steps

1. art-484-regrpt-editcheck-runner
   Per-rule pass/fail keyed by the published edit identifier, with failing cell references and computed-versus-reported values, feeds the variance stage
2. art-485-regrpt-variance-explainer
   Ranked material movements and the explained/unexplained split close the submission-evidence bundle under dual control. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
