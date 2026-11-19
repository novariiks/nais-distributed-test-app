-- Keep V1 unchanged so existing databases can migrate without checksum errors.
-- Messages remain in the messages table and are delivered by polling history.
DROP TABLE outbox;
