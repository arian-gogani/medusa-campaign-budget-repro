-- Verbatim from packages/modules/promotion/src/migrations/Migration20240227120221.ts:13
create table if not exists "promotion_campaign_budget" ("id" text not null, "type" text check ("type" in ('spend', 'usage')) not null, "campaign_id" text not null, "limit" numeric null, "raw_limit" jsonb null, "used" numeric not null default 0, "raw_used" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "promotion_campaign_budget_pkey" primary key ("id"));

-- Verbatim from packages/modules/promotion/src/migrations/Migration20250909083125.ts up()
alter table if exists "promotion_campaign_budget" drop constraint if exists "promotion_campaign_budget_type_check";
alter table if exists "promotion_campaign_budget" add column if not exists "attribute" text null;
alter table if exists "promotion_campaign_budget" add constraint "promotion_campaign_budget_type_check" check("type" in ('spend', 'usage', 'use_by_attribute', 'spend_by_attribute'));

\echo '--- the constraint as postgres now holds it ---'
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'promotion_campaign_budget'::regclass AND contype = 'c';

\echo ''
\echo '--- insert a spend_by_attribute budget row ---'
INSERT INTO "promotion_campaign_budget"
  ("id", "type", "campaign_id", "limit", "raw_limit", "raw_used", "attribute")
VALUES
  ('probudg_probe_sba', 'spend_by_attribute', 'camp_probe', 10, '{"value":"10"}', '{"value":"0"}', 'customer_id');

\echo ''
\echo '--- the row postgres stored ---'
SELECT id, type, "limit", used, attribute FROM "promotion_campaign_budget";

\echo ''
\echo '--- for contrast, a type the constraint does NOT allow ---'
INSERT INTO "promotion_campaign_budget"
  ("id", "type", "campaign_id", "raw_used")
VALUES
  ('probudg_probe_bogus', 'spend_by_moonphase', 'camp_probe', '{"value":"0"}');
