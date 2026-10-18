const mysql = require('mysql2/promise');
const config = require('./config');

// decimalNumbers: DECIMAL 直接返回 JS number（契约要求金额是数字）
// dateStrings: DATETIME 以字符串返回，再由 fmtDate 裁成 YYYY-MM-DD HH:mm
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 与建表一致（utf8mb4_unicode_ci），否则云库上列与字面量比较会报 collation 混用
  charset: 'utf8mb4_unicode_ci',
  decimalNumbers: true,
  dateStrings: true,
  ...(config.dbSsl ? { ssl: config.dbSsl } : {}),
});

function fmtDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())} ${p(value.getHours())}:${p(value.getMinutes())}`;
  }
  return String(value).slice(0, 16);
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

const mapDestination = (r) => ({
  id: r.id,
  name: r.name,
  province: r.province || '',
  intro: r.intro || '',
  refUrl: r.ref_url || '',
});

const mapDestinationAdmin = (r) => ({ ...mapDestination(r), updatedAt: fmtDate(r.updated_at) });

const mapHotel = (r) => ({
  id: r.id,
  destinationId: r.destination_id,
  destinationName: r.destination_name,
  name: r.name,
  level: r.level || '',
  address: r.address || '',
  pricePerNight: num(r.price_per_night),
  note: r.note || '',
  refUrl: r.ref_url || '',
});

const mapHotelAdmin = (r) => ({ ...mapHotel(r), updatedAt: fmtDate(r.updated_at) });

const mapAttraction = (r) => ({
  id: r.id,
  destinationId: r.destination_id,
  destinationName: r.destination_name,
  name: r.name,
  ticketPrice: num(r.ticket_price),
  openTime: r.open_time || '',
  note: r.note || '',
  refUrl: r.ref_url || '',
});

const mapAttractionAdmin = (r) => ({ ...mapAttraction(r), updatedAt: fmtDate(r.updated_at) });

const mapTransport = (r) => ({
  id: r.id,
  fromCity: r.from_city,
  toCity: r.to_city,
  mode: r.mode,
  durationMinutes: Number(r.duration_minutes || 0),
  price: num(r.price),
  note: r.note || '',
});

const mapTransportAdmin = (r) => ({ ...mapTransport(r), updatedAt: fmtDate(r.updated_at) });

const mapUser = (r) => ({
  id: r.id,
  username: r.username,
  role: r.role,
  createdAt: fmtDate(r.created_at),
});

module.exports = {
  pool,
  fmtDate,
  num,
  mapDestination,
  mapDestinationAdmin,
  mapHotel,
  mapHotelAdmin,
  mapAttraction,
  mapAttractionAdmin,
  mapTransport,
  mapTransportAdmin,
  mapUser,
};
