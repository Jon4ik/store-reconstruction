ALTER TABLE "notification_rules"
ADD COLUMN "intradeskTaskType" TEXT NOT NULL DEFAULT '',
ADD COLUMN "intradeskTags" TEXT NOT NULL DEFAULT '';
