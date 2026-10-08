'use strict';
const { checkIntegrity } = require('../ops');
const result = checkIntegrity();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
