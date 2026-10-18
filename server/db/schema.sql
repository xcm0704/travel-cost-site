-- 旅游费用查询网站 · 建库建表
-- 用法：mysql -u root < db/schema.sql   或   npm run db:setup
-- 全部 IF NOT EXISTS：重复执行不报错，且不会清掉已有数据

CREATE DATABASE IF NOT EXISTS `travel_cost`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `travel_cost`;

CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS destinations (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(50) NOT NULL,
  province   VARCHAR(50) DEFAULT '',
  intro      VARCHAR(255) DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_destinations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hotels (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  destination_id   INT NOT NULL,
  name             VARCHAR(100) NOT NULL,
  level            VARCHAR(20) DEFAULT '',
  address          VARCHAR(200) DEFAULT '',
  price_per_night  DECIMAL(10,2) NOT NULL,
  note             VARCHAR(255) DEFAULT '',
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_hotels_destination (destination_id),
  UNIQUE KEY uk_hotels_dest_name (destination_id, name),
  CONSTRAINT fk_hotels_destination FOREIGN KEY (destination_id) REFERENCES destinations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attractions (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  destination_id INT NOT NULL,
  name           VARCHAR(100) NOT NULL,
  ticket_price   DECIMAL(10,2) NOT NULL,
  open_time      VARCHAR(100) DEFAULT '',
  note           VARCHAR(255) DEFAULT '',
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_attractions_destination (destination_id),
  UNIQUE KEY uk_attractions_dest_name (destination_id, name),
  CONSTRAINT fk_attractions_destination FOREIGN KEY (destination_id) REFERENCES destinations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transports (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  from_city        VARCHAR(50) NOT NULL,
  to_city          VARCHAR(50) NOT NULL,
  mode             VARCHAR(20) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  price            DECIMAL(10,2) NOT NULL,
  note             VARCHAR(255) DEFAULT '',
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_transports_route (from_city, to_city),
  UNIQUE KEY uk_transports_route_mode (from_city, to_city, mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
