import fs from 'node:fs';
import { pinyin } from 'pinyin';
import mysql from 'mysql2/promise';
const toPy = (s) => pinyin(s).flat().join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
const raw = JSON.parse(fs.readFileSync('mca-parsed.json', 'utf8'));
const MUNI = ['北京市','天津市','上海市','重庆市'];
const all = [];
const strip = (n) => n.replace(/市$/, '').replace(/(地区|盟)$/, '').replace(/(蒙古族藏族自治州|哈萨克自治州|柯尔克孜自治州|蒙古自治州|藏族自治州|彝族自治州|白族自治州|傣族自治州|壮族苗族自治州|苗族侗族自治州|土家族苗族自治州|布依族苗族自治州|哈尼族彝族自治州|傣族景颇族自治州|傈僳族自治州|回族自治州|朝鲜族自治州|羌族藏族自治州)$/, '');
for (const m of MUNI) all.push({ name: m.replace(/市$/, ''), province: m, full: m, pinyin: toPy(m.replace(/市$/, '')) });
for (const [prov, list] of Object.entries(raw.byProv)) for (const c of list) { const n = strip(c); all.push({ name: n, province: prov, full: c, pinyin: toPy(n) }); }
// 拼音去重：重名追加省份拼音首字母缩写
const seen = {};
for (const c of all) { seen[c.pinyin] = (seen[c.pinyin] || 0) + 1; }
for (const c of all) { if (seen[c.pinyin] > 1) c.pinyin = c.pinyin + '-' + toPy(c.province.replace(/(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)/g, '')); }
const conn = await mysql.createConnection({ host:'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port:4000, user:'NeggxfMCqoLidt1.root', password:'OskD3jskeWTZEbbR', database:'travel_cost', ssl:{minVersion:'TLSv1.2'} });
const [rows] = await conn.query('SELECT name FROM destinations');
await conn.end();
const existing = new Set(rows.map(r => r.name));
const missing = all.filter(c => !existing.has(c.name));
console.log('total:', all.length, '| existing:', all.length - missing.length, '| missing:', missing.length, '| unique pinyin:', new Set(all.map(c=>c.pinyin)).size);
// 热门判定：省会/直辖市/计划单列市/已有的 80 个旅游城市
const CAP = ['石家庄','太原','呼和浩特','沈阳','长春','哈尔滨','南京','杭州','合肥','福州','南昌','济南','郑州','武汉','长沙','广州','南宁','海口','成都','贵阳','昆明','拉萨','西安','兰州','西宁','银川','乌鲁木齐'];
const PLAN = ['大连','青岛','宁波','厦门','深圳'];
for (const c of missing) c.hot = CAP.includes(c.name) || PLAN.includes(c.name);
fs.writeFileSync('cities-master.json', JSON.stringify(all, null, 1));
fs.writeFileSync('cities-to-research.json', JSON.stringify(missing, null, 1));
// 分组：8 组
const GROUPS = 8;
const buckets = Array.from({ length: GROUPS }, () => []);
missing.forEach((c, i) => buckets[i % GROUPS].push(c));
buckets.forEach((b, i) => fs.writeFileSync('group-' + (i + 1) + '.json', JSON.stringify(b, null, 1)));
console.log('group sizes:', buckets.map(b => b.length).join(','));
console.log('hot count:', missing.filter(c => c.hot).length, '| non-hot:', missing.filter(c => !c.hot).length);
console.log('sample pinyin:', missing.slice(0,5).map(c => c.name + '=' + c.pinyin).join(' '));