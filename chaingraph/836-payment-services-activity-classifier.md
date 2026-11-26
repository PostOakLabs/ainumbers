# Payment Services Activity Classifier

Reads a caller-declared business model as a closed set of boolean payment-activity facts and classifies it into the licence classes of one of three pinned payment-services regimes: Bermuda’s proposed Payment Services Act (consultation-response status: proposed, never presented as enacted), EU PSD2 Annex I with its Article 3 exclusions, and the UK Payment Services Regulations 2017 Schedule 1 Parts 1 and 2. Considers the regime’s exclusions against the declared facts (technical service providers, one-sided commercial agents, limited-network instruments), reports conflicts such as a declared technology-only model that holds customer funds, and emits transition notes (for example the transition note for existing Bermuda money service businesses). Refuses an unknown profile or a missing activities object with a recorded reason, and records non-boolean activity values as rejected inputs. The output is a structured reading of declared facts against pinned primary text, not legal advice: every payload carries not_legal_advice: true, and the page makes the same statement. Scope limits: no real firms or licence statuses, no threshold or perimeter arithmetic, no consumer-rights obligations (PSD2 Title III), and the Bermuda reading reflects proposed text only.

- Page: https://ainumbers.co/chaingraph/836-payment-services-activity-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/836-payment-services-activity-classifier.md
- MCP tool: classify_payment_services (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required): Pinned regime profile: bermuda_psa (proposed PSA consultation response), eu_psd2 (PSD2 Article 3 and Annex I), or uk_psrs (S.I. 2017/752 Schedule 1).
- activities (object, required): Closed-enum boolean facts declaring the business model. Absent facts read as false; non-boolean values are recorded as rejected inputs.
- current_licence (string, optional): Optional: the firm’s current licence where it affects transition notes. msb_2016 = an existing Bermuda money service business.

## Outputs

- refused (boolean, optional)
- rejected_inputs (array, optional)
- profile (string,null, optional)
- classes_triggered (array, optional)
- exclusions_applied (array, optional)
- conflicts (array, optional)
- transition_note (string,null, optional)
- regime_status (string,null, optional)
- not_legal_advice (boolean, optional)
- warnings (array, optional)

## Sample

```json
{
  "profile": "eu_psd2",
  "activities": {
    "holds_customer_funds": false,
    "executes_transfers": false,
    "issues_payment_instruments": false,
    "acquires_transactions": false,
    "money_remittance": false,
    "initiates_payments_without_holding_funds": false,
    "provides_account_information": false,
    "technical_service_only": true,
    "operates_stored_value_wallet": false,
    "commercial_agent_for_one_side": false,
    "limited_network": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_payment_services` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
