DO $$
BEGIN
  IF current_setting('app.reset_data_confirm', true) IS DISTINCT FROM 'DELETE_ALL_DATA_EXCEPT_SUPERADMINS' THEN
    RAISE EXCEPTION 'Reset migration requires app.reset_data_confirm=DELETE_ALL_DATA_EXCEPT_SUPERADMINS';
  END IF;
END $$;

DO $$
DECLARE
  table_list TEXT;
BEGIN
  SELECT string_agg(format('%I', table_name), ', ' ORDER BY table_name)
  INTO table_list
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN ('super_admins', 'schema_migrations', 'plans', 'plan_modules', 'platform_settings');

  IF table_list IS NOT NULL THEN
    EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', table_list);
  END IF;
END $$;
