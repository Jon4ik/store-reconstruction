CREATE TABLE "store_stage_tasks" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT,
  "requestNumber" TEXT NOT NULL DEFAULT '',
  "message" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedByUserId" TEXT,
  CONSTRAINT "store_stage_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_stage_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "store_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "store_stage_tasks_projectId_taskId_key" ON "store_stage_tasks"("projectId", "taskId");
CREATE INDEX "store_stage_tasks_projectId_idx" ON "store_stage_tasks"("projectId");

-- Переносим уже сохранённый прогресс из JSON в нормализованную таблицу.
INSERT INTO "store_stage_tasks" ("id", "projectId", "taskId", "completed", "status", "requestNumber", "message", "updatedAt", "completedByUserId")
SELECT
  gen_random_uuid()::text,
  p."id",
  item.key,
  COALESCE((item.value->>'completed')::boolean, false),
  item.value->>'status',
  COALESCE(item.value->>'requestNumber', ''),
  COALESCE(item.value->>'message', ''),
  COALESCE((item.value->>'updatedAt')::timestamp, CURRENT_TIMESTAMP),
  item.value->>'completedByUserId'
FROM "store_projects" p
CROSS JOIN LATERAL jsonb_each(COALESCE(p."stageTasks", '{}'::jsonb)) AS item(key, value)
ON CONFLICT ("projectId", "taskId") DO NOTHING;

ALTER TABLE "store_projects" DROP COLUMN "stageTasks";
