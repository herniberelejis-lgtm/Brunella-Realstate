-- Adds a place to store links to property photos. One URL per line (parsed by the app),
-- rather than a Postgres array type or a separate table — simplest thing that works for a
-- handful of photos per property, and trivial to edit via a plain textarea.
alter table propiedades add column imagenes text;
