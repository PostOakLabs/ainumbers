// Kernel registry — maps a ChainGraph node tool_id to its pure decision kernel.
// The Worker imports this and dispatches gpu:false nodes to compute server-side.
// generate.mjs (server repo) vendors repo/chaingraph/kernels/ into data/kernels/.
// As each gpu:false node is ported (Workstream A), add one line here.

import * as art01  from './art-01-ap2-mandate-chain-validator.kernel.mjs';
import * as art03  from './art-03-x402-settlement-modeler.kernel.mjs';
import * as art04  from './art-04-agent-identity-attestation-checker.kernel.mjs';
import * as art05  from './art-05-eu-ai-act-credit-scoring-conformity.kernel.mjs';
import * as art06  from './art-06-genius-act-reserve-attestation.kernel.mjs';
import * as art09  from './art-09-dora-incident-classifier.kernel.mjs';
import * as art11  from './art-11-vop-batch-match-rate-analyser.kernel.mjs';
import * as art12  from './art-12-acp-checkout-conformance-validator.kernel.mjs';
import * as art29  from './art-29-dora-readiness-diagnostic.kernel.mjs';
import * as art34  from './art-34-tempo-fit-diagnostic.kernel.mjs';
import * as art35  from './art-35-tempo-payments-business-case.kernel.mjs';
import * as art38  from './art-38-tempo-onchain-aml.kernel.mjs';
import * as art41  from './art-41-tempo-validator-readiness.kernel.mjs';
import * as t504   from './504-settlement-risk-capital-optimizer.kernel.mjs';
import * as t508   from './508-repo-haircut-collateral-calculator.kernel.mjs';
import * as t511   from './511-multi-currency-pvp-validator.kernel.mjs';

export const KERNELS = {
  'art-01-ap2-mandate-chain-validator':              art01,
  'art-03-x402-settlement-modeler':                  art03,
  'art-04-agent-identity-attestation-checker':       art04,
  'art-05-eu-ai-act-credit-scoring-conformity':      art05,
  'art-06-genius-act-reserve-attestation':           art06,
  'art-09-dora-incident-classifier':                 art09,
  'art-11-vop-batch-match-rate-analyser':            art11,
  'art-12-acp-checkout-conformance-validator':       art12,
  'art-29-dora-readiness-diagnostic':                art29,
  'art-34-tempo-fit-diagnostic':                     art34,
  'art-35-tempo-payments-business-case':             art35,
  'art-38-tempo-onchain-aml':                        art38,
  'art-41-tempo-validator-readiness':                art41,
  '504-settlement-risk-capital-optimizer':           t504,
  '508-repo-haircut-collateral-calculator':          t508,
  '511-multi-currency-pvp-validator':                t511,
};

export function getKernel(tool_id) {
  return KERNELS[tool_id] ?? null;
}
