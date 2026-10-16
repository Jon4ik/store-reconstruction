CREATE TABLE IF NOT EXISTS "shop_directory" (
  "id" TEXT NOT NULL,
  "shopNumber" TEXT NOT NULL,
  "city" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL,
  "workHours" TEXT NOT NULL DEFAULT '',
  "areaManager" TEXT NOT NULL DEFAULT '',
  "areaManagerPhone" TEXT NOT NULL DEFAULT '',
  "tu" TEXT NOT NULL DEFAULT '',
  "directorate" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shop_directory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_directory_shopNumber_key" ON "shop_directory"("shopNumber");
CREATE INDEX IF NOT EXISTS "shop_directory_city_idx" ON "shop_directory"("city");
CREATE TABLE IF NOT EXISTS "scheduler_tasks" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cronExpression" TEXT NOT NULL DEFAULT '0 0 * * *',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "lastStatus" TEXT NOT NULL DEFAULT 'never',
  "lastMessage" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduler_tasks_pkey" PRIMARY KEY ("id")
);

-- Existing installations do not necessarily rerun prisma seed after deployment.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'view_shops')
WHERE NOT ('view_shops' = ANY("permissions"));

UPDATE "roles"
SET "permissions" = array_append("permissions", 'manage_shops')
WHERE "name" = 'Администратор' AND NOT ('manage_shops' = ANY("permissions"));

UPDATE "roles"
SET "permissions" = array_append("permissions", 'manage_scheduler')
WHERE "name" = 'Администратор' AND NOT ('manage_scheduler' = ANY("permissions"));
