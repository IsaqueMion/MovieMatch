-- MovieMatch uses PostgREST/RPC and Realtime, never /graphql/v1.
-- Remove schema introspection without revoking the grants those APIs need.
-- No CASCADE: unexpected dependents must stop this migration.
drop extension if exists pg_graphql;
