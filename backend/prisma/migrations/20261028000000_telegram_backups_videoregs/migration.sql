ALTER TABLE "integration_settings" ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "telegramTokenEncrypted" TEXT NOT NULL DEFAULT '', ADD COLUMN "telegramProxyEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "telegramProxyUrlEncrypted" TEXT NOT NULL DEFAULT '';
ALTER TABLE "scheduler_tasks" ADD COLUMN "exportDirectory" TEXT NOT NULL DEFAULT '/db_logs';
ALTER TABLE "notification_rules" ADD COLUMN "systemTaskId" TEXT, ADD COLUMN "telegramTargetType" TEXT NOT NULL DEFAULT 'direct',
 ADD COLUMN "telegramChatId" TEXT NOT NULL DEFAULT '', ADD COLUMN "telegramThreadId" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "notification_rules_systemTaskId_key" ON "notification_rules"("systemTaskId");
CREATE TABLE "video_recorders" (
 "id" TEXT PRIMARY KEY, "storeNumber" TEXT NOT NULL UNIQUE, "ipHall" TEXT NOT NULL DEFAULT '', "softwareHall" TEXT NOT NULL DEFAULT '',
 "loginHall" TEXT NOT NULL DEFAULT '', "passwordHallEncrypted" TEXT NOT NULL DEFAULT '', "ipSrl" TEXT NOT NULL DEFAULT '',
 "softwareSrl" TEXT NOT NULL DEFAULT '', "loginSrl" TEXT NOT NULL DEFAULT '', "passwordSrlEncrypted" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
UPDATE "roles" SET "permissions"=(SELECT ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['view_videoregs','manage_videoregs','view_videoregs_passwords','import_videoregs']))) WHERE "name"='Администратор' AND "isSystem"=true;
UPDATE notification_rules SET "systemTaskId"='sdRequest' WHERE id=(SELECT id FROM notification_rules WHERE channel='intradesk' AND "eventType"='closureDate' AND days=1 AND "offsetType"='business_days' ORDER BY "createdAt" LIMIT 1);
INSERT INTO notification_rules (id,"systemTaskId",name,"offsetType","eventType",days,channel,enabled,"messageTemplate","updatedAt")
SELECT 'system-sd-closure','sdRequest','SD: заявка перед закрытием','business_days','closureDate',1,'intradesk',false,'Заявка на закрытие магазина №{shopNumber}. {address}',CURRENT_TIMESTAMP
WHERE NOT EXISTS(SELECT 1 FROM notification_rules WHERE "systemTaskId"='sdRequest');
INSERT INTO notification_rules(id,"systemTaskId",name,"offsetType","eventType",days,channel,enabled,"sendTime","messageTemplate","intradeskGroup","intradeskService","intradeskSubject","intradeskTaskType","intradeskTags","updatedAt")
SELECT item.id,item.task,item.name,'on_event','demolitionDate',0,'intradesk',base.enabled,base."sendTime",item.name||'. Магазин №{shopNumber}. {address}',base."intradeskGroup",base."intradeskService",item.name||': магазин №{shopNumber}',base."intradeskTaskType",base."intradeskTags",CURRENT_TIMESTAMP
FROM (VALUES ('system-sd-demolition-monitoring','sdDemolitionMonitoring','Снятие с мониторинга'),('system-sd-demolition-printstat','sdDemolitionPrintstat','Удаление из Printstat'),('system-sd-demolition-internet','sdDemolitionInternet','Расторжение договора/отключение интернет-канала')) AS item(id,task,name)
CROSS JOIN LATERAL(SELECT * FROM notification_rules WHERE "systemTaskId"='sdRequest' LIMIT 1)base;
