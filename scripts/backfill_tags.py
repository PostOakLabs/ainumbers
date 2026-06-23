#!/usr/bin/env python3
"""
scripts/backfill_tags.py — one-shot backfill of tags[] in manifests missing them.

Keyword-matches title + description against a fintech tag vocabulary (regulatory,
asset class, function, technology). Writes 3-8 tags per manifest. Run once, then
delete this script.

Usage: python scripts/backfill_tags.py [--dry-run]
"""
import json, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFESTS = os.path.join(ROOT, 'manifests')
DRY = '--dry-run' in sys.argv

# Each entry: ([keyword_patterns], tag_to_emit)
# Patterns checked against lower(title + ' ' + description).
# First match wins per group; multiple groups can match.
RULES = [
    # ── Regulatory frameworks ────────────────────────────────────────────────
    (['dora', 'ict risk', 'ict cascade', 'ict incident', 'incident classif', 'rts 2024/1772',
      'operational resilience', 'third.party ict'], 'DORA'),
    (['mica', 'casp', 'crypto-asset service', 'crypto asset service', 'e-money token',
      'asset-referenced token', 'asset referenced token', 'mica own funds',
      'mica transitional', 'mica token', 'mica casp'], 'MiCA'),
    (['basel', 'rwa ', 'capital requirement', 'frtb', 'expected shortfall', 'sensitivities',
      'delta neutral', 'credit default risk', 'rwa scenario'], 'Basel'),
    (['csdr', 'settlement fail', 'buy-in exposure', 'settlement penalty',
      'settlement efficiency kpi', 'allocation affirmation', 'cash leg finality',
      't+1', 'settlement cycle'], 'CSDR'),
    (['cbam', 'carbon border', 'embedded emission', 'carbon certificate',
      'carbon compliance', 'precursor emission', 'cbam default value'], 'CBAM'),
    (['psd3', 'psd2', 'payment service directive', 'open banking consent',
      'consent compliance', 'consent stress'], 'PSD3'),
    (['ai act', 'ai conformity', 'high-risk ai', 'fria', 'prohibited ai',
      'ai risk classif', 'ai-act', 'agentic ai risk', 'ai highrisk'], 'AI Act'),
    (['fida', 'financial data access', 'financial data sharing'], 'FIDA'),
    (['travel rule', 'tfr ', 'transfer of funds regulation', 'wire transfer'],  'TFR'),
    (['eudi', 'eidas', 'digital identity wallet', 'ssi conformance',
      'self-sovereign', 'digital credential', 'did document'], 'eIDAS'),
    (['mifid', 'markets in financial instruments', 'transaction reporting',
      'mifir'], 'MiFID'),
    (['sfdr', 'sustainable finance disclos', 'taxonomy alignment', 'gar ', 'dnsh',
      'taxonomy kpi', 'eu taxonomy', 'eugb', 'green bond', 'sustainability report',
      'csrd', 'climate scenario', 'scope 1', 'scope 2', 'scope 3',
      'carbon emission'], 'ESG'),
    (['aml', 'anti-money launder', 'money launder', 'aml typolog',
      'aml mandate', 'aml/kyc'], 'AML'),
    (['kyc', 'know your customer', 'customer risk rating', 'beneficial owner',
      'ownership 50', 'customer due diligence'], 'KYC'),
    (['sanctions', 'ofac', 'screening list', 'watchlist', 'russia clause',
      'circumvention', 'sanction screen', 'sanctions screen',
      'no-russia', 'no russia', 'sanctions quality', 'dual-use', 'eccn'], 'sanctions'),
    (['iso 20022', 'iso20022', 'pacs.', 'pain.', 'camt.', 'sepa credit',
      'sepa direct debit', 'iso 2022', 'swift message', 'mt to mx',
      'message validation', 'payment message'], 'ISO 20022'),
    (['nacha', 'ach file', 'ach batch', 'nacha file', 'ach format',
      'ach validat'], 'ACH/NACHA'),
    (['fednow', 'fed now', 'rtp ', 'real-time payment', 'real time payment',
      'instant payment', 'fednow participant', 'fednow lookup'], 'FedNow/RTP'),
    (['swift ', 'correspondent bank', 'bic code', 'swift gpi', 'swift mt'],
     'SWIFT'),
    (['fatf', 'fatf recommendation', 'fatf guidance'], 'FATF'),

    # ── Asset classes ────────────────────────────────────────────────────────
    ([' fx ', 'foreign exchange', 'currency pair', 'pvp ', 'payment-vs-payment',
      'multi-currency', 'fx settlement', 'stablefx', 'fx netting', 'fx risk',
      'cross-border fx', 'cls ', 'fx corridor', 'currency corridor'], 'FX'),
    (['interest rate', 'rate swap', 'duration', 'fixed income', 'bond',
      'repo rate', 'yield', 'libor', 'sofr'], 'rates'),
    (['equity', 'equities', 'stock', 'share', 'dividend',
      'securities lending'], 'equities'),
    (['stablecoin', 'stable coin', 'reserve attestation', 'reserve audit',
      'stablecoin reserve', 'e-money token', 'deposit token',
      'tokenized deposit', 'emoney'], 'stablecoin'),
    (['digital asset', 'crypto', 'cryptocurrency', 'bitcoin', 'ethereum',
      'token', 'blockchain', 'on-chain', 'defi', 'cctp',
      'cross-chain', 'usdc', 'cbdc', 'digital currency',
      'crypto whitepaper', 'asset whitepaper', 'whitepaper lint'], 'digital assets'),
    (['derivative', 'option pricing', 'greeks ', 'delta ', 'gamma ', 'vega ',
      'black-scholes', 'binomial', 'xva ', 'cva ', 'dva ',
      'exposure model'], 'derivatives'),
    (['collateral', 'margin call', 'haircut', 'margin netting', 'cross margin',
      'collateral swap', 'collateral eligib', 'fund collateral',
      'mobilize margin', 'tokenized collateral'], 'collateral'),

    # ── Market infrastructure & settlement ───────────────────────────────────
    (['clearing', 'clearinghouse', 'ccp ', 'ficc ', 'dtcc ',
      'clearing access', 'margin netting', 'treasury clearing',
      'settlement capital', 'cross margin'], 'clearing'),
    (['settlement', 'dvp', 'delivery vs payment', 'finality',
      'settlement asset', 'settlement fail', 'settlement efficiency',
      'settlement message', 'securities settlement', 'settlement cycle',
      'settlement capital', 'tokenized security', 'pvp'], 'settlement'),
    (['repo ', 'repurchase agreement', 'repo haircut', 'reverse repo',
      'securities financing'], 'repo'),

    # ── Payments ─────────────────────────────────────────────────────────────
    (['a2a ', 'account-to-account', 'pay-by-bank', 'open banking payment',
      'a2a fee', 'a2a payment', 'a2a rail', 'a2a suite', 'invoice.*a2a',
      'bank transfer', 'bank payment'], 'A2A'),
    (['routing', 'route optim', 'fee route', 'payment routing',
      'optimal route', 'rail select', 'checkout protocol',
      'payment protocol'], 'routing'),
    (['invoice', 'invoicing', 'e-invoice', 'einvoice', 'invoice batch',
      'invoice a2a', 'receivables', 'accounts receivable', 'dso ',
      'collections optim', 'working capital'], 'invoicing'),
    (['treasury', 'cash management', 'liquidity', 'float ', 'treasury strategy',
      'treasury fit', 'treasury clearing', 'cash leg'], 'treasury'),
    (['fraud', 'fraud score', 'fraud detect', 'fraud graph', 'app fraud',
      'synthetic fraud', 'fraud simulation', 'transaction anomaly',
      'anomaly detect', 'timeseries anomaly', 'velocity rule'], 'fraud'),
    (['card ', 'interchange', 'scheme compliance', 'visa ', 'mastercard ',
      'card network', 'card payment', 'acquirer', 'merchant threshold',
      'interchange qualif', 'card transaction', 'spend policy',
      'card attribute', 'decline code', 'chargeback'], 'card scheme'),
    (['baas', 'banking as a service', 'embedded bank', 'banking provider',
      'banking platform'], 'BaaS'),
    (['vop', 'verification of payee', 'account verif',
      'address migration', 'iban verif'], 'account verification'),
    (['liquidity stress', 'stress test', 'liquidity risk',
      'liquidity scenario'], 'liquidity'),

    # ── Agentic / MCP / AI ────────────────────────────────────────────────────
    (['x402', 'http 402', 'machine payment', 'x402 flow', 'x402 settle'],
     'x402'),
    (['acp', 'agent checkout', 'agentic checkout protocol', 'checkout protocol',
      'agentic commerce'], 'ACP'),
    (['ap2', 'agentic payment protocol', 'ap2 mandate', 'ap2 policy',
      'payment mandate', 'policy mandate', 'ap2 receipt', 'ap2 prompt',
      'ap2 export', 'mandate chain'], 'AP2'),
    (['tempo ', 'tempo protocol', 'tempo zone', 'tempo token',
      'tempo validator', 'tempo fit', 'tempo payment'], 'Tempo'),
    (['arc ', 'arc protocol', 'cpn ', 'paymaster', 'arc paymaster',
      'stablefx', 'arc fit', 'arc economics'], 'ARC'),
    (['a2a trust', 'a2a agent', 'agent card', 'a2a protocol',
      'a2a trust chain', 'agent trust'], 'A2A protocol'),
    (['visa tap', 'visa trusted agent', 'visa tap signature',
      'trusted agent protocol'], 'Visa TAP'),
    (['mastercard agentic', 'mastercard agent', 'mpp ', 'payment passkey',
      'agentic token', 'mastercard token'], 'Mastercard Agent'),
    (['google ap2', 'google agentic', 'google mandate'], 'Google AP2'),
    (['mcp server', 'mcp tool', 'mcp oauth', 'mcp rate', 'mcp deploy',
      'mcp readiness', 'model context protocol', 'mcp score',
      'mcp server.json', 'mcp tool definition', 'mcp registered',
      'lint.*mcp', 'validate.*mcp', 'attest.*mcp'], 'MCP'),
    (['openchain', 'chaingraph', 'ocg ', 'ocg node', 'execution hash',
      'compute node', 'kernel', 'ocg artifact'], 'OpenChainGraph'),
    (['agent economy', 'agent service', 'agent metering', 'agent traffic',
      'agentic readiness', 'agentic finance', 'agent commerce',
      'run agentic', 'agentic ai'], 'agentic'),
    (['zk proof', 'zero-knowledge', 'zkp', 'merkle', 'merkle batch',
      'zero knowledge'], 'ZK'),
    (['tool poison', 'prompt injection', 'agent attestation',
      'check attestation', 'scan tool'], 'AI security'),

    # ── Technology ────────────────────────────────────────────────────────────
    (['pqc', 'post-quantum', 'quantum cryptograph', 'lattice',
      'fido pqc', 'tls pki', 'pki migration', 'pqc timeline',
      'quantum risk', 'quantum safe', 'fido2', 'passkey'], 'PQC'),
    (['blockchain', 'canton ', 'dlt ', 'distributed ledger',
      'smart contract', 'daml ', 'party allowlist'], 'DLT'),
    (['ssi conformance', 'verifiable credential', 'decentralized identity',
      'did document', 'did:web', 'self-sovereign identity'], 'SSI'),
    (['trade document', 'digital trade', 'mletr', 'electronic trade',
      'trade rules', 'digital trade rules', 'trade finance',
      'letter of credit', 'bill of lading'], 'trade finance'),
    (['open banking', 'account aggregat', 'fapi', 'open finance',
      'psd2 api', 'banking api'], 'open banking'),
    (['api ', 'openapi', 'rest api', 'json-rpc', 'sdk integration',
      'developer tool', 'api endpoint'], 'API'),

    # ── Risk & compliance (catch-all) ─────────────────────────────────────────
    (['credit risk', 'credit default', 'credit model', 'credit policy',
      'underwriting', 'decision table', 'lending', 'ltv ', 'dti '], 'credit risk'),
    (['operational risk', 'risk model', 'risk scenario', 'risk assessment',
      'risk rating', 'risk score', 'fuzzy match', 'match calibr'], 'risk'),
    (['compliance', 'regulatory compliance', 'compliance score',
      'compliance check', 'compliance fit', 'compliance pack'], 'compliance'),
    (['reporting', 'report generat', 'regulatory report', 'disclosure'], 'reporting'),
    (['simulation', 'simulate ', 'simulating', 'stress simulat'], 'simulation'),
    (['validation', 'validate ', 'validating', 'validator'], 'validation'),
    (['participant lookup', 'look up', 'coverage stat', ' directory',
      ' finder', 'lookup tool', 'look-up'], 'lookup'),
    (['diagnostic', 'readiness', 'fit diagnostic', 'fit check',
      'readiness check', 'readiness test'], 'diagnostic'),

    # ── Domain-specific catch-alls ────────────────────────────────────────────
    (['payments', 'payment processing', 'payment rail', 'payment flow',
      'payment scheme', 'payment network', 'fee waterfall', 'fee economics',
      'transaction value', 'platform margin', 'marketplace platform'], 'payments'),
    (['fintech', 'financial technology', 'financial service'], 'fintech'),
    (['retirement', 'fire trajectory', 'monte carlo fire', 'sequence of return',
      'withdrawal rate', 'retirement portfolio', 'financial independence'], 'personal finance'),
    (['portfolio', 'asset allocation', 'wealth', 'savings rate',
      'investment return'], 'portfolio'),
    ([' fee ', 'fee model', 'fee calc', 'rebate', 'margin model',
      'waterfall', 'cost model', 'cost modell'], 'fee modeling'),
    (['marketplace', 'platform econom', 'multi-party', 'platform margin'], 'marketplace'),
    (['dso ', 'days sales outstanding', 'accounts receivable', 'ar aging',
      'collections optim', 'working capital', 'receivable'], 'receivables'),
    (['vendor', 'supplier', 'procurement', 'purchase'], 'procurement'),
    (['rebate', 'reward', 'cashback', 'spend rebate'], 'rebates'),
    (['erp', 'enterprise resource', 'erp integrat'], 'ERP'),
    (['withholding', 'tax', '1099', 'dac7', 'tax report'], 'tax'),
    (['licensing', 'license', 'mtl ', 'money transmission', 'regulatory license'], 'licensing'),
    (['onboarding', 'seller onboard', 'merchant onboard', 'kyb'], 'onboarding'),
    (['virtual account', 'account structure', 'notional pool'], 'account structure'),
    (['payout', 'disbursement', 'mass payout'], 'payouts'),
    (['decode', 'parser', 'parse ', 'extract'], 'parsing'),
    # ── Transaction monitoring ────────────────────────────────────────────────
    (['sar ', 'suspicious activity report', 'sar narrative', 'sar threshold',
      'structuring pattern', 'layering typology', 'typology', 'tm rule',
      'transaction monitor', 'ctr ', 'currency transaction report'], 'transaction monitoring'),
    (['correspondent bank', 'nostro', 'swift gpi', 'de-risk', 'wire analyz'], 'correspondent banking'),
    (['pep ', 'politically exposed', 'adverse media', 'negative news'], 'due diligence'),
    (['cdd', 'edd ', 'enhanced due diligence', 'customer due diligence',
      'checklist builder', 'requirements checklist'], 'due diligence'),
    # ── Consumer credit / BNPL ───────────────────────────────────────────────
    (['bnpl', 'buy now pay later', 'buy-now-pay-later', 'deferred payment',
      'installment', 'arrears', 'affordability', 'late fee', 'apr calc',
      'disclosure template', 'bnpl disclosure'], 'BNPL'),
    (['consumer credit', 'consumer lending', 'retail credit', 'consumer loan',
      'b2b bnpl', 'merchant bnpl'], 'consumer credit'),
    # ── Credit / lending ─────────────────────────────────────────────────────
    (['ifrs 9', 'ifrs9', 'pd ', 'lgd ', 'ead ', 'credit migration', 'raroc',
      'loan pricing', 'expected loss', 'credit covenant', 'financial covenant',
      'credit facilit'], 'credit risk'),
    (['embedded lending', 'unit economics', 'lending platform',
      'embedded finance', 'baas embed'], 'embedded finance'),
    # ── VAT / e-invoicing ─────────────────────────────────────────────────────
    (['vat ', 'value added tax', 'vat rate', 'vat recovery', 'vat treaty',
      'peppol', 'access point', 'archiving retention', 'e-invoice archiv',
      'cross-border vat'], 'VAT/e-invoicing'),
    # ── Structural / ledger ──────────────────────────────────────────────────
    (['ledger architect', 'ledger design', 'core banking', 'account ledger',
      'general ledger'], 'ledger'),
    (['wallet ', 'digital wallet', 'float yield', 'wallet float',
      'e-wallet'], 'wallets'),
    (['embedded bank', 'embedded financ', 'baas ', 'banking-as-a-service',
      'banking as a service'], 'BaaS'),
    (['counterparty', 'counterparty risk', 'counterparty credit',
      'xva', 'cva ', 'dva '], 'counterparty risk'),
    # ── Monte Carlo / simulation (catch broader) ──────────────────────────────
    (['monte carlo', 'probability cone', '1,000+ scenario',
      'box-muller', 'parametric simulation'], 'simulation'),
    # ── Cross-border ─────────────────────────────────────────────────────────
    (['cross-border', 'cross border', 'corridor', 'international payment',
      'remittance', 'emerging corridor', 'multi-corridor'], 'cross-border'),
    (['partition recovery', 'dlt recovery', 'blockchain recovery',
      'node recover', 'consensus recover'], 'DLT resilience'),
]

