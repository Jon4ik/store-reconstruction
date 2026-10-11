ALTER TABLE "tus" ADD COLUMN IF NOT EXISTS "adObjectGuid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "tus_adObjectGuid_key" ON "tus"("adObjectGuid");
CREATE TABLE IF NOT EXISTS "ldap_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "url" TEXT NOT NULL DEFAULT '',
  "baseDN" TEXT NOT NULL DEFAULT '',
  "bindDN" TEXT NOT NULL DEFAULT '',
  "bindPasswordEncrypted" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ldap_settings_pkey" PRIMARY KEY ("id")
);
