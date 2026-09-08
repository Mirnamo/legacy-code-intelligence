const billing = require('./billing');

// FIXME: migrate direct billing dependency behind an adapter
export function buildReport(rows) {
  console.log('building report');
  return rows.map(row => ({ id: row.id, total: row.total }));
}

