# Supabase security review — 2026-10-02

Project: MovieMatch (`rdoxsgnqjamwlrniuikx`). The supplied report contains 47 warnings, repeated across tables/functions.

| Finding | Count | Decision |
| --- | ---: | --- |
| GraphQL schema visibility | 16 | Disable unused `pg_graphql`. Keep PostgREST/RPC grants and RLS unchanged. |
| Callable `SECURITY DEFINER` functions | 13 | Intentional APIs. Reviewed all 12 distinct functions: empty `search_path`, explicit grants, membership/ownership/account checks; public profile reviews honor `is_public` and `show_reviews`. |
| Anonymous access policies | 16 | Guest rooms, votes and personal watch history are intentional. Account-only profile edits, saved rooms and published reviews/votes retain their account checks. The advisor also reports `auth.users`, but the live catalog has no policies on that table and neither client role has SELECT access. |
| Leaked-password protection disabled | 1 | Pending Auth setting; available on Pro and above. Do not change the subscription automatically. |
| Postgres security patches available | 1 | Pending project upgrade; requires a maintenance window because Supabase takes the project offline. |

The separate INFO finding on `private.demo_sessions` is intentional deny-by-default access: RLS is enabled, no client policies, and client grants are revoked.

## Verification

Applied migration `20261002173440_disable_unused_graphql` to production and reran Security Advisor: both GraphQL groups disappeared (16 warnings cleared; 31 warnings remain). Public API table grants are unchanged, all 13 public tables retain RLS, and neither client role can read `auth.users`; anonymous clients cannot read private watch history. Both `tests/accounts.security.sql` and `tests/profile-avatars.security.sql` passed against the live database using fictional identities inside rolled-back transactions.

## Postgres upgrade preparation

The live project runs `17.4.1.075`; database size is 15 MB. Read-only checks found no replication slots, application `reg*` columns, custom operators requiring special estimators, or application functions using legacy PGP encryption. Neither `ltree` nor `btree_gist` is installed. These checks do not replace the dashboard eligibility checks or a verified backup. Use the dashboard's current upgrade estimate, confirm the maintenance window, and verify login, room creation/joining, votes and saved rooms afterward.

References: [GraphQL advisor](https://supabase.com/docs/guides/observability/advisors?lint=0027_pg_graphql_authenticated_table_exposed), [password security](https://supabase.com/docs/guides/auth/password-security), [project upgrades](https://supabase.com/docs/guides/platform/upgrading), [current upgrade caveats](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
