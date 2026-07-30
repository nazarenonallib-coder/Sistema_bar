CREATE DATABASE IF NOT EXISTS sistema_chepola
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sistema_chepola;

CREATE TABLE IF NOT EXISTS productos (
  id          INT            AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(255)   NOT NULL,
  precio      DECIMAL(10,2)  NOT NULL,
  descripcion TEXT,
  stock       INT            NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
