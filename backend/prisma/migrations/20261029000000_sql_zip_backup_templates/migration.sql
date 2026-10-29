ALTER TABLE "scheduler_tasks" ADD COLUMN "backupFileName" TEXT NOT NULL DEFAULT 'db-copy{dd}.{MM}.{yyyy}';
UPDATE "notification_rules" SET "name"='Снятие с мониторинга', "intradeskSubject"='Снятие с мониторинга: магазин №{shopNumber}', "messageTemplate"=$template$Магазин №{shopNumber} был демонтирован {demolitionDate}

Необходимо снять магазин с мониторинга.$template$, "updatedAt"=CURRENT_TIMESTAMP WHERE "systemTaskId"='sdDemolitionMonitoring';
UPDATE "notification_rules" SET "name"='Удаление из Printstat и отключение от рассылок', "intradeskSubject"='Удаление из Printstat и отключение от рассылок: магазин №{shopNumber}', "messageTemplate"=$template$Магазин №{shopNumber} был демонтирован {demolitionDate}

Необходимо исключить магазин из рассылок и удалить из Printstat$template$, "updatedAt"=CURRENT_TIMESTAMP WHERE "systemTaskId"='sdDemolitionPrintstat';
UPDATE "notification_rules" SET "name"='Расторжение договора/отключение интернет-канала', "intradeskSubject"='Расторжение договора/отключение интернет-канала: магазин №{shopNumber}', "messageTemplate"=$template$Магазин №{shopNumber} был демонтирован {demolitionDate}

Необходимо расторгнуть договор с интернет-провайдером.$template$, "updatedAt"=CURRENT_TIMESTAMP WHERE "systemTaskId"='sdDemolitionInternet';
