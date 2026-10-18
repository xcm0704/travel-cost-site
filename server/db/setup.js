// 建库 + 建表 + 灌数据，一条命令搞定，可重复执行
// 固定顺序：建表 → 老库补列 → curated 真实数据 → 导入 data/*.json → 里程测算车费 → curated 真实价再覆盖一遍
// 本地： npm run db:setup
// 云库： 配好 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL 后跑同一条命令
const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const { createConnection, explainError } = require('./connect');
const { ensureColumns } = require('./migrate');
const { importCities } = require('../scripts/import-cities');
const { generateTransports } = require('../scripts/gen-transports');

const DB_NAME = config.db.database;

function readSql(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

async function tableCounts(conn) {
  const tables = ['users', 'destinations', 'hotels', 'attractions', 'transports'];
  const counts = {};
  for (const table of tables) {
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM ' + table);
    counts[table] = Number(rows[0].c);
  }
  return counts;
}

async function main() {
  console.log('目标数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  if (!config.isProduction && !config.envFileLoaded) {
    console.log('（没有读到 server/.env，用的是默认本地配置；要连云库就设 DB_HOST 等环境变量）');
  }

  const schemaSql = readSql('schema.sql');
  const seedSql = readSql('seed.sql');

  const conn = await createConnection({ database: undefined });

  try {
    await conn.query(
      'CREATE DATABASE IF NOT EXISTS `' + DB_NAME + '` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await conn.query('USE `' + DB_NAME + '`');
    // 连接排序规则与库/表对齐（TiDB 默认 collation_server 是 utf8mb4_bin，不显式指定会报混用）
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('数据库已就绪：' + DB_NAME);

    await conn.query(schemaSql);
    console.log('1/5 建表完成（IF NOT EXISTS，重复跑不会报错）');

    const addedColumns = await ensureColumns(conn);
    console.log('2/5 表结构检查：' + (addedColumns.length ? '补上了列 ' + addedColumns.join('、') : 'ref_url 等列都在，无需改动'));

    await conn.query(seedSql);
    console.log('3/5 策展数据已灌入（5 个城市 + 42 条真实线路，重复跑不会重复插入）');

    const importStats = await importCities(conn);
    console.log('4/5 城市数据导入：' +
      (importStats.files.length === 0
        ? '没有 data/*.json，跳过（不影响其它步骤）'
        : '城市 ' + importStats.cities + '、酒店 ' + importStats.hotels + '、景点 ' + importStats.attractions));

    const genStats = await generateTransports(conn);
    console.log('5/5 里程测算车费：写 ' + genStats.batchSize + ' 条（' + genStats.stats.pairs + ' 组城市对）');

    // 真实价最后再覆盖一遍：curated 的 42 条线路永远优先于测算值
    await conn.query(seedSql);
    console.log('收尾：策展真实价已覆盖测算值（ON DUPLICATE KEY UPDATE）');

    const counts = await tableCounts(conn);
    console.log('各表条数：');
    for (const [table, count] of Object.entries(counts)) {
      console.log('  ' + table.padEnd(14, ' ') + count);
    }
    console.log('管理员账号：admin / 123456');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('');
  console.error('初始化失败：' + explainError(err));
  console.error('目标：' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  console.error('排查顺序：1) 数据库在跑吗 2) .env 或环境变量里的账号密码对不对 3) 云库要不要 DB_SSL=true 4) 账号有没有建库建表权限');
  console.error('详见 docs/部署上线.md 的「常见报错」一节。');
  process.exit(1);
});
