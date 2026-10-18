import fs from 'node:fs';
const html = fs.readFileSync('mca-raw.html', 'utf8');
const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
const cells = [];
for (const r of rows) {
  const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
  const ci = tds.findIndex(x => /^\d{6,12}$/.test(x));
  if (ci >= 0 && tds[ci + 1] && /[\u4e00-\u9fa5]/.test(tds[ci + 1])) cells.push({ code: tds[ci], name: tds[ci + 1] });
}
const prov = cells.filter(c => /^\d{2}0000$/.test(c.code));
const pref = cells.filter(c => /^\d{4}00$/.test(c.code) && !/^\d{2}0000$/.test(c.code));
console.log('codes:', cells.length, '| province:', prov.length, '| prefecture:', pref.length);
const byProv = {}; let cur = null;
for (const c of cells) {
  if (/^\d{2}0000$/.test(c.code)) { cur = c.name; byProv[cur] = []; continue; }
  if (/^\d{4}00$/.test(c.code) && cur) byProv[cur].push(c.name);
}
const four = ['北京市','天津市','上海市','重庆市'];
console.log(' municipalities:', four.map(f => f + '=' + (byProv[f]||[]).length).join(' '));
const total = Object.entries(byProv).reduce((n, [k, v]) => n + (four.includes(k) ? 1 : v.length), 0);
console.log('prefecture total (含4直辖市计1):', total);
console.log('samples:', Object.keys(byProv).slice(0,3).map(k => k + '(' + byProv[k].length + '): ' + byProv[k].slice(0,4).join('/')).join(' | '));
fs.writeFileSync('mca-parsed.json', JSON.stringify({ provinces: prov, byProv }, null, 1));
console.log('saved');