INSERT INTO users (email, password, name, first_name, last_name, role, is_active) VALUES
('admin@clsu.edu.ph', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeCt1uB0Y/CjVzQy', 'System Administrator', 'System', 'Administrator', 'admin', true)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;