# Category → guaranteed fallback tags (added when keyword matches < 2)
CAT_FALLBACKS = {
    'core-infrastructure':    ['payments', 'infrastructure'],
    'compliance-consent':     ['compliance', 'open banking'],
    'aml-kyc':                ['AML', 'KYC'],
    'capital-markets':        ['capital markets'],
    'digital-assets':         ['digital assets'],
    'carbon-cbam':            ['CBAM', 'ESG'],
    'settlement-clearing':    ['settlement', 'clearing'],
    'agentic-finance':        ['agentic', 'MCP'],
    'risk-management':        ['risk', 'compliance'],
    'trade-finance':          ['trade finance'],
    'fraud-risk':             ['fraud', 'risk'],
    'realtime-payments':      ['FedNow/RTP', 'payments'],
    'treasury-strategy':      ['treasury'],
    'cross-border':           ['FX', 'cross-border'],
    'open-banking':           ['open banking', 'PSD3'],
    'identity':               ['eIDAS', 'identity'],
    'data-privacy':           ['compliance', 'GDPR'],
    'market-infrastructure':  ['settlement', 'clearing'],
    'regulatory-reporting':   ['reporting', 'compliance'],
    'mcp-tooling':            ['MCP', 'developer'],
    'iso-20022':              ['ISO 20022'],
    'fintech':                ['fintech', 'payments'],
    'b2b-payments':           ['payments', 'B2B'],
    'personal-finance':       ['personal finance', 'portfolio'],
    'treasury-strategy':      ['treasury', 'cash management'],
    'general':                ['finance'],
}


