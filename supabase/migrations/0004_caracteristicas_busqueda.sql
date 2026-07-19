-- Richer search criteria: ambientes (total rooms, distinct from dormitorios which is just
-- bedrooms) and baños (bathrooms) as minimums, plus a checklist of amenity features the
-- client cares about (garage, jardín, pileta, etc.), stored as a text array of feature keys.

alter table busquedas add column ambientes integer;
alter table busquedas add column banos integer;
alter table busquedas add column caracteristicas text[] not null default '{}';
