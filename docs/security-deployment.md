# Deployment and LDAP configuration

## Required environment

- Set `JWT_SECRET` to a cryptographically random value of at least 32 characters.
- Set `DOMAIN` to the allowed browser origin, including scheme.
- Set `LDAP_ENCRYPTION_KEY` to a randomly generated 32-byte key encoded as 64 hex characters. Generate one with `openssl rand -hex 32`. Keep it in the deployment secret store; do not commit it or store it in PostgreSQL.
- The LDAP encryption key must remain stable while encrypted credentials are stored. If the key is lost or changed, re-enter the LDAP bind password in the settings page.
- Keep `SEED_DEMO_USERS=false` in production. The seed process no longer disables accounts automatically. If it restores a legacy demo account still using its published default password, change that password immediately.

## LDAP / Active Directory

1. Configure `LDAP_ENCRYPTION_KEY` in the backend container environment and restart the backend.
2. Open **Настройки LDAP** and fill in the LDAP URL, Base DN, Bind DN and password for a read-only service account. Prefer `ldaps://` with a valid certificate.
3. Test the connection, then save the settings.
4. Open **Справочник ТУ** and click **Синхронизировать с AD**. The action remains disabled until LDAP settings and the encryption key are configured.
5. Synchronization searches users whose `title` attribute is exactly `Территориальный управляющий`. It creates or updates TUs, matches existing entries by AD object GUID or email, and deactivates a matched TU when the corresponding AD account has the disabled bit set in `userAccountControl`.

The bind password is encrypted with AES-256-GCM before it is saved in PostgreSQL. The encryption key is never returned by the API. Grant the service account only the directory read permissions it needs.

## Deploy

Back up PostgreSQL, then run:

```sh
docker compose up --build -d
docker compose logs -f backend frontend
```

The one-shot migration service applies Prisma migrations before the API starts. Do not delete database volumes when deploying these changes.
