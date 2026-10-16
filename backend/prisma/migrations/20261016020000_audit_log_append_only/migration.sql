-- Audit history is append-only: application roles may insert and read records,
-- but must not rewrite or remove existing evidence. The only permitted UPDATE is
-- detaching nullable foreign keys when a referenced business/user row is deleted;
-- the immutable actor name and audit payload remain intact.
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $audit_guard$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'userId' - 'storeId') IS DISTINCT FROM (to_jsonb(OLD) - 'userId' - 'storeId')
       OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL)
       OR (NEW."storeId" IS DISTINCT FROM OLD."storeId" AND NEW."storeId" IS NOT NULL) THEN
      RAISE EXCEPTION 'audit_logs is append-only: UPDATE is forbidden'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_logs is append-only: % is forbidden', TG_OP
    USING ERRCODE = '55000';
END;
$audit_guard$;

DROP TRIGGER IF EXISTS audit_logs_reject_update_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_reject_update_delete
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_reject_truncate ON public.audit_logs;
CREATE TRIGGER audit_logs_reject_truncate
BEFORE TRUNCATE ON public.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_audit_log_mutation();
