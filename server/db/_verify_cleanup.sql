USE travel_cost;
SET NAMES utf8mb4;

DELETE FROM hotels WHERE destination_id IN (SELECT id FROM destinations WHERE name LIKE '测试城%');
DELETE FROM attractions WHERE destination_id IN (SELECT id FROM destinations WHERE name LIKE '测试城%');
DELETE FROM destinations WHERE name LIKE '测试城%';
DELETE FROM transports WHERE from_city LIKE '测试城%' OR to_city LIKE '测试城%';

SELECT '--- 清理自测数据后的条数 ---' AS step;
SELECT (SELECT COUNT(*) FROM destinations) destinations, (SELECT COUNT(*) FROM hotels) hotels,
       (SELECT COUNT(*) FROM attractions) attractions, (SELECT COUNT(*) FROM transports) transports;
