// Scratch fixture for a real jsdoc-checkjs-gate.mjs positive-control run.
// Deleted before merge. Deliberately reproduces a real TS2353 excess-
// property diagnostic against a TOUCHED file (must still annotate).
/** @param {{x: number}} p */
function f(p) {}
f({ x: 1, y: 2 });

import './_scratch-fixture-untouched.mjs';
