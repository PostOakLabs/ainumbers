export const meta = {
  tool_id: 'art-22-agentic-payments-protocol-comparator',
  mcp_name: 'compare_agentic_rail_protocols',
  mandate_type: 'routing_policy',
};

const PROTOCOLS = [
  {id:'ap2', name:'AP2', sub:'Agent Payments Protocol',
   backer:'Google → donated to FIDO Alliance (2026)',
   artifact:'Checkout Mandate + Payment Mandate, expressed as Verifiable Digital Credentials (VDCs)',
   signed:'Cryptographically signed VDCs; Open→Closed mandate chain',
   scope:'Cart + amount + payment instrument, bound at the Closed stage',
   rail:'Rail-agnostic — cards today; x402/stablecoin via the A2A x402 extension',
   identity:'FIDO / verifiable credentials; rides on A2A',
   audit:'Strong — non-repudiable chained VDC audit trail',
   status:'v0.2; donated to FIDO Alliance (~Apr 2026)',
   url:'https://ap2-protocol.org/'},
  {id:'acp', name:'ACP', sub:'Agentic Commerce Protocol (Shared Payment Token)',
   backer:'OpenAI + Stripe',
   artifact:'Shared Payment Token (SPT) + Agentic Checkout session objects',
   signed:'Delegated authorization (OAuth 2.0); PSP-issued SPT',
   scope:'Single-use SPT scoped to merchant + cart total',
   rail:'Card via any compatible PSP (Stripe first); merchant stays merchant of record',
   identity:'OAuth 2.0 delegated auth',
   audit:'Order/session objects; PSP transaction record',
   status:'beta; spec dated 2026-04-17',
   url:'https://www.agenticcommerce.dev/'},
  {id:'x402', name:'x402', sub:'HTTP 402 payment protocol',
   backer:'Coinbase → x402 Foundation (Linux Foundation)',
   artifact:'PaymentRequired + PaymentPayload objects in HTTP headers',
   signed:'Client-signed PaymentPayload (wallet signature)',
   scope:'Exact amount per scheme (exact); metered "upto" planned',
   rail:'Stablecoin on-chain (USDC) — Base, Polygon, Arbitrum, Solana, World',
   identity:'Wallet keypair; facilitator /verify + /settle',
   audit:'Inherent — on-chain settlement record',
   status:'Linux Foundation project (formalized ~Apr 2026)',
   url:'https://x402.org/'},
  {id:'tap', name:'Visa TAP', sub:'Visa Trusted Agent Protocol',
   backer:'Visa (Intelligent Commerce)',
   artifact:'Scoped Visa tokenised credential + HTTP message signatures',
   signed:'HTTP Message Signatures (RFC 9421); 3 signatures incl. agent-recognition',
   scope:'Merchant scope via the issued tokenised credential',
   rail:'Visa card network',
   identity:'RFC 9421 / aligned with Web Bot Auth',
   audit:'Signature timestamps, session id, kid for replay protection',
   status:'Introduced ~Oct 2025; on Visa Developer + GitHub',
   url:'https://developer.visa.com/capabilities/trusted-agent-protocol/overview'},
  {id:'mc', name:'MC Agent Pay', sub:'Mastercard Agent Pay (Agentic Tokens)',
   backer:'Mastercard (MDES)',
   artifact:'Agentic Token (tokenised card credential via MDES)',
   signed:'Token bound to agent id + merchant scope + consent policy',
   scope:'Agent + merchant + consent policy bindings',
   rail:'Mastercard card network',
   identity:'MDES tokenisation',
   audit:'Network transaction record + token provenance',
   status:'Announced Apr 2025; first live txn Sep 2025',
   url:'https://www.mastercard.com/'},
];

const PROTOCOL_MAP = Object.fromEntries(PROTOCOLS.map(p => [p.id, p]));

const DIMS = [
  {id:'backer',   label:'Backer / Governance'},
  {id:'artifact', label:'Bearer Artifact'},
  {id:'signed',   label:'What Is Signed'},
  {id:'scope',    label:'Scope Binding'},
  {id:'rail',     label:'Settlement Rail'},
  {id:'identity', label:'Identity Substrate'},
  {id:'audit',    label:'Audit Trail'},
  {id:'status',   label:'Status (Jun 2026)'},
];

