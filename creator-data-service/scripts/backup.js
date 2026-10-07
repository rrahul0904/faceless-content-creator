'use strict';
const { createBackup } = require('../ops');
try {
  const result = createBackup();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok:false, code:error.code||'BACKUP_FAILED', error:String(error.message||error), details:error.details||null }, null, 2)}\n`);
  process.exitCode = 1;
}
