ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE plans
SET is_default = (lower(name) = 'free')
WHERE is_default IS DISTINCT FROM (lower(name) = 'free');

CREATE UNIQUE INDEX IF NOT EXISTS plans_single_default_idx
  ON plans ((is_default))
  WHERE is_default = TRUE;

UPDATE plans
SET status = 'ACTIVE', updated_at = now()
WHERE is_default = TRUE AND status <> 'ACTIVE';

UPDATE stores s
SET trial_ends_at = CASE
  WHEN p.trial_days > 0 THEN now() + p.trial_days * interval '1 day'
  ELSE NULL
END
FROM plans p
WHERE p.is_default = TRUE
  AND s.plan_id = p.id
  AND s.plan_status = 'TRIAL'
  AND s.trial_ends_at IS NULL;

UPDATE stores s
SET plan_id = p.id, plan = p.name, updated_at = now()
FROM plans p
WHERE p.is_default = TRUE
  AND s.plan_id IS NULL;

UPDATE stores s
SET trial_ends_at = CASE
  WHEN p.trial_days > 0 THEN now() + p.trial_days * interval '1 day'
  ELSE NULL
END
FROM plans p
WHERE p.is_default = TRUE
  AND s.plan_id = p.id
  AND s.plan_status = 'TRIAL'
  AND s.trial_ends_at IS NULL;

UPDATE plan_modules pm
SET enabled = FALSE, limit_value = NULL
FROM plans p
WHERE p.id = pm.plan_id
  AND lower(p.name) = 'enterprise'
  AND pm.module_key = 'MULTI_STORE';
