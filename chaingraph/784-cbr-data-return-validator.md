# CBR Data Return Validator

Validates a bank's or money transfer operator's periodic AGGREGATE correspondent-banking data return against an illustrative, profile-driven template (generic first, Pacific second) so an institution can check completeness, internal consistency and comparability locally before submission. Inputs are counts, sums, currency codes, ISO country codes, period dates and enumerated institution types only: per key currency the active correspondent count with relationships opened and terminated or restricted, and outbound and inbound counts and values by corridor country, plus optional message-quality summaries (structure mix and valid-LEI counts) taken from the address and LEI linters' outputs. Rules: required fields per profile (the Pacific profile requires USD, AUD and NZD present), correspondent roll-forward (closing equals opening plus opened minus terminated), corridor sums against stated currency totals (counts exact, values within a stated 0.5 percent tolerance), period sanity, code membership, single-correspondent key-currency watch, and concentration (top corridor share and a Herfindahl-Hirschman index over corridor shares). Output is verdict, violations by JSON path with rule ids, computed flags, a readiness roll-up band (or not_supplied), the profile and template version - it never echoes a free-text value. The template is ILLUSTRATIVE: it is not the official Pacific CBR project data collection template (still being finalised by that programme) and not the World Bank CBR Resilience Index (calibration pending). Swift deferred its payments structured-address change on 27 August 2026 with an update promised by December 2026 at the latest, so no hard migration date is asserted anywhere; readiness prose anchors on the FATF revised Recommendation 16 of June 2025 with its end-2030 transition.

- Page: https://ainumbers.co/chaingraph/784-cbr-data-return-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/784-cbr-data-return-validator.md
- MCP tool: validate_cbr_data_return (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required): Template profile: generic uses the global metric set with USD, EUR, GBP as key currencies; pacific requires USD, AUD, NZD reported.
- institution_type (string, required): Reporting institution class: bank, mto or other_non_bank.
- institution_code (string, required): Profile-local pseudonymous institution code, FI-NNN form. No real names or identifiers.
- period (object, required): start and end as YYYY-MM-DD; end on or after start, span at most 400 days.
- currencies (array, required): Per key currency: opening_correspondents, active_correspondents (closing), opened, terminated_restricted, corridors (country with outbound and inbound counts and values) and optional totals for the cross-check.
- message_quality (object, optional): Aggregate summaries from the address and LEI linters: messages_linted with fully_structured, hybrid and unstructured counts (must sum to messages_linted), and lei_linted with lei_valid.

## Outputs

- valid (boolean)
- refused (object or null): path and reason code only, the value is never echoed
- violations (array of {path, rule_id, source})
- flags (array of {flag_id, path, currency, computed detail})
- readiness (object): status supplied or not_supplied, with percentages and a band
- rules_checked (array)
- profile (string or null)
- template_version (string)
- profile_definition (object)
- computed (object)

## Aggregate-only contract

Institutions appear only as profile-local pseudonymous codes (FI-NNN form). No customer, counterparty, correspondent or institution names, BIC, LEI or account identifiers are accepted in the return itself; any string leaf outside the enumerations is refused by JSON path with the value never echoed. All inputs are processed locally; nothing is transmitted.

## Sources

- CPMI correspondent banking chartpack (metric definitions: active correspondents, corridors, volumes, values, key-currency shares), pinned 2026-10-29
- FATF revised Recommendation 16 and Interpretive Note, June 2025 (payment transparency, structured ISO 20022 data, LEI, end-2030 transition), pinned 2026-10-29
- PIFS Pacific Strengthening CBR Project 2025 Annual Report (Recommendation 3 data collection templates, Recommendation 8 resilience framework, Data Collection Working Group covering banks and MTOs), pinned 2026-10-29

ART-784 · OpenChainGraph · Post Oak Labs · CC BY 4.0
