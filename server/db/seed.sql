-- 旅游费用查询网站 · 样例数据
-- 可重复执行：靠唯一键 + ON DUPLICATE KEY UPDATE，不会重复插入也不报错
-- 重复执行会把价格等字段刷回本文件里的值

USE `travel_cost`;
SET NAMES utf8mb4;

-- 管理员账号：admin / 123456
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2a$10$5YS0w1wod6fclH0RswWnZ.8MaeBQpUoDaKAOj4ePptW1.9be2Euei', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin', password_hash = VALUES(password_hash);

INSERT INTO destinations (name, province, intro) VALUES
('大连', '辽宁', '浪漫之都，海滨风光和海鲜都不缺，夏天来最舒服'),
('北京', '北京', '古都气派，故宫长城胡同串子，一年四季都能玩'),
('上海', '上海', '外滩夜景和弄堂烟火气，逛吃逛吃就够几天'),
('杭州', '浙江', '西湖山水加龙井茶香，慢下来才好看'),
('成都', '四川', '火锅熊猫茶馆，安逸得很，适合躺平式旅游')
ON DUPLICATE KEY UPDATE province = VALUES(province), intro = VALUES(intro);

INSERT INTO hotels (destination_id, name, level, address, price_per_night, note) VALUES
((SELECT id FROM destinations WHERE name = '大连'), '大连星海假日酒店', '五星', '沙河口区中山路572号', 680.00, '海景房，走路就能到星海广场'),
((SELECT id FROM destinations WHERE name = '大连'), '大连凯宾斯基饭店', '五星', '中山区人民路39号', 880.00, '市中心，离中山广场很近'),
((SELECT id FROM destinations WHERE name = '大连'), '如家酒店·大连青泥洼桥店', '经济型', '中山区长江路123号', 219.00, '地铁口，逛街方便'),
((SELECT id FROM destinations WHERE name = '北京'), '北京王府井希尔顿酒店', '五星', '东城区王府井东街8号', 1200.00, '步行到故宫东华门'),
((SELECT id FROM destinations WHERE name = '北京'), '北京前门建国饭店', '四星', '东城区永安路175号', 560.00, '老牌饭店，离天坛和天安门都近'),
((SELECT id FROM destinations WHERE name = '北京'), '南锣鼓巷四合院客栈', '精品民宿', '东城区南锣鼓巷113号', 398.00, '胡同里的小院，安静'),
((SELECT id FROM destinations WHERE name = '上海'), '上海外滩茂悦大酒店', '五星', '虹口区黄浦路199号', 980.00, '看得到外滩和陆家嘴夜景'),
((SELECT id FROM destinations WHERE name = '上海'), '上海民立路希尔顿逸林酒店', '四星', '静安区民立路300号', 620.00, '靠近人民广场，出行方便'),
((SELECT id FROM destinations WHERE name = '上海'), '城市青年旅舍·人民广场店', '经济型', '黄浦区福州路668号', 180.00, '背包客首选，床位干净'),
((SELECT id FROM destinations WHERE name = '杭州'), '杭州西湖国宾馆', '五星', '西湖区杨公堤18号', 1100.00, '西湖边的老牌国宾馆'),
((SELECT id FROM destinations WHERE name = '杭州'), '杭州西湖精品民宿·北山街店', '精品民宿', '西湖区北山街25号', 328.00, '推窗见湖，早上很安静'),
((SELECT id FROM destinations WHERE name = '杭州'), '如家精选酒店·杭州武林广场店', '经济型', '拱墅区体育场路200号', 236.00, '地铁1号线，逛延安路方便'),
((SELECT id FROM destinations WHERE name = '成都'), '成都香格里拉大酒店', '五星', '锦江区滨江东路9号', 780.00, '府南河边，晚上散步很舒服'),
((SELECT id FROM destinations WHERE name = '成都'), '成都宽窄巷子熊猫主题酒店', '精品民宿', '青羊区长顺上街88号', 360.00, '出门就是宽窄巷子'),
((SELECT id FROM destinations WHERE name = '成都'), '锦江之星·成都春熙路店', '经济型', '锦江区暑袜北一街5号', 195.00, '春熙路商圈，吃火锅方便')
ON DUPLICATE KEY UPDATE
  level = VALUES(level), address = VALUES(address), price_per_night = VALUES(price_per_night), note = VALUES(note);

