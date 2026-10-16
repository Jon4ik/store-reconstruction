-- Permit audit deletion only for the explicit, permission-checked clear operation.
-- The application sets this transaction-local flag immediately before deleting rows;
-- direct DELETE and all TRUNCATE operations remain blocked.
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $audit_guard$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.audit_log_clear', true) = 'on' THEN
    RETURN OLD;
  END IF;

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
