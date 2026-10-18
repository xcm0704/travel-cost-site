// Netlify Function 入口：把 Express app 包成 serverless handler
// 访问路径：/api/* -> /.netlify/functions/api/:splat（见根目录 netlify.toml）
// 静态 require：Netlify 的 esbuild 打包器会把整包内联进函数
const serverless = require('serverless-http');

const app = require('../../server/src/app');

const inner = serverless(app);

// Netlify 传进来的 path 可能是 /.netlify/functions/api/health，也可能是 /api/health，统一成 /api/xxx
function normalizePath(event) {
  let p = event.path || (event.rawUrl ? String(event.rawUrl).split('?')[0] : '') || '/';
  const prefix = '/.netlify/functions/api';
  if (p === prefix) p = '/';
  else if (p.indexOf(prefix + '/') === 0) p = p.slice(prefix.length);
  if (!p.startsWith('/')) p = '/' + p;
  if (p !== '/api' && p.indexOf('/api/') !== 0) p = p === '/' ? '/api' : '/api' + p;
  return p;
}

exports.handler = async function (event, context) {
  const patched = Object.assign({}, event, { path: normalizePath(event) });
  const ctx = context || {};
  if (ctx.callbackWaitsForEmptyEventLoop === undefined) ctx.callbackWaitsForEmptyEventLoop = false;
  return inner(patched, ctx);
};
