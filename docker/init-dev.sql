-- Local developer environment only. Never mount this file in production.
CREATE ROLE toolkit_app LOGIN PASSWORD 'local-dev-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
