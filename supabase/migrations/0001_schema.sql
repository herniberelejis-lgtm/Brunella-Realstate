-- gen_random_uuid() is built into Postgres 13+ (no extension needed).

create table contactos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  fuente text not null check (fuente in ('Instagram','Facebook','Zonaprop','Grupo Banker','Referido','Otro')),
  fecha_primer_contacto date not null default current_date,
  tipo text not null check (tipo in ('Comprador','Propietario','Ambos')),
  etapa text not null default 'Nuevo' check (etapa in ('Nuevo','Calificando','Buscando','Mostrando propiedades','Negociando','Cerrado-ganado','Cerrado-perdido','Inactivo')),
  temperatura text not null default 'Tibio' check (temperatura in ('Frio','Tibio','Caliente')),
  ultima_actividad timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table propiedades (
  id uuid primary key default gen_random_uuid(),
  contacto_propietario_id uuid references contactos(id),
  direccion text not null,
  tipo_propiedad text not null check (tipo_propiedad in ('Departamento','Casa','Lote','Local/Oficina')),
  descripcion text,
  precio numeric,
  fecha_recibida date not null default current_date,
  condiciones text,
  estado text not null default 'Activa' check (estado in ('Activa','Vendida','Retirada')),
  consultas_historicas integer not null default 0,
  visitas_historicas integer not null default 0,
  created_at timestamptz not null default now()
);

create table busquedas (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id),
  tipo_operacion text not null check (tipo_operacion in ('Compra','Alquiler','Inversion')),
  presupuesto numeric,
  zona text,
  tipo_propiedad text check (tipo_propiedad in ('Departamento','Casa','Lote','Local/Oficina')),
  dormitorios integer,
  otros_requisitos text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table conversaciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id),
  fecha timestamptz not null default now(),
  canal text not null check (canal in ('Llamada','WhatsApp','Instagram DM','Presencial','Otro')),
  resumen text not null,
  proximo_paso text,
  origen text not null default 'manual' check (origen in ('nota_de_voz','manual')),
  created_at timestamptz not null default now()
);

create table muestras (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id),
  propiedad_id uuid references propiedades(id),
  propiedad_mostrada_texto text,
  fecha timestamptz not null default now(),
  feedback text,
  interes_resultante text check (interes_resultante in ('Le interesó','No le interesó','Indeciso')),
  created_at timestamptz not null default now()
);

create table consultas (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades(id),
  contacto_id uuid references contactos(id),
  fecha timestamptz not null default now(),
  canal text not null check (canal in ('Instagram','Facebook','WhatsApp','Zonaprop','Grupo Banker','Otro')),
  origen text not null default 'manual' check (origen in ('nota_de_voz','manual')),
  created_at timestamptz not null default now()
);

create table ofertas (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades(id),
  contacto_id uuid not null references contactos(id),
  monto numeric not null,
  fecha timestamptz not null default now(),
  estado text not null default 'Pendiente' check (estado in ('Pendiente','Aceptada','Rechazada')),
  origen text not null default 'manual' check (origen in ('nota_de_voz','manual')),
  created_at timestamptz not null default now()
);
