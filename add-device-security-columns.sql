-- Add security columns to iot_devices table for device authentication
-- This migration adds API key and certificate support for IoT device security

ALTER TABLE iot_devices
ADD COLUMN api_key_hash TEXT,
ADD COLUMN certificate TEXT,
ADD COLUMN certificate_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index on api_key_hash for efficient authentication lookups
CREATE INDEX idx_iot_devices_api_key_hash ON iot_devices(api_key_hash);

-- Add comments for documentation
COMMENT ON COLUMN iot_devices.api_key_hash IS 'SHA-256 hash of the device API key for secure authentication';
COMMENT ON COLUMN iot_devices.certificate IS 'Device certificate for secure communication';
COMMENT ON COLUMN iot_devices.certificate_expires_at IS 'Certificate expiration timestamp';