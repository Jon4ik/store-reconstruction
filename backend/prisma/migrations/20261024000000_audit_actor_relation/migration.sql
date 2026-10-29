-- Actor names are resolved through AuditLog.user; the API keeps its display-name field.
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "userName";
UPDATE "roles" SET "permissions" = array_remove("permissions", 'delete_comments')
WHERE 'delete_comments' = ANY("permissions");
