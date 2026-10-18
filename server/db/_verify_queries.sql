USE travel_cost;
SET NAMES utf8mb4;

SELECT '--- 各表条数 ---' AS step;
SELECT (SELECT COUNT(*) FROM destinations) destinations, (SELECT COUNT(*) FROM hotels) hotels,
       (SELECT COUNT(*) FROM attractions) attractions, (SELECT COUNT(*) FROM transports) transports;

SELECT '--- ref_url 城市样例 ---' AS step;
SELECT name, province, ref_url FROM destinations ORDER BY id LIMIT 5;

SELECT '--- ref_url 酒店样例（最新 3 条）---' AS step;
SELECT d.name AS city, h.name AS hotel, h.price_per_night, h.ref_url
FROM hotels h JOIN destinations d ON d.id = h.destination_id ORDER BY h.id DESC LIMIT 3;

SELECT '--- ref_url 景点样例（最新 3 条）---' AS step;
SELECT d.name AS city, a.name AS attraction, a.ticket_price, a.ref_url
FROM attractions a JOIN destinations d ON d.id = a.destination_id ORDER BY a.id DESC LIMIT 3;

SELECT '--- 自测 JSON 导入结果：2 城各 2 酒店 2 景点 ---' AS step;
SELECT d.name AS city, COUNT(DISTINCT h.id) AS hotels, COUNT(DISTINCT a.id) AS attractions
FROM destinations d
LEFT JOIN hotels h ON h.destination_id = d.id
LEFT JOIN attractions a ON a.destination_id = d.id
WHERE d.name LIKE '测试城%'
GROUP BY d.id;

SELECT name, price_per_night, level, address FROM hotels WHERE name LIKE '测试甲%' OR name LIKE '测试乙%' ORDER BY name;
SELECT name, ticket_price, open_time, note FROM attractions WHERE name LIKE '测试甲%' OR name LIKE '测试乙%' ORDER BY name;

SELECT '--- 测算车费抽样 ---' AS step;
SELECT from_city, to_city, mode, duration_minutes, price, LEFT(note, 10) AS note_head
FROM transports
WHERE (from_city = '北京' AND to_city IN ('上海','成都','大连'))
   OR (from_city = '广州' AND to_city = '杭州')
ORDER BY from_city, to_city, price;

SELECT '--- curated 真实价是否压过测算值（北京→上海 高铁应为 553 元/280 分）---' AS step;
SELECT from_city, to_city, mode, duration_minutes, price, note
FROM transports WHERE from_city = '北京' AND to_city = '上海' AND mode = '高铁';
