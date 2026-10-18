// 建库 + 建表 + 灌样例数据，一条命令搞定，可重复执行
// 本地： npm run db:setup
// 云库： 先在环境里配好 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL，再跑同一条命令
const fs = require('fs');
const path = require('path');

const mysql = require('mysql2/promise');

const config = require('../src/config');

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

function explainError(err) {
  const code = err && err.code;
  const map = {
    ECONNREFUSED: '连不上数据库：本机 MySQL 没启动？或者 DB_HOST/DB_PORT 写错了',
    ETIMEDOUT: '连数据库超时：云库地址写错，或者本机网络/防火墙挡住了',
    ENOENT: '连数据库失败：主机名解析不出来，检查 DB_HOST',
    ER_ACCESS_DENIED_ERROR: '账号或密码不对：检查 DB_USER / DB_PASSWORD',
    ER_DBACCESS_DENIED_ERROR: '这个账号没有访问该库的权限：换成能建的账号，或在控制台先把库建好',
    ER_TABLEACCESS_DENIED_ERROR: '这个账号没有建表权限：在云数据库控制台给账号加权限',
    ER_BAD_DB_ERROR: '库不存在且当前账号不能建库：先手动建库（见 docs/部署上线.md）',
    HANDSHAKE_SSL_ERROR: 'TLS 握手失败：云库需要 DB_SSL=true；证书自签的话再加 DB_SSL_REJECT_UNAUTHORIZED=false',
    ER_NOT_SUPPORTED_AUTH_MODE: 'MySQL 认证方式不支持：把 mysql2 升级到最新版',
  };
  if (code && map[code]) return map[code];
  const message = String((err && err.message) || err || '');
  if (/certificate|CERT|SSL|TLS/i.test(message)) {
    return 'TLS 连接出错：确认 DB_SSL=true；如果提示证书校验失败，加 DB_SSL_REJECT_UNAUTHORIZED=false 再试';
  }
  return message || '未知错误';
}

async function main() {
  console.log('目标数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  if (!config.isProduction && !config.envFileLoaded) {
    console.log('（没有读到 server/.env，用的是默认本地配置；要连云库就设 DB_HOST 等环境变量）');
  }

  const schemaSql = readSql('schema.sql');
  const seedSql = readSql('seed.sql');

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: 'utf8mb4',
    multipleStatements: true,
    connectTimeout: 20000,
    ...(config.dbSsl ? { ssl: config.dbSsl } : {}),
  });

  try {
    await conn.query(
      'CREATE DATABASE IF NOT EXISTS \`' + DB_NAME + '\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await conn.query('USE \`' + DB_NAME + '\`');
    console.log('数据库已就绪：' + DB_NAME);

    await conn.query(schemaSql);
    console.log('建表完成（IF NOT EXISTS，重复跑不会报错）');

    await conn.query(seedSql);
    console.log('样例数据已灌入（ON DUPLICATE KEY UPDATE，重复跑不会重复插入）');

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
