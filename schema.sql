-- Simple Messaging Platform — Database Schema
-- Run with: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS messaging_platform
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE messaging_platform;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  phone_number  CHAR(11)     NOT NULL UNIQUE,
  username      VARCHAR(30)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- FRIEND REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sender_id   INT NOT NULL,
  receiver_id INT NOT NULL,
  status      ENUM('pending', 'accepted', 'ignored') NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fr_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fr_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_receiver_status (receiver_id, status),
  INDEX idx_sender_status (sender_id, status)
) ENGINE=InnoDB;

-- ============================================================
-- FRIENDS (one row per direction once accepted, for simple lookups)
-- ============================================================
CREATE TABLE IF NOT EXISTS friends (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  friend_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_friend_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_friend_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_pair (user_id, friend_id)
) ENGINE=InnoDB;

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sender_id     INT NOT NULL,
  receiver_id   INT NOT NULL,
  message_text  TEXT,
  message_type  ENUM('text', 'image', 'video') NOT NULL DEFAULT 'text',
  media_url     VARCHAR(500),
  media_name    VARCHAR(255),
  media_size    INT,
  timestamp     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation (sender_id, receiver_id, timestamp)
) ENGINE=InnoDB;
