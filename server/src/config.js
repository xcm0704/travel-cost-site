const path = require('path');

const envFile = path.resolve(__dirname, '..', '.env');
const dotenvResult = require('dotenv').config({ path: envFile });

const serverRoot = path.resolve(__dirname, '..');
const env = process.env;

const DEV_FALLBACK_JWT_SECRET = 'travel_cost_dev_fallback_secret';

// DB_SSL=true 时用 TLS 连云数据库（TiDB Cloud 必须开）；证书校验可用 DB_SSL_REJECT_UNAUTHORIZED=false 关掉
const dbSsl =
  String(env.DB_SSL || '').toLowerCase() === 'true'
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: String(env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' }
    : null;

const isProduction = String(env.NODE_ENV || '').toLowerCase() === 'production' || !!env.RENDER;

const db = {
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'travel_cost',
};

function tlsLabel() {
  if (!dbSsl) return '关闭';
  return '开启（TLSv1.2，' + (dbSsl.rejectUnauthorized ? '校验证书' : '不校验证书') + '）';
}

function dbTarget() {
  return db.user + '@' + db.host + ':' + db.port + '/' + db.database;
}

// 启动前的环境自检：缺关键变量时给中文提示，而不是抛一串栈
function startupIssues() {
  const fatal = [];
  const warn = [];

  if (isProduction) {
    if (!env.DB_HOST) fatal.push('没有配 DB_HOST：云数据库的主机地址（TiDB Cloud 控制台 Connect 里那串 Host）');
    if (!env.DB_USER) fatal.push('没有配 DB_USER：云数据库的用户名（TiDB Cloud 一般是前缀.root）');
    if (!env.DB_NAME) fatal.push('没有配 DB_NAME：数据库名（本项目用 travel_cost）');
    if (!env.JWT_SECRET) fatal.push('没有配 JWT_SECRET：随便一串 32 位以上的随机字符，登录令牌靠它签名');
    else if (env.JWT_SECRET.length < 16) fatal.push('JWT_SECRET 太短：至少 16 位，建议 32 位以上随机字符串');
    if (String(env.DB_SSL || '').toLowerCase() !== 'true') {
      warn.push('云数据库一般要求 TLS：建议把 DB_SSL 设成 true（TiDB Cloud 必须）');
    }
  } else {
    if (!dotenvResult.parsed) {
      warn.push('没读到 server/.env，正在用默认本地配置（127.0.0.1:3306 / root / 空密码 / travel_cost）。想改就复制 .env.example 成 .env');
    }
    if (env.JWT_SECRET === DEV_FALLBACK_JWT_SECRET) {
      warn.push('正在用开发兜底 JWT_SECRET，自己本机玩没问题，公网上务必配一个真的');
    }
  }

  return { fatal, warn };
}

module.exports = {
  port: Number(env.PORT || 3000),
  isProduction,
  db,
  dbSsl,
  dbTarget,
  tlsLabel,
  startupIssues,
  envFileLoaded: !!dotenvResult.parsed,
  jwtSecret: env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET,
  jwtSecretIsFallback: (env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET) === DEV_FALLBACK_JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: Number(env.BCRYPT_ROUNDS || 10),
  corsOrigins: (env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  serverRoot,
  webDist: path.resolve(serverRoot, '..', 'web', 'dist'),
};
