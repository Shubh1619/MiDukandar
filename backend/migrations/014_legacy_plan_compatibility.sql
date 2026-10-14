DO $$
DECLARE
  plans_cutover TIMESTAMPTZ;
  default_plan_id UUID;
  compatibility_plan_id UUID;
BEGIN
  SELECT applied_at INTO plans_cutover
  FROM schema_migrations
  WHERE name = '012_plans.sql';

  SELECT id INTO default_plan_id
  FROM plans
  WHERE is_default = TRUE;

  SELECT id INTO compatibility_plan_id
  FROM plans
  WHERE lower(name) = 'pro' AND status = 'ACTIVE';

  IF plans_cutover IS NULL OR default_plan_id IS NULL OR compatibility_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plans compatibility migration requires 012_plans.sql, a default plan, and an active Pro plan';
  END IF;

  UPDATE stores
  SET plan_id = default_plan_id,
      plan = 'Free',
      updated_at = now()
  WHERE created_at < plans_cutover
    AND plan_id IS NULL;

  UPDATE stores
  SET plan_id = compatibility_plan_id,
      plan = 'Pro',
      plan_status = 'ACTIVE',
      trial_ends_at = NULL,
      updated_at = now()
  WHERE created_at < plans_cutover
    AND plan_id = default_plan_id;
END $$;
