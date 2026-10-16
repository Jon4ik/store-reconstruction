-- Audit history is append-only: application roles may insert and read records,
-- but must not rewrite or remove existing evidence.
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $audit_guard$
BEGIN
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
