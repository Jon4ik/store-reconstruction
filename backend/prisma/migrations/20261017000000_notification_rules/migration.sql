CREATE TABLE IF NOT EXISTS "notification_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "offsetType" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sendTime" TEXT NOT NULL DEFAULT '09:00',
  "messageTemplate" TEXT NOT NULL,
  "intradeskGroup" TEXT NOT NULL DEFAULT '',
  "intradeskService" TEXT NOT NULL DEFAULT '',
  "intradeskSubject" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notification_rules_enabled_eventType_idx" ON "notification_rules"("enabled", "eventType");

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "message" TEXT NOT NULL DEFAULT '',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_ruleId_projectId_eventDate_key" ON "notification_deliveries"("ruleId", "projectId", "eventDate");
CREATE INDEX IF NOT EXISTS "notification_deliveries_sentAt_idx" ON "notification_deliveries"("sentAt");
