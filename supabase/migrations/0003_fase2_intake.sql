-- Fase 2: client-facing intake form needs currency-aware budgets, a short referral code per
-- property (pasted into Meta ad `ref` params), bedroom count for matching, and the
-- approve/confirm bookkeeping the WhatsApp hand-off depends on.

-- Unnamed inline CHECK constraints get Postgres's standard auto-generated name
-- (<table>_<column>_check) in real Postgres/Supabase, but pg-mem (used by the test suite)
-- names them <table>_constraint_<N> instead, N counting unnamed constraints in declaration
-- order within 0001_schema.sql. Each pair below drops both names with IF EXISTS so the
-- statement is a no-op on whichever name doesn't apply to the engine actually running it
-- (both names were confirmed empirically against the real migration files, not guessed).
-- The replacement constraint gets a distinct "_v2" name rather than reusing the original:
-- pg-mem has a bug where re-adding a constraint under a name it just dropped silently
-- falls back to an internal auto-generated name instead of honoring the one given.

alter table propiedades add column moneda text check (moneda in ('ARS','USD'));
alter table propiedades add column codigo text unique;
alter table propiedades add column dormitorios integer;
alter table propiedades drop constraint if exists propiedades_tipo_propiedad_check;
alter table propiedades drop constraint if exists propiedades_constraint_1; -- pg-mem name
alter table propiedades add constraint propiedades_tipo_propiedad_check_v2
  check (tipo_propiedad in ('Departamento','Casa','PH','Lote','Local/Oficina'));

alter table busquedas add column moneda text check (moneda in ('ARS','USD'));
alter table busquedas add column presupuesto_min numeric;
alter table busquedas add column presupuesto_max numeric;
alter table busquedas add column documento_aprobado boolean not null default false;
alter table busquedas add column documento_enviado boolean not null default false;
alter table busquedas drop column presupuesto;
alter table busquedas drop constraint if exists busquedas_tipo_propiedad_check;
alter table busquedas drop constraint if exists busquedas_constraint_2; -- pg-mem name
alter table busquedas add constraint busquedas_tipo_propiedad_check_v2
  check (tipo_propiedad in ('Departamento','Casa','PH','Lote','Local/Oficina'));

alter table contactos add column whatsapp_confirmado boolean not null default false;

alter table consultas drop constraint if exists consultas_origen_check;
alter table consultas drop constraint if exists consultas_constraint_2; -- pg-mem name
alter table consultas add constraint consultas_origen_check_v2
  check (origen in ('nota_de_voz','manual','formulario_cliente'));

create table leads_pendientes (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  canal text not null check (canal in ('Instagram','Facebook')),
  psid text not null,
  codigo_propiedad text,
  usado boolean not null default false,
  created_at timestamptz not null default now()
);
