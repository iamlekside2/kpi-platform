const prisma = require('../../config/db');

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function previewCSV(csvText) {
  const { headers, rows } = parseCSV(csvText);
  return {
    headers,
    preview: rows.slice(0, 5),
    totalRows: rows.length,
  };
}

async function importCSV({ orgId, csvText, mapping, userId }) {
  // mapping: { csvColumn: kpiId } e.g. { "Tasks Done": "uuid-of-kpi" }
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const { headers, rows } = parseCSV(csvText);

  // Validate mapping
  const mappedColumns = Object.keys(mapping);
  for (const col of mappedColumns) {
    if (!headers.includes(col)) {
      throw new Error(`Column "${col}" not found in CSV`);
    }
  }

  // Process each mapped column
  const updates = [];
  for (const [csvColumn, kpiId] of Object.entries(mapping)) {
    // Get the last row's value for this column (or could average, sum, etc.)
    // For simplicity: use the last row's value
    const lastRow = rows[rows.length - 1];
    const rawValue = lastRow[csvColumn];
    const numValue = parseFloat(rawValue);

    if (!isNaN(numValue)) {
      updates.push({ kpiId, value: numValue });
    }
  }

  // Apply updates
  const results = [];
  for (const { kpiId, value } of updates) {
    try {
      const updated = await prisma.kPI.update({
        where: { id: kpiId },
        data: { value },
      });
      results.push(updated);
    } catch (err) {
      console.error(`Failed to update KPI ${kpiId}:`, err.message);
    }
  }

  return { updated: results.length, results };
}

module.exports = { parseCSV, previewCSV, importCSV };
