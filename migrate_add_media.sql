-- Migration: add media columns to existing messages table
-- Run this ONLY if you already have the messages table created with the old schema.
-- For new installations, use schema.sql instead (it already includes these columns).

USE messaging_platform;

ALTER TABLE messages
  MODIFY COLUMN message_text TEXT NULL;

ALTER TABLE messages
  ADD COLUMN message_type ENUM('text', 'image', 'video') NOT NULL DEFAULT 'text'
  AFTER message_text;

ALTER TABLE messages
  ADD COLUMN media_url VARCHAR(500) NULL
  AFTER message_type;

ALTER TABLE messages
  ADD COLUMN media_name VARCHAR(255) NULL
  AFTER media_url;

ALTER TABLE messages
  ADD COLUMN media_size INT NULL
  AFTER media_name;