INSERT INTO attractions (destination_id, name, ticket_price, open_time, note) VALUES
((SELECT id FROM destinations WHERE name = '大连'), '老虎滩海洋公园', 220.00, '08:30-17:00', '极地馆和珊瑚馆值得看，玩半天'),
((SELECT id FROM destinations WHERE name = '大连'), '金石滩国家旅游度假区', 100.00, '08:00-17:30', '海蚀地貌，拍照好看'),
((SELECT id FROM destinations WHERE name = '大连'), '大连森林动物园', 120.00, '08:30-16:30', '依山而建，带小孩合适'),
((SELECT id FROM destinations WHERE name = '北京'), '故宫博物院', 60.00, '08:30-17:00（周一闭馆）', '要提前在官网实名预约'),
((SELECT id FROM destinations WHERE name = '北京'), '八达岭长城', 40.00, '06:30-19:00', '旺季人多，上午去'),
((SELECT id FROM destinations WHERE name = '北京'), '颐和园', 30.00, '06:30-18:00', '联票 60 元，含佛香阁'),
((SELECT id FROM destinations WHERE name = '上海'), '上海迪士尼乐园', 475.00, '08:30-20:30', '平日票，节假日会涨'),
((SELECT id FROM destinations WHERE name = '上海'), '东方明珠广播电视塔', 220.00, '09:00-21:00', '含 263 米主观光层'),
((SELECT id FROM destinations WHERE name = '上海'), '上海野生动物园', 165.00, '08:30-17:00', '可以坐投喂车'),
((SELECT id FROM destinations WHERE name = '杭州'), '灵隐寺（飞来峰景区）', 75.00, '07:00-18:00', '含飞来峰门票 45 元'),
((SELECT id FROM destinations WHERE name = '杭州'), '杭州宋城千古情', 320.00, '09:00-21:00', '贵在演出，建议看晚场'),
((SELECT id FROM destinations WHERE name = '杭州'), '西溪国家湿地公园', 80.00, '08:00-17:30', '坐摇橹船另算'),
((SELECT id FROM destinations WHERE name = '成都'), '成都大熊猫繁育研究基地', 55.00, '07:30-18:00', '早上七八点熊猫最活跃'),
((SELECT id FROM destinations WHERE name = '成都'), '武侯祠', 50.00, '08:00-18:00', '隔壁就是锦里'),
((SELECT id FROM destinations WHERE name = '成都'), '都江堰景区', 80.00, '08:00-18:00', '从市区坐动车约半小时')
ON DUPLICATE KEY UPDATE
  ticket_price = VALUES(ticket_price), open_time = VALUES(open_time), note = VALUES(note);

INSERT INTO transports (from_city, to_city, mode, duration_minutes, price, note) VALUES
('沈阳', '大连', '高铁', 120, 145.00, '沈阳北站发车，班次多'),
('沈阳', '大连', '大巴', 240, 95.00, '时间更长，价格便宜'),
('大连', '沈阳', '高铁', 120, 145.00, '返程'),
('大连', '沈阳', '大巴', 240, 95.00, '返程'),
('北京', '大连', '飞机', 90, 620.00, '首都机场起飞'),
('大连', '北京', '飞机', 90, 620.00, '返程'),
('北京', '上海', '高铁', 280, 553.00, '复兴号，北京南站发车'),
('北京', '上海', '飞机', 130, 780.00, '含机建燃油参考价'),
('上海', '北京', '高铁', 280, 553.00, '返程'),
('上海', '杭州', '高铁', 60, 73.00, '上海虹桥到杭州东'),
('杭州', '上海', '高铁', 60, 73.00, '返程'),
('北京', '成都', '飞机', 180, 1250.00, '飞行约 3 小时'),
('成都', '北京', '飞机', 180, 1250.00, '返程'),
('成都', '杭州', '飞机', 150, 980.00, '经停偶尔有'),
('杭州', '成都', '飞机', 150, 980.00, '返程'),
('杭州', '北京', '高铁', 270, 538.00, '杭州东到北京南'),
('北京', '杭州', '高铁', 270, 538.00, '返程'),
('上海', '大连', '飞机', 125, 720.00, '浦东机场起飞')
ON DUPLICATE KEY UPDATE
  duration_minutes = VALUES(duration_minutes), price = VALUES(price), note = VALUES(note);
