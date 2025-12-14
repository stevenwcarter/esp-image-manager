-- Create config table for application settings
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert default screensaver interval (120 seconds)
INSERT INTO config (key, value) VALUES ('screensaver.interval', '120');
