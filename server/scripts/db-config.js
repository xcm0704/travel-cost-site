// 诊断用：打印最终生效的数据库连接配置（密码打码，ssl 字段原样打印）
// 用法： node scripts/db-config.js
//        DB_SSL=true node scripts/db-config.js   （看云库 TLS 有没有被真正传给 mysql2）
const config = require('../src/config');
const { pool } = require('../src/db');

const connectionConfig = pool.pool.config.connectionConfig;

const out = {
  env: {
    NODE_ENV: process.env.NODE_ENV || '(未设置)',
    RENDER: process.env.RENDER || '(未设置)',
    PORT: process.env.PORT || '(未设置)',
    DB_SSL: process.env.DB_SSL || '(未设置)',
    DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED || '(未设置)',
    envFileLoaded: config.envFileLoaded,
  },
  resolved: {
    host: connectionConfig.host,
    port: connectionConfig.port,
    user: connectionConfig.user,
    password: connectionConfig.password ? '***（已设置，长度 ' + String(connectionConfig.password).length + '）' : '(空)',
    database: connectionConfig.database,
    charset: connectionConfig.charset,
    decimalNumbers: connectionConfig.decimalNumbers,
    dateStrings: connectionConfig.dateStrings,
    ssl: connectionConfig.ssl || null,
  },
  summary: {
    dbTarget: config.dbTarget(),
    tls: config.tlsLabel(),
    appPort: config.port,
    isProduction: config.isProduction,
  },
};

console.log(JSON.stringify(out, null, 2));
pool.end().catch(() => {});
