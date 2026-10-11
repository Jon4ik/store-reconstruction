# Security rollout

## Required environment

- Set `JWT_SECRET` to a cryptographically random value of at least 32 characters. The API intentionally refuses to start without it.
- Keep `JWT_EXPIRES_IN` at the default `15m` unless there is a reviewed reason to change it.
- Keep `SEED_DEMO_USERS=false` in production. For initial setup, set `BOOTSTRAP_ADMIN_PASSWORD` to a unique password of 12–128 characters, run the migration service once, then remove the variable and run the migration service again. Demo users are opt-in only and require three explicit strong passwords.
- `DOMAIN` must be the full allowed browser origin, including scheme, e.g. `https://reconstruction.example.com`.

## Deploy

1. Back up PostgreSQL.
2. Build and start with `docker compose up --build -d`. The one-shot `migrate` service applies Prisma migrations and seeds roles/TUs before the API starts.
3. Confirm the `migrate` service completed successfully and the API health check is green.
4. Verify a viewer receives HTTP 403 from `/api/users`, `/api/roles`, `/api/audit`, and `/api/import/excel`, while an administrator can access only the routes granted by the current role.
5. Verify logout invalidates the previous bearer token, and that the audit-clear endpoint refuses destructive clearing.
6. Rotate credentials for every existing account that may have used a published default password. The seed script automatically disables the legacy `admin`, `manager`, or `viewer` account only if its stored bcrypt hash still matches the old published default.
7. Keep port 4000 private. Only the frontend/reverse proxy should be exposed publicly.

## Import format

The first worksheet uses row 1 as the header. Each data row must have:
- Column A: store number
- Column B: address
- Column C: active TU ID or full name

The API accepts only `.xlsx`, limits uploads to 5 MiB and 5,000 data rows, and reports success/error counts per row.

## Important limitations

Login throttling is currently in-process and per username. For a multi-instance deployment, move counters to a shared store such as Redis and consider combining username and source-IP limits. Application-level append-only audit prevents deletion through the API; database administrators can still alter database records, so use PostgreSQL permissions and external backups/WORM archival if tamper evidence is a hard requirement.

