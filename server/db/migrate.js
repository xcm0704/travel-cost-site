// 老库平滑加列：MySQL 没有 ADD COLUMN IF NOT EXISTS，就先问 information_schema 再加
const REQUIRED_COLUMNS = [
  { table: 'destinations', column: 'ref_url', definition: "VARCHAR(255) NOT NULL DEFAULT ''" },
  { table: 'hotels', column: 'ref_url', definition: "VARCHAR(255) NOT NULL DEFAULT ''" },
  { table: 'attractions', column: 'ref_url', definition: "VARCHAR(255) NOT NULL DEFAULT ''" },
];

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS' +
      ' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return Number(rows[0].c) > 0;
}

async function ensureColumns(conn) {
  const added = [];
  for (const item of REQUIRED_COLUMNS) {
    if (await columnExists(conn, item.table, item.column)) continue;
    await conn.query('ALTER TABLE ' + item.table + ' ADD COLUMN ' + item.column + ' ' + item.definition);
    added.push(item.table + '.' + item.column);
  }
  return added;
}

module.exports = { ensureColumns, REQUIRED_COLUMNS };