const CROSSWALK = [
  {concept:'Authorization artifact', map:{ap2:'Payment Mandate (VDC)',     acp:'Shared Payment Token', x402:'PaymentPayload',              tap:'Tokenised credential + signature', mc:'Agentic Token'}},
  {concept:'Proof of user intent',   map:{ap2:'Signed mandate chain',       acp:'OAuth delegation + SPT', x402:'Wallet signature',          tap:'Cardholder consent + token',       mc:'Consent policy in token'}},
  {concept:'Scope unit',             map:{ap2:'Cart + amount',               acp:'Merchant + cart total',  x402:'Exact amount',              tap:'Merchant scope',                   mc:'Agent + merchant + consent'}},
  {concept:'Settlement medium',      map:{ap2:'Card or stablecoin',          acp:'Card via PSP',           x402:'USDC on-chain',             tap:'Visa rails',                       mc:'Mastercard rails'}},
  {concept:'Identity / trust root',  map:{ap2:'FIDO / VDC',                 acp:'OAuth 2.0',              x402:'Wallet key',                tap:'RFC 9421 / Web Bot Auth',          mc:'MDES token'}},
];

const SCENARIOS = {
  agent_micro:     {pick:['x402'],    also:['ap2'],  why:'Stablecoin micropayments and metered API billing map directly to x402\'s HTTP-402 + on-chain settlement (exact / upcoming upto schemes). AP2\'s A2A x402 extension can wrap it with a card-grade mandate/audit trail if you need verifiable user intent.'},
  chatgpt_checkout:{pick:['acp'],     also:['ap2'],  why:'In-assistant consumer card checkout is exactly ACP\'s Agentic Checkout + Shared Payment Token model (OpenAI + Stripe). AP2 is the vendor-neutral alternative if you need a rail-agnostic, network-portable mandate.'},
  cross_merchant:  {pick:['ap2'],     also:['acp'],  why:'A rail-agnostic, non-repudiable mandate chain across merchants is AP2\'s core design (Checkout + Payment Mandate VDCs). ACP fits if you are standardising on the OpenAI/Stripe checkout surface.'},
  merchant_verify: {pick:['tap'],     also:['x402'], why:'Merchant-side agent recognition is the Visa Trusted Agent Protocol\'s purpose (RFC 9421 signatures, Web Bot Auth-aligned). The shared RFC 9421 substrate also underlies open Web Bot Auth verification.'},
  card_network:    {pick:['mc','tap'],also:[],        why:'Issuer/network-anchored tokenised agent credentials are the card networks\' lane: Mastercard Agent Pay (Agentic Tokens via MDES) and Visa Intelligent Commerce / TAP.'},
};

export function compute(pp) {
  // Accepted protocol ids; default to all
  const requested_ids = Array.isArray(pp.protocols) && pp.protocols.length > 0
    ? pp.protocols
    : PROTOCOLS.map(p => p.id);

  const valid_ids = requested_ids.filter(id => !!PROTOCOL_MAP[id]);
  const selected = valid_ids.map(id => PROTOCOL_MAP[id]);

  const scenario = pp.scenario ?? null;

  // Build per-protocol summary rows
  const protocols_detail = selected.map(p => {
    const row = { id: p.id, name: p.name, sub: p.sub };
    for (const d of DIMS) row[d.id] = p[d.id];
    return row;
  });

  // Build crosswalk filtered to selected ids
  const crosswalk = CROSSWALK.map(c => ({
    concept: c.concept,
    values: Object.fromEntries(valid_ids.map(id => [id, c.map[id] ?? '—'])),
  }));

  // Scenario recommendation
  let recommendation = null;
  if (scenario && SCENARIOS[scenario]) {
    const sc = SCENARIOS[scenario];
    recommendation = {
      primary_pick: sc.pick,
      primary_names: sc.pick.map(id => PROTOCOL_MAP[id]?.name ?? id),
      also_consider: sc.also,
      also_names: sc.also.map(id => PROTOCOL_MAP[id]?.name ?? id),
      rationale: sc.why,
    };
  }

  const compliance_flags = {
    PROTOCOL_COMPARISON_COMPLETE: true,
    SCENARIO_APPLIED: !!recommendation,
    ALL_PROTOCOLS_REQUESTED: valid_ids.length === PROTOCOLS.length,
    AP2_INCLUDED: valid_ids.includes('ap2'),
    ACP_INCLUDED: valid_ids.includes('acp'),
    X402_INCLUDED: valid_ids.includes('x402'),
    TAP_INCLUDED: valid_ids.includes('tap'),
    MC_INCLUDED: valid_ids.includes('mc'),
    SNAPSHOT_DATE: '2026-06',
  };

  return {
    protocols_compared: valid_ids,
    protocol_names: selected.map(p => p.name),
    scenario,
    protocols_detail,
    crosswalk,
    recommendation,
    note: 'Orientation snapshot only — verify every field against the cited primary source. Specs version monthly.',
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    ...result,
  };
}
