-- Full reset of this application's tables. Does not touch unrelated public tables.
-- Run via cleanup-db.sh; all application data and migration history will be removed.
BEGIN;
DROP TABLE IF EXISTS public.notification_deliveries, public.notification_rules,
  public.store_stage_tasks, public.audit_logs, public.comments, public.store_projects,
  public.video_recorders, public.scheduler_tasks, public.shop_directory, public.integration_settings,
  public.ldap_settings, public.tus, public.users, public.roles,
  public._prisma_migrations CASCADE;
DROP FUNCTION IF EXISTS public.reject_audit_log_mutation() CASCADE;
DROP TYPE IF EXISTS public."WorkType" CASCADE;
COMMIT;
