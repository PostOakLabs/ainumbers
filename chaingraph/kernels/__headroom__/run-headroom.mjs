// run-headroom.mjs: CLI over the headroom declarations in this directory.
//
//   node chaingraph/kernels/__headroom__/run-headroom.mjs
//       Run every declaration over its fixture base points, print the table and the gate lines.
//       Exit 1 when a gate (H1, H2, H3) is red.
//   node chaingraph/kernels/__headroom__/run-headroom.mjs --json
//       Emit the reports (profile ocg-headroom-report@1) and the gate findings as JSON.
//   node chaingraph/kernels/__headroom__/run-headroom.mjs --red
//       Control mode: every gate is shown red on a planted fault and green on the real kernels.
//       Exit 1 if any control fails to behave.
//   node chaingraph/kernels/__headroom__/run-headroom.mjs --advisory
//       The preflight form: runs the real pass and the controls, prints both, always exits 0
//       (a crash of the harness itself exits 2).
//
// Copy: "distance to the nearest verdict change found on the declared grid".

import { runDeclaration, loadDeclaration, loadFailOpen, runControls } from './headroom-gates.mjs';

// Node builtins by computed specifier (no @types/node in this repo, SO #10; see headroom-gates.mjs).
/** @type {(name: string) => Promise<any>} */
const nodeBuiltin = (name) => import('node:' + name);
const { readdirSync } = await nodeBuiltin('fs');
const { resolve, dirname } = await nodeBuiltin('path');
const { fileURLToPath } = await nodeBuiltin('url');
/** @type {any} */
const proc = globalThis.process;

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = proc.argv.slice(2);
const json = argv.includes('--json');

async function realPass() {
  const failOpen = loadFailOpen();
  const files = readdirSync(HERE).filter((f) => f.endsWith('.headroom.json')).sort();
  const reports = [];
  const findings = [];
  for (const f of files) {
    const r = await runDeclaration(loadDeclaration(resolve(HERE, f)), { failOpen });
    reports.push(...r.reports);
    findings.push(...r.findings);
  }
  return { reports, findings };
}

function printReal({ reports, findings }) {
  for (const rep of reports) {
    console.log(`${rep.base.tool_id}  base ${rep.base.fixture}  verdict ${rep.base.verdict}  evaluations ${rep.evaluations}`);
    for (const e of rep.entries) {
      if (e.status === 'flip' || e.status === 'domain_edge') {
        console.log(`  ${e.pointer} ${e.direction} ${e.status}  distance ${e.distance} (${e.steps_to_flip} steps of ${e.step}, basis ${e.basis})  ${e.witness.last_same.value} -> ${e.witness.first_other.value}`);
      } else if (e.status === 'refused') {
        console.log(`  ${e.pointer} refused ${e.code}: ${e.detail}`);
      } else {
        console.log(`  ${e.pointer} ${e.direction || ''} ${e.status}${e.bound ? ` (bound: ${e.bound})` : ''}${e.reason ? ` (${e.reason})` : ''}`);
      }
    }
  }
  for (const f of findings) console.log(`${f.ok ? 'ok  ' : 'RED '} ${f.gate}  ${f.detail}`);
}

async function main() {
  if (argv.includes('--red')) {
    const controls = await runControls();
    for (const c of controls) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}`);
    const bad = controls.filter((c) => !c.ok);
    console.log(bad.length ? `headroom controls: ${bad.length} FAILED` : `headroom controls: ${controls.length} controls, each gate red on its plant and green on the real kernels`);
    return bad.length ? 1 : 0;
  }
  const real = await realPass();
  if (argv.includes('--advisory')) {
    printReal(real);
    const controls = await runControls();
    const bad = controls.filter((c) => !c.ok);
    const red = real.findings.filter((f) => !f.ok);
    console.log(`headroom (advisory, always exits 0): ${real.reports.length} base point(s), ${red.length} gate finding(s) red, ${bad.length} control(s) failed`);
    for (const c of bad) console.log(`  control FAIL ${c.name}: ${c.detail}`);
    return 0;
  }
  if (json) console.log(JSON.stringify({ profile: 'ocg-headroom-report@1', reports: real.reports, findings: real.findings }, null, 2));
  else printReal(real);
  return real.findings.some((f) => !f.ok) ? 1 : 0;
}

main().then((code) => proc.exit(code), (e) => { console.error(e && e.stack || e); proc.exit(2); });
