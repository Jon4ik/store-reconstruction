CREATE TABLE IF NOT EXISTS "integration_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "intraDeskEnabled" BOOLEAN NOT NULL DEFAULT false,
  "intraDeskApiGateway" TEXT NOT NULL DEFAULT '',
  "intraDeskApiKeyEncrypted" TEXT NOT NULL DEFAULT '',
  "pachcaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pachcaApiGateway" TEXT NOT NULL DEFAULT 'https://api.pachca.com/api/shared/v1',
  "pachcaApiKeyEncrypted" TEXT NOT NULL DEFAULT '',
  "smtpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smtpHost" TEXT NOT NULL DEFAULT '',
  "smtpPort" INTEGER NOT NULL DEFAULT 587,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
  "smtpUser" TEXT NOT NULL DEFAULT '',
  "smtpPasswordEncrypted" TEXT NOT NULL DEFAULT '',
  "smtpFromEmail" TEXT NOT NULL DEFAULT '',
  "smtpFromName" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "integration_settings" ("id","intraDeskEnabled","intraDeskApiGateway","intraDeskApiKeyEncrypted","updatedAt")
SELECT 'default',"intraDeskEnabled","intraDeskApiGateway","intraDeskApiKeyEncrypted",CURRENT_TIMESTAMP FROM "ldap_settings"
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "ldap_settings" DROP COLUMN IF EXISTS "intraDeskEnabled", DROP COLUMN IF EXISTS "intraDeskApiGateway", DROP COLUMN IF EXISTS "intraDeskApiKeyEncrypted";
ALTER TABLE "notification_rules" ADD COLUMN IF NOT EXISTS "intradeskTaskType" TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS "intradeskTags" TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS "pachcaTargetType" TEXT NOT NULL DEFAULT 'channel', ADD COLUMN IF NOT EXISTS "pachcaEntityId" TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS "pachcaRecipientId" TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS "emailTo" TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS "emailSubject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "requestNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" DROP COLUMN IF EXISTS "chatId", DROP COLUMN IF EXISTS "telegramId";
