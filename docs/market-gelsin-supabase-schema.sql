-- market_gelsin Supabase read-model schema draft
-- Purpose:
--   - Supabase as BarkodAnaliz-facing read-model and service database
--   - collector SQLite DB remains the operational source system today
--   - Firebase is an optional selective mirror for BarkodAnaliz
-- Notes:
--   - Keep identifiers lowercase
--   - Keep price history append-only
--   - Mirror only derived summary data to Firebase

create extension if not exists pgcrypto;

create table if not exists mg_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  crawl_scope text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

create table if not exists mg_raw_products (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references mg_crawl_runs(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  external_product_id text,
  captured_at timestamptz not null,
  raw_payload jsonb not null,
  parse_status text not null default 'pending',
  parse_notes text,
  created_at timestamptz not null default now()
);

create index if not exists mg_raw_products_crawl_run_idx
  on mg_raw_products (crawl_run_id);

create index if not exists mg_raw_products_source_name_idx
  on mg_raw_products (source_name);

create table if not exists mg_products (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  normalized_product_name text not null,
  brand text,
  normalized_category text,
  pack_size numeric(12,3),
  pack_unit text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mg_products_barcode_unique unique (barcode)
);

create index if not exists mg_products_category_idx
  on mg_products (normalized_category);

create index if not exists mg_products_brand_idx
  on mg_products (brand);

create table if not exists mg_markets (
  id uuid primary key default gen_random_uuid(),
  market_key text not null,
  market_name text not null,
  market_slug text not null,
  market_type text not null,
  coverage_scope text,
  is_local_market boolean not null default false,
  city_code text not null,
  city_name text not null,
  district_name text,
  source_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mg_markets_slug_city_unique unique (market_slug, city_code, coalesce(district_name, ''))
);

create index if not exists mg_markets_city_idx
  on mg_markets (city_code, city_name);

create index if not exists mg_markets_type_idx
  on mg_markets (market_type, is_active);

create index if not exists mg_markets_key_idx
  on mg_markets (market_key, city_code);

create table if not exists mg_market_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references mg_products(id) on delete cascade,
  market_id uuid not null references mg_markets(id) on delete cascade,
  source_url text not null,
  pricing_scope text,
  price_source_type text,
  price numeric(12,2) not null,
  currency text not null default 'TRY',
  unit_price numeric(12,4),
  unit_price_unit text,
  in_stock boolean not null default true,
  source_confidence numeric(4,3),
  captured_at timestamptz not null,
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mg_market_offers_product_market_unique unique (product_id, market_id)
);

create index if not exists mg_market_offers_product_idx
  on mg_market_offers (product_id);

create index if not exists mg_market_offers_market_idx
  on mg_market_offers (market_id);

create index if not exists mg_market_offers_product_price_idx
  on mg_market_offers (product_id, price, in_stock);

create table if not exists mg_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references mg_products(id) on delete cascade,
  market_id uuid not null references mg_markets(id) on delete cascade,
  crawl_run_id uuid references mg_crawl_runs(id) on delete set null,
  pricing_scope text,
  price_source_type text,
  price numeric(12,2) not null,
  currency text not null default 'TRY',
  unit_price numeric(12,4),
  unit_price_unit text,
  in_stock boolean not null default true,
  captured_at timestamptz not null,
  change_type text,
  created_at timestamptz not null default now()
);

create index if not exists mg_price_history_product_market_captured_idx
  on mg_price_history (product_id, market_id, captured_at desc);

create index if not exists mg_price_history_crawl_run_idx
  on mg_price_history (crawl_run_id);

create or replace view mg_product_city_summary as
select
  p.barcode,
  m.city_code,
  m.city_name,
  max(m.coverage_scope) as coverage_scope,
  count(*)::int as offer_count,
  count(*) filter (where o.in_stock)::int as in_stock_offer_count,
  min(o.price) as lowest_price,
  max(o.price) as highest_price,
  percentile_cont(0.5) within group (order by o.price) as median_price,
  max(o.captured_at) as last_seen_at
from mg_market_offers o
join mg_products p on p.id = o.product_id
join mg_markets m on m.id = o.market_id
group by p.barcode, m.city_code, m.city_name;

create or replace view mg_product_best_offers as
select
  p.barcode,
  p.image_url,
  m.city_code,
  m.city_name,
  m.market_key,
  m.market_name,
  m.market_type,
  m.coverage_scope,
  o.pricing_scope,
  o.price_source_type,
  o.price,
  o.currency,
  o.unit_price,
  o.unit_price_unit,
  o.in_stock,
  o.source_url,
  o.captured_at,
  row_number() over (
    partition by p.barcode, m.city_code
    order by o.in_stock desc, o.price asc, o.captured_at desc
  ) as rank_by_price
from mg_market_offers o
join mg_products p on p.id = o.product_id
join mg_markets m on m.id = o.market_id;

-- Optional:
-- price trend materialization can be moved to a materialized view or a scheduled table
-- if weekly / hot-refresh trend reads become expensive at scale.
