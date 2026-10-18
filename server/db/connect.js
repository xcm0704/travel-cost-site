const mysql = require('mysql2/promise');

const config = require('../src/config');

// 统一的连接参数（本地/云库同一套，DB_SSL=true 时自动带 TLS）
function connectionOptions(extra) {
  const base = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    // 用排序规则名而不是 'utf8mb4'：mysql2 把 'utf8mb4' 映射成 utf8mb4_general_ci，
    // 与建表用的 utf8mb4_unicode_ci 不一致时，云库（TiDB）会报
    // "Illegal mix of collations ... for operation '='"
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: true,
    connectTimeout: 20000,
  };
  return Object.assign(base, config.dbSsl ? { ssl: config.dbSsl } : {}, extra || {});
}

async function createConnection(extra) {
  const conn = await mysql.createConnection(connectionOptions(extra));
  // 双保险：显式把连接排序规则对齐建表用的 utf8mb4_unicode_ci
  await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
  return conn;
}

// 把常见的数据库错误翻译成人话，别甩栈
function explainError(err) {
  const code = err && err.code;
  const map = {
    ECONNREFUSED: '连不上数据库：本机 MySQL 没启动？或者 DB_HOST/DB_PORT 写错了',
    ETIMEDOUT: '连数据库超时：云库地址写错，或者本机网络/防火墙挡住了',
    ENOENT: '连数据库失败：主机名解析不出来，检查 DB_HOST',
    ER_ACCESS_DENIED_ERROR: '账号或密码不对：检查 DB_USER / DB_PASSWORD',
    ER_DBACCESS_DENIED_ERROR: '这个账号没有访问该库的权限：换成能建的账号，或在控制台先把库建好',
    ER_TABLEACCESS_DENIED_ERROR: '这个账号没有建表/改表权限：在云数据库控制台给账号加权限',
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

module.exports = { connectionOptions, createConnection, explainError };
