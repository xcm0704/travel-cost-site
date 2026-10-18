
import fs from 'node:fs';
for (const p of ['server/db/data/cities-part-A.json','server/db/data/cities-part-B.json']) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cities = d.cities || [];
  let hotels = 0, atts = 0; const thin = [], noSrc = [], dup = [];
  const seen = new Set();
  for (const c of cities) {
    hotels += c.hotels.length; atts += c.attractions.length;
    if (c.hotels.length < 10 || c.hotels.length > 12 || c.attractions.length < 5 || c.attractions.length > 8) thin.push(c.name + ':' + c.hotels.length + '/' + c.attractions.length);
    for (const h of c.hotels) { if (!h.source) noSrc.push(c.name+'/'+h.name); if (seen.has(h.name)) dup.push(h.name); else seen.add(h.name); }
    for (const a of c.attractions) if (!a.source) noSrc.push(c.name+'/'+a.name);
  }
  console.log(p.split('/').pop(), JSON.stringify({cities: cities.length, hotels, atts, thin, noSrc: noSrc.length, dup: dup.length}));
}