def derive_tags(manifest):
    haystack = (manifest.get('title', '') + ' ' + manifest.get('description', '')).lower()
    tags = []
    seen = set()
    for patterns, tag in RULES:
        for pat in patterns:
            if re.search(re.escape(pat).replace(r'\ ', r'\s+'), haystack):
                if tag not in seen:
                    tags.append(tag)
                    seen.add(tag)
                break

    # Add category fallbacks if too few tags
    cat = manifest.get('category', '')
    fallbacks = CAT_FALLBACKS.get(cat, [])
    for fb in fallbacks:
        if fb not in seen and len(tags) < 5:
            tags.append(fb)
            seen.add(fb)

    # Last resort: use prettified category itself
    if len(tags) < 2 and cat:
        pretty = cat.replace('-', ' ')
        if pretty not in seen:
            tags.append(pretty)

    return tags[:8]  # cap at 8


def main():
    files = [f for f in os.listdir(MANIFESTS) if f.endswith('.manifest.json')]
    missing = []
    for fname in sorted(files):
        fpath = os.path.join(MANIFESTS, fname)
        m = json.load(open(fpath, encoding='utf-8'))
        if not m.get('tags'):
            missing.append((fname, fpath, m))

    print(f"{len(missing)} manifests missing tags")
    patched = 0
    zero_tags = []

    for fname, fpath, m in missing:
        tags = derive_tags(m)
        if not tags:
            zero_tags.append(fname)
        m['tags'] = tags
        if not DRY:
            json.dump(m, open(fpath, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
            open(fpath, 'a', encoding='utf-8').write('\n')
        else:
            print(f"  {fname}: {tags}")
        patched += 1

    print(f"Patched {patched} manifests")
    if zero_tags:
        print(f"WARNING: {len(zero_tags)} got empty tags (check manually):")
        for f in zero_tags:
            print(f"  {f}")
    else:
        print("All manifests got >=1 tag")


if __name__ == '__main__':
    main()
