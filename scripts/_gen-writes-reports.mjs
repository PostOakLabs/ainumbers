// REGEN-ESCAPE-GUARD-ALL-PREFIXES-1 (2026-10-10): tempdir writes-report paths for
// the bare-tree COVERED entries, one constant per generator. Shared as CONSTANTS
// (not imported from the generators themselves) because several of those scripts
// are script-style with module-level write paths or argv dispatch — importing them
// from derived-artifacts.mjs would RUN them as a side effect (measured:
// gen-agent-skills executed its write pass on import; gen-fv-status exited 2 on
// its usage check). Generators import their constant from here and write the
// report on every write-mode run; derived-artifacts.mjs consumes the paths in
// `writesReport:` entry fields (see entryCommitPaths / REGEN-ESCAPE-GUARD-BLIND-HEAL-1).
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

export const AGENT_SKILLS_WRITES_REPORT_FILENAME = 'ainumbers-agent-skills-writes.json';
export const AGENT_SKILLS_WRITES_REPORT_PATH = resolve(tmpdir(), AGENT_SKILLS_WRITES_REPORT_FILENAME);

export const EVIDENCE_REGISTER_WRITES_REPORT_FILENAME = 'ainumbers-evidence-register-writes.json';
export const EVIDENCE_REGISTER_WRITES_REPORT_PATH = resolve(tmpdir(), EVIDENCE_REGISTER_WRITES_REPORT_FILENAME);

export const REGISTRY_KERNEL_RESOLVE_WRITES_REPORT_FILENAME = 'ainumbers-registry-kernel-resolve-writes.json';
export const REGISTRY_KERNEL_RESOLVE_WRITES_REPORT_PATH = resolve(tmpdir(), REGISTRY_KERNEL_RESOLVE_WRITES_REPORT_FILENAME);

export const EUC_REGISTER_WRITES_REPORT_FILENAME = 'ainumbers-euc-register-writes.json';
export const EUC_REGISTER_WRITES_REPORT_PATH = resolve(tmpdir(), EUC_REGISTER_WRITES_REPORT_FILENAME);

export const FV_STATUS_WRITES_REPORT_FILENAME = 'ainumbers-fv-status-writes.json';
export const FV_STATUS_WRITES_REPORT_PATH = resolve(tmpdir(), FV_STATUS_WRITES_REPORT_FILENAME);

export const OKF_WRITES_REPORT_FILENAME = 'ainumbers-okf-writes.json';
export const OKF_WRITES_REPORT_PATH = resolve(tmpdir(), OKF_WRITES_REPORT_FILENAME);
