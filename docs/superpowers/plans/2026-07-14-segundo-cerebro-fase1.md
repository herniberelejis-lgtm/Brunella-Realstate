# Segundo Cerebro / CRM — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fase 1 segundo cerebro described in
`docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md`: a Telegram bot that turns
Brunella's voice notes into structured CRM records (contactos, propiedades, búsquedas,
conversaciones, muestras, consultas, ofertas), a mobile-friendly dashboard to browse them, and
a daily follow-up reminder job.

**Architecture:** A single Next.js (App Router, TypeScript) app deployed to Vercel.
- `src/lib/db` — Postgres access (`pg` driver) via one generic, table-agnostic repository
  function, so the 7 entities don't need 7 hand-rolled CRUD modules (DRY).
- `src/lib/bot` — pure orchestration logic (transcribe → extract → match → persist → confirm),
  fully unit-testable with mocked HTTP calls, independent of the Next.js route that invokes it.
- `src/app/api/telegram/webhook` — thin route handler wiring Telegram's HTTP payload to the bot
  logic.
- `src/app/api/cron/recordatorios` — thin route handler triggered daily by Vercel Cron.
- `src/app/(dashboard)` — Next.js pages for the contact/property list and detail views.
- Local dev and all automated tests run with **zero external accounts**: `pg-mem` stands in
  for Postgres (schema + repository tests), and an in-memory repository implementation (seeded
  with fixtures) powers `npm run dev` and the dashboard until real Supabase/Groq/Telegram
  credentials exist.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, Tailwind CSS, `pg` (node-postgres) against
a Supabase-hosted Postgres connection string (no Supabase client SDK, no Supabase Auth/Storage —
not needed for this scope), `pg-mem` (dev dependency, in-memory Postgres emulator for tests),
Groq API (Whisper transcription + Llama chat completion for extraction) via plain `fetch`,
Telegram Bot API via plain `fetch`, Vitest for tests, Vercel for hosting + Cron.

## Global Constraints

- Every entity, field, and enum value name matches
  `docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md` exactly (Spanish domain
  names: `Contacto`, `Propiedad`, `Busqueda`, `Conversacion`, `Muestra`, `Consulta`, `Oferta`).
- Zero paid services required to develop and test. Real costs only appear once deployed with
  real Groq/Telegram credentials (both have generous free tiers, per the spec).
- No Docker dependency — all local automated tests must run with plain `npm test`.
- Files stay under 800 lines, functions under 50 lines (per project coding standards).
- Immutable data patterns: repository functions return new objects, never mutate inputs.
- TDD for every task with business logic: write the failing test, watch it fail, implement,
  watch it pass, commit. Conventional commit messages (`feat:`, `test:`, `fix:`, `docs:`).
- The dashboard holds real client PII (names, phones, search criteria) — it must sit behind
  authentication even in this "personal tool" phase (Task 15).
- The Telegram webhook and cron routes must verify a shared secret on every request (Tasks 10,
  11) so they can't be triggered by anyone who guesses the URL.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`,
  `postcss.config.js`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm run dev`, `npm test`, `npm run build` in a Next.js 14 App Router +
  TypeScript + Tailwind project. All later tasks add files under `src/`.

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd "C:/Users/Usuario/Documents/brunella-crm"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --yes
```

- [ ] **Step 2: Add test tooling**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom pg pg-mem
npm install pg
npm install -D @types/pg
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["src/app/**/layout.tsx", "src/app/**/page.tsx"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 4: Add test script to `package.json`**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Write the smoke test**

`src/lib/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 7: Write `.env.example`**

```bash
# Postgres connection string (Supabase → Project Settings → Database → Connection string, "URI")
DATABASE_URL=postgres://user:password@host:5432/postgres

# Telegram (from @BotFather)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Groq (console.groq.com → API Keys)
GROQ_API_KEY=

# Vercel Cron shared secret (any random string you generate yourself)
CRON_SECRET=

# Dashboard basic-auth gate
DASHBOARD_USER=brunella
DASHBOARD_PASSWORD=
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Tailwind and Vitest"
```

---

## Task 2: Database schema + schema test

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Create: `src/lib/db/schema.test.ts`

**Interfaces:**
- Produces: 7 tables — `contactos`, `busquedas`, `propiedades`, `consultas`, `conversaciones`,
  `muestras`, `ofertas` — with the exact columns later tasks read/write.

- [ ] **Step 1: Write the failing schema test**

`src/lib/db/schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { newDb } from "pg-mem";
import fs from "node:fs";
import path from "node:path";

function loadTestDb() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: "uuid" as any,
    impure: true, // must generate a fresh value per row, not be cached/simplified
    implementation: () => crypto.randomUUID(),
  });
  const sql = fs.readFileSync(
    path.join(__dirname, "../../../supabase/migrations/0001_schema.sql"),
    "utf-8"
  );
  db.public.none(sql);
  return db;
}

describe("schema", () => {
  let db: ReturnType<typeof newDb>;

  beforeAll(() => {
    db = loadTestDb();
  });

  it("creates all 7 tables", () => {
    const tables = db.public.many(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
    );
    const names = tables.map((t: any) => t.table_name);
    expect(names).toEqual([
      "busquedas",
      "consultas",
      "contactos",
      "conversaciones",
      "muestras",
      "ofertas",
      "propiedades",
    ]);
  });

  it("enforces contacto tipo enum", () => {
    expect(() =>
      db.public.none(
        "insert into contactos (nombre, fuente, tipo) values ('Test', 'Instagram', 'Invalido')"
      )
    ).toThrow();
  });

  it("links propiedades to an optional contacto_propietario_id", () => {
    db.public.none(
      "insert into contactos (id, nombre, fuente, tipo) values ('11111111-1111-1111-1111-111111111111', 'Dueño', 'Referido', 'Propietario')"
    );
    db.public.none(
      "insert into propiedades (direccion, tipo_propiedad, precio, contacto_propietario_id) values ('Calle Falsa 123', 'Departamento', 100000, '11111111-1111-1111-1111-111111111111')"
    );
    const rows = db.public.many("select * from propiedades");
    expect(rows).toHaveLength(1);
    expect(rows[0].contacto_propietario_id).toBe(
      "11111111-1111-1111-1111-111111111111"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- schema`
Expected: FAIL — `supabase/migrations/0001_schema.sql` doesn't exist yet.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0001_schema.sql`:

```sql
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_schema.sql src/lib/db/schema.test.ts
git commit -m "feat: add Postgres schema for all 7 CRM entities"
```

---

## Task 3: Generic repository + Postgres pool

**Files:**
- Create: `src/lib/db/pool.ts`
- Create: `src/lib/db/repository.ts`
- Create: `src/lib/db/testDb.ts` (pg-mem test harness, reused by later test files)
- Test: `src/lib/db/repository.test.ts`

**Interfaces:**
- Produces: `createRepository<T>(pool, tableName)` returning
  `{ list(where?), findById(id), create(data), update(id, data) }`, and
  `createTestPool(): Pool` (pg-mem-backed, schema pre-loaded) for use by every later repository
  test file.
- Consumes: `supabase/migrations/0001_schema.sql` (Task 2).

- [ ] **Step 1: Write the pg-mem test harness**

`src/lib/db/testDb.ts`:

```typescript
import { newDb } from "pg-mem";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

export function createTestPool(): Pool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: "uuid" as any,
    impure: true, // must generate a fresh value per row, not be cached/simplified
    implementation: () => crypto.randomUUID(),
  });
  const sql = fs.readFileSync(
    path.join(__dirname, "../../../supabase/migrations/0001_schema.sql"),
    "utf-8"
  );
  db.public.none(sql);
  const adapter = db.adapters.createPg();
  return new adapter.Pool() as unknown as Pool;
}
```

- [ ] **Step 2: Write the failing repository test**

`src/lib/db/repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "./testDb";
import { createRepository } from "./repository";
import type { Pool } from "pg";

type Contacto = {
  id: string;
  nombre: string;
  fuente: string;
  tipo: string;
};

describe("createRepository", () => {
  let pool: Pool;
  let repo: ReturnType<typeof createRepository<Contacto>>;

  beforeEach(() => {
    pool = createTestPool();
    repo = createRepository<Contacto>(pool, "contactos");
  });

  it("creates and finds a row by id", async () => {
    const created = await repo.create({
      nombre: "María Gómez",
      fuente: "Instagram",
      tipo: "Comprador",
    });
    expect(created.id).toBeDefined();
    expect(created.nombre).toBe("María Gómez");

    const found = await repo.findById(created.id);
    expect(found?.nombre).toBe("María Gómez");
  });

  it("lists rows filtered by an exact-match where clause", async () => {
    await repo.create({ nombre: "Juan", fuente: "Facebook", tipo: "Comprador" });
    await repo.create({ nombre: "Ana", fuente: "Facebook", tipo: "Propietario" });

    const compradores = await repo.list({ tipo: "Comprador" });
    expect(compradores).toHaveLength(1);
    expect(compradores[0].nombre).toBe("Juan");
  });

  it("updates a row without mutating the input object", async () => {
    const created = await repo.create({ nombre: "Pedro", fuente: "Otro", tipo: "Comprador" });
    const patch = { nombre: "Pedro Actualizado" };
    const updated = await repo.update(created.id, patch);

    expect(updated?.nombre).toBe("Pedro Actualizado");
    expect(patch).toEqual({ nombre: "Pedro Actualizado" }); // input untouched
  });

  it("returns null when finding a nonexistent id", async () => {
    const found = await repo.findById("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- repository`
Expected: FAIL — `./repository` and `./testDb` don't export these yet.

- [ ] **Step 4: Implement the connection pool**

`src/lib/db/pool.ts`:

```typescript
import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}
```

- [ ] **Step 5: Implement the generic repository**

`src/lib/db/repository.ts`:

```typescript
import type { Pool } from "pg";

export type Repository<T extends { id: string }> = {
  list(where?: Partial<T>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: string, patch: Partial<Omit<T, "id">>): Promise<T | null>;
};

function buildWhereClause(where?: Record<string, unknown>) {
  if (!where || Object.keys(where).length === 0) {
    return { clause: "", values: [] as unknown[] };
  }
  const keys = Object.keys(where);
  const clause =
    "where " + keys.map((key, i) => `"${key}" = $${i + 1}`).join(" and ");
  return { clause, values: keys.map((key) => where[key]) };
}

export function createRepository<T extends { id: string }>(
  pool: Pool,
  tableName: string
): Repository<T> {
  return {
    async list(where) {
      const { clause, values } = buildWhereClause(where as Record<string, unknown>);
      const result = await pool.query(
        `select * from "${tableName}" ${clause} order by created_at desc`,
        values
      );
      return result.rows;
    },

    async findById(id) {
      const result = await pool.query(
        `select * from "${tableName}" where id = $1`,
        [id]
      );
      return result.rows[0] ?? null;
    },

    async create(data) {
      const keys = Object.keys(data as Record<string, unknown>);
      const values = keys.map((key) => (data as Record<string, unknown>)[key]);
      const columns = keys.map((key) => `"${key}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `insert into "${tableName}" (${columns}) values (${placeholders}) returning *`,
        values
      );
      return result.rows[0];
    },

    async update(id, patch) {
      const keys = Object.keys(patch as Record<string, unknown>);
      if (keys.length === 0) return this.findById(id);
      const values = keys.map((key) => (patch as Record<string, unknown>)[key]);
      const setClause = keys
        .map((key, i) => `"${key}" = $${i + 2}`)
        .join(", ");
      const result = await pool.query(
        `update "${tableName}" set ${setClause} where id = $1 returning *`,
        [id, ...values]
      );
      return result.rows[0] ?? null;
    },
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- repository`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db
git commit -m "feat: add generic Postgres repository and pg-mem test harness"
```

---

## Task 4: Contact and Property domain modules

**Files:**
- Create: `src/lib/text/normalize.ts`
- Create: `src/lib/domain/contactos.ts`
- Create: `src/lib/domain/propiedades.ts`
- Test: `src/lib/domain/contactos.test.ts`
- Test: `src/lib/domain/propiedades.test.ts`

**Interfaces:**
- Consumes: `createRepository`, `createTestPool` (Task 3).
- Produces: `normalizeText(text)` (accent/case-insensitive helper, reused by Task 8's
  matching logic); `Contacto`, `Propiedad` types; `createContactosModule(pool)` with
  `{ ...repo, findByNombreLike(nombre), findNecesitanSeguimiento(diasSinActividad) }`;
  `createPropiedadesModule(pool)` with `{ ...repo, findByDireccionLike(direccion), withTotales(propiedad) }`.
  Later tasks (bot matching, dashboard, reminders) depend on these exact function names.
- **Note:** `findByNombreLike`/`findByDireccionLike` filter in JS via `normalizeText` rather
  than SQL `ILIKE`. Two reasons, confirmed while implementing: (1) `ILIKE` is case-insensitive
  but accent-*sensitive*, and Whisper transcribes spoken audio which carries no written
  accents, so "maria" must still match "María Gómez"; (2) this keeps matching logic identical
  between the pg-mem test double and real Postgres. `findNecesitanSeguimiento` uses
  `etapa not in (...)` with literal values rather than `!= all($1)`, since pg-mem's SQL
  engine doesn't implement the `all()` array function.

- [ ] **Step 1: Write the failing contactos test**

`src/lib/domain/contactos.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createContactosModule } from "./contactos";
import type { Pool } from "pg";

describe("contactos module", () => {
  let pool: Pool;
  let contactos: ReturnType<typeof createContactosModule>;

  beforeEach(() => {
    pool = createTestPool();
    contactos = createContactosModule(pool);
  });

  it("finds contacts by a fuzzy name match", async () => {
    await contactos.create({
      nombre: "María Gómez",
      fuente: "Instagram",
      tipo: "Comprador",
      etapa: "Nuevo",
      temperatura: "Tibio",
    });
    await contactos.create({
      nombre: "Juan Pérez",
      fuente: "Facebook",
      tipo: "Comprador",
      etapa: "Nuevo",
      temperatura: "Tibio",
    });

    const matches = await contactos.findByNombreLike("maria");
    expect(matches).toHaveLength(1);
    expect(matches[0].nombre).toBe("María Gómez");
  });

  it("finds contacts needing follow-up: stale and not closed/inactive", async () => {
    const stale = await contactos.create({
      nombre: "Stale Contact",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    });
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '10 days' where id = $1",
      [stale.id]
    );

    const fresh = await contactos.create({
      nombre: "Fresh Contact",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    });
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '1 day' where id = $1",
      [fresh.id]
    );

    const closedStale = await contactos.create({
      nombre: "Closed Stale Contact",
      fuente: "Otro",
      tipo: "Comprador",
      etapa: "Cerrado-ganado",
      temperatura: "Tibio",
    });
    await pool.query(
      "update contactos set ultima_actividad = now() - interval '30 days' where id = $1",
      [closedStale.id]
    );

    const needSeguimiento = await contactos.findNecesitanSeguimiento(5);
    expect(needSeguimiento.map((c) => c.nombre)).toEqual(["Stale Contact"]);
  });
});
```

- [ ] **Step 2: Write the failing propiedades test**

`src/lib/domain/propiedades.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createPropiedadesModule } from "./propiedades";
import type { Pool } from "pg";

describe("propiedades module", () => {
  let pool: Pool;
  let propiedades: ReturnType<typeof createPropiedadesModule>;

  beforeEach(() => {
    pool = createTestPool();
    propiedades = createPropiedadesModule(pool);
  });

  it("finds properties by a fuzzy address match", async () => {
    await propiedades.create({
      direccion: "Avenida Colón 1234",
      tipo_propiedad: "Departamento",
      precio: 90000,
      estado: "Activa",
      consultas_historicas: 0,
      visitas_historicas: 0,
    });

    const matches = await propiedades.findByDireccionLike("colon");
    expect(matches).toHaveLength(1);
    expect(matches[0].direccion).toBe("Avenida Colón 1234");
  });

  it("computes consultas_totales and visitas_totales from historical + linked records", async () => {
    const propiedad = await propiedades.create({
      direccion: "Nueva Córdoba 500",
      tipo_propiedad: "Departamento",
      precio: 120000,
      estado: "Activa",
      consultas_historicas: 3,
      visitas_historicas: 1,
    });
    const contacto = await pool.query(
      "insert into contactos (nombre, fuente, tipo) values ('Comprador Test', 'Otro', 'Comprador') returning id"
    );
    const contactoId = contacto.rows[0].id;

    await pool.query(
      "insert into consultas (propiedad_id, contacto_id, canal) values ($1, $2, 'WhatsApp')",
      [propiedad.id, contactoId]
    );
    // interes_resultante is passed explicitly (rather than left NULL) to sidestep a pg-mem
    // limitation where CHECK constraints don't short-circuit on NULL the way real Postgres does.
    await pool.query(
      "insert into muestras (contacto_id, propiedad_id, interes_resultante) values ($1, $2, 'Indeciso')",
      [contactoId, propiedad.id]
    );
    await pool.query(
      "insert into muestras (contacto_id, propiedad_id, interes_resultante) values ($1, $2, 'Indeciso')",
      [contactoId, propiedad.id]
    );

    const withTotales = await propiedades.withTotales(propiedad);
    expect(withTotales.consultas_totales).toBe(4); // 3 historical + 1 new
    expect(withTotales.visitas_totales).toBe(3); // 1 historical + 2 new
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- domain`
Expected: FAIL — `./contactos` and `./propiedades` don't exist yet.

- [ ] **Step 4: Implement the contactos domain module**

`src/lib/domain/contactos.ts`:

First, add the shared accent-insensitive text helper (Whisper transcribes spoken audio, which
carries no written accents, so "maria" must still match "María Gómez"; SQL `ILIKE` is
case-insensitive but accent-*sensitive*, so the fuzzy match is done in JS instead):

`src/lib/text/normalize.ts`:

```typescript
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
```

`src/lib/domain/contactos.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";
import { normalizeText } from "../text/normalize";

export type Contacto = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  fuente: "Instagram" | "Facebook" | "Zonaprop" | "Grupo Banker" | "Referido" | "Otro";
  fecha_primer_contacto: string;
  tipo: "Comprador" | "Propietario" | "Ambos";
  etapa:
    | "Nuevo"
    | "Calificando"
    | "Buscando"
    | "Mostrando propiedades"
    | "Negociando"
    | "Cerrado-ganado"
    | "Cerrado-perdido"
    | "Inactivo";
  temperatura: "Frio" | "Tibio" | "Caliente";
  ultima_actividad: string;
  created_at: string;
};

export function createContactosModule(pool: Pool) {
  const repo = createRepository<Contacto>(pool, "contactos");

  return {
    ...repo,

    async findByNombreLike(nombre: string): Promise<Contacto[]> {
      const todos = await this.list();
      const normalizedQuery = normalizeText(nombre);
      return todos.filter((c) => normalizeText(c.nombre).includes(normalizedQuery));
    },

    async findNecesitanSeguimiento(diasSinActividad: number): Promise<Contacto[]> {
      const result = await pool.query(
        `select * from contactos
         where etapa not in ('Cerrado-ganado', 'Cerrado-perdido', 'Inactivo')
         and ultima_actividad < now() - ($1 || ' days')::interval
         order by ultima_actividad asc`,
        [diasSinActividad]
      );
      return result.rows;
    },

    async marcarActividad(contactoId: string): Promise<void> {
      await pool.query(
        "update contactos set ultima_actividad = now() where id = $1",
        [contactoId]
      );
    },
  };
}
```

- [ ] **Step 5: Implement the propiedades domain module**

`src/lib/domain/propiedades.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";
import { normalizeText } from "../text/normalize";

export type Propiedad = {
  id: string;
  contacto_propietario_id: string | null;
  direccion: string;
  tipo_propiedad: "Departamento" | "Casa" | "Lote" | "Local/Oficina";
  descripcion: string | null;
  precio: number | null;
  fecha_recibida: string;
  condiciones: string | null;
  estado: "Activa" | "Vendida" | "Retirada";
  consultas_historicas: number;
  visitas_historicas: number;
  created_at: string;
};

export type PropiedadConTotales = Propiedad & {
  consultas_totales: number;
  visitas_totales: number;
};

export function createPropiedadesModule(pool: Pool) {
  const repo = createRepository<Propiedad>(pool, "propiedades");

  return {
    ...repo,

    async findByDireccionLike(direccion: string): Promise<Propiedad[]> {
      const todas = await this.list();
      const normalizedQuery = normalizeText(direccion);
      return todas.filter((p) => normalizeText(p.direccion).includes(normalizedQuery));
    },

    async withTotales(propiedad: Propiedad): Promise<PropiedadConTotales> {
      const [consultasResult, muestrasResult] = await Promise.all([
        pool.query("select count(*)::int as total from consultas where propiedad_id = $1", [
          propiedad.id,
        ]),
        pool.query("select count(*)::int as total from muestras where propiedad_id = $1", [
          propiedad.id,
        ]),
      ]);
      return {
        ...propiedad,
        consultas_totales: propiedad.consultas_historicas + consultasResult.rows[0].total,
        visitas_totales: propiedad.visitas_historicas + muestrasResult.rows[0].total,
      };
    },
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- domain`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/domain/contactos.ts src/lib/domain/propiedades.ts src/lib/domain/contactos.test.ts src/lib/domain/propiedades.test.ts
git commit -m "feat: add contactos and propiedades domain modules"
```

---

## Task 5: Búsqueda, Conversación, Muestra, Consulta, Oferta domain modules

**Files:**
- Create: `src/lib/domain/busquedas.ts`
- Create: `src/lib/domain/conversaciones.ts`
- Create: `src/lib/domain/muestras.ts`
- Create: `src/lib/domain/consultas.ts`
- Create: `src/lib/domain/ofertas.ts`
- Test: `src/lib/domain/eventos.test.ts` (covers all five, since each is a thin repo wrapper)

**Interfaces:**
- Consumes: `createRepository` (Task 3), `Contacto`/`Propiedad` types (Task 4).
- Produces: `Busqueda`, `Conversacion`, `Muestra`, `Consulta`, `Oferta` types and
  `createBusquedasModule(pool)`, `createConversacionesModule(pool)`, `createMuestrasModule(pool)`,
  `createConsultasModule(pool)`, `createOfertasModule(pool)` — each `{ ...repo }` plus
  `findByContactoId(contactoId)` (all) and `findByPropiedadId(propiedadId)` (muestras,
  consultas, ofertas). Task 9 (bot orchestration) and Tasks 13–14 (dashboard) depend on these.

- [ ] **Step 1: Write the failing test covering all five modules**

`src/lib/domain/eventos.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createBusquedasModule } from "./busquedas";
import { createConversacionesModule } from "./conversaciones";
import { createMuestrasModule } from "./muestras";
import { createConsultasModule } from "./consultas";
import { createOfertasModule } from "./ofertas";
import type { Pool } from "pg";

async function crearContacto(pool: Pool, nombre: string) {
  const result = await pool.query(
    "insert into contactos (nombre, fuente, tipo) values ($1, 'Otro', 'Comprador') returning *",
    [nombre]
  );
  return result.rows[0];
}

async function crearPropiedad(pool: Pool, direccion: string) {
  const result = await pool.query(
    "insert into propiedades (direccion, tipo_propiedad, precio) values ($1, 'Departamento', 100000) returning *",
    [direccion]
  );
  return result.rows[0];
}

describe("evento domain modules", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createTestPool();
  });

  it("busquedas: creates and finds by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Uno");
    const busquedas = createBusquedasModule(pool);
    await busquedas.create({
      contacto_id: contacto.id,
      tipo_operacion: "Compra",
      presupuesto: 100000,
      zona: "Nueva Córdoba",
      tipo_propiedad: "Departamento",
      dormitorios: 2,
      otros_requisitos: null,
      activa: true,
    });
    const found = await busquedas.findByContactoId(contacto.id);
    expect(found).toHaveLength(1);
    expect(found[0].zona).toBe("Nueva Córdoba");
  });

  it("conversaciones: creates and finds by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Dos");
    const conversaciones = createConversacionesModule(pool);
    await conversaciones.create({
      contacto_id: contacto.id,
      canal: "WhatsApp",
      resumen: "Preguntó por el depto",
      proximo_paso: "Coordinar muestra",
      origen: "manual",
    });
    const found = await conversaciones.findByContactoId(contacto.id);
    expect(found).toHaveLength(1);
    expect(found[0].resumen).toBe("Preguntó por el depto");
  });

  it("muestras: creates and finds by propiedad_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Tres");
    const propiedad = await crearPropiedad(pool, "Calle Uno 100");
    const muestras = createMuestrasModule(pool);
    await muestras.create({
      contacto_id: contacto.id,
      propiedad_id: propiedad.id,
      propiedad_mostrada_texto: null,
      feedback: "Le gustó",
      interes_resultante: "Le interesó",
    });
    const found = await muestras.findByPropiedadId(propiedad.id);
    expect(found).toHaveLength(1);
    expect(found[0].interes_resultante).toBe("Le interesó");
  });

  it("consultas: creates and finds by propiedad_id", async () => {
    const propiedad = await crearPropiedad(pool, "Calle Dos 200");
    const consultas = createConsultasModule(pool);
    await consultas.create({
      propiedad_id: propiedad.id,
      contacto_id: null,
      canal: "Instagram",
      origen: "nota_de_voz",
    });
    const found = await consultas.findByPropiedadId(propiedad.id);
    expect(found).toHaveLength(1);
    expect(found[0].canal).toBe("Instagram");
  });

  it("ofertas: creates and finds by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Cuatro");
    const propiedad = await crearPropiedad(pool, "Calle Tres 300");
    const ofertas = createOfertasModule(pool);
    await ofertas.create({
      propiedad_id: propiedad.id,
      contacto_id: contacto.id,
      monto: 95000,
      estado: "Pendiente",
      origen: "nota_de_voz",
    });
    const found = await ofertas.findByContactoId(contacto.id);
    expect(found).toHaveLength(1);
    expect(found[0].monto).toBe(95000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- eventos`
Expected: FAIL — none of the five modules exist yet.

- [ ] **Step 3: Implement `busquedas.ts`**

`src/lib/domain/busquedas.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Busqueda = {
  id: string;
  contacto_id: string;
  tipo_operacion: "Compra" | "Alquiler" | "Inversion";
  presupuesto: number | null;
  zona: string | null;
  tipo_propiedad: "Departamento" | "Casa" | "Lote" | "Local/Oficina" | null;
  dormitorios: number | null;
  otros_requisitos: string | null;
  activa: boolean;
  created_at: string;
};

export function createBusquedasModule(pool: Pool) {
  const repo = createRepository<Busqueda>(pool, "busquedas");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Busqueda[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Busqueda>);
    },
  };
}
```

- [ ] **Step 4: Implement `conversaciones.ts`**

`src/lib/domain/conversaciones.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Conversacion = {
  id: string;
  contacto_id: string;
  fecha: string;
  canal: "Llamada" | "WhatsApp" | "Instagram DM" | "Presencial" | "Otro";
  resumen: string;
  proximo_paso: string | null;
  origen: "nota_de_voz" | "manual";
  created_at: string;
};

export function createConversacionesModule(pool: Pool) {
  const repo = createRepository<Conversacion>(pool, "conversaciones");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Conversacion[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Conversacion>);
    },
  };
}
```

- [ ] **Step 5: Implement `muestras.ts`**

`src/lib/domain/muestras.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Muestra = {
  id: string;
  contacto_id: string;
  propiedad_id: string | null;
  propiedad_mostrada_texto: string | null;
  fecha: string;
  feedback: string | null;
  interes_resultante: "Le interesó" | "No le interesó" | "Indeciso" | null;
  created_at: string;
};

export function createMuestrasModule(pool: Pool) {
  const repo = createRepository<Muestra>(pool, "muestras");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Muestra[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Muestra>);
    },
    async findByPropiedadId(propiedadId: string): Promise<Muestra[]> {
      return repo.list({ propiedad_id: propiedadId } as Partial<Muestra>);
    },
  };
}
```

- [ ] **Step 6: Implement `consultas.ts`**

`src/lib/domain/consultas.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Consulta = {
  id: string;
  propiedad_id: string;
  contacto_id: string | null;
  fecha: string;
  canal: "Instagram" | "Facebook" | "WhatsApp" | "Zonaprop" | "Grupo Banker" | "Otro";
  origen: "nota_de_voz" | "manual";
  created_at: string;
};

export function createConsultasModule(pool: Pool) {
  const repo = createRepository<Consulta>(pool, "consultas");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Consulta[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Consulta>);
    },
    async findByPropiedadId(propiedadId: string): Promise<Consulta[]> {
      return repo.list({ propiedad_id: propiedadId } as Partial<Consulta>);
    },
  };
}
```

- [ ] **Step 7: Implement `ofertas.ts`**

`src/lib/domain/ofertas.ts`:

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type Oferta = {
  id: string;
  propiedad_id: string;
  contacto_id: string;
  monto: number;
  fecha: string;
  estado: "Pendiente" | "Aceptada" | "Rechazada";
  origen: "nota_de_voz" | "manual";
  created_at: string;
};

export function createOfertasModule(pool: Pool) {
  const repo = createRepository<Oferta>(pool, "ofertas");
  return {
    ...repo,
    async findByContactoId(contactoId: string): Promise<Oferta[]> {
      return repo.list({ contacto_id: contactoId } as Partial<Oferta>);
    },
    async findByPropiedadId(propiedadId: string): Promise<Oferta[]> {
      return repo.list({ propiedad_id: propiedadId } as Partial<Oferta>);
    },
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- eventos`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/domain/busquedas.ts src/lib/domain/conversaciones.ts src/lib/domain/muestras.ts src/lib/domain/consultas.ts src/lib/domain/ofertas.ts src/lib/domain/eventos.test.ts
git commit -m "feat: add busquedas, conversaciones, muestras, consultas, ofertas domain modules"
```

---

## Task 6: Groq client (transcription + extraction)

**Files:**
- Create: `src/lib/groq/client.ts`
- Test: `src/lib/groq/client.test.ts`

**Interfaces:**
- Produces: `transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string>` and
  `extractStructuredData(transcript: string, context: MatchContext): Promise<ExtractedNote>`
  where `ExtractedNote` is defined here and consumed by Task 9 (`processVoiceNote`).

- [ ] **Step 1: Write the failing test**

`src/lib/groq/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribeAudio, extractStructuredData } from "./client";

describe("groq client", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transcribes audio via Groq's Whisper endpoint", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Hablé con María sobre el depto." }),
    });

    const result = await transcribeAudio(Buffer.from("fake-audio"), "note.ogg");

    expect(result).toBe("Hablé con María sobre el depto.");
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain("/audio/transcriptions");
    expect(options.headers.Authorization).toBe("Bearer test-key");
  });

  it("throws a descriptive error when transcription fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });

    await expect(transcribeAudio(Buffer.from("fake-audio"), "note.ogg")).rejects.toThrow(
      /Groq transcription failed/
    );
  });

  it("extracts structured data from a transcript", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                contactoNombreMencionado: "María",
                propiedadMencionada: "depto de Nueva Córdoba",
                tipoEvento: "muestra",
                feedback: "le encantó",
                proximoPaso: "seguimiento el viernes",
                confianza: "alta",
              }),
            },
          },
        ],
      }),
    });

    const result = await extractStructuredData("Hablé con María sobre el depto.", {
      contactosConocidos: [],
      propiedadesConocidas: [],
    });

    expect(result.tipoEvento).toBe("muestra");
    expect(result.contactoNombreMencionado).toBe("María");
    expect(result.confianza).toBe("alta");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- groq`
Expected: FAIL — `./client` doesn't exist yet.

- [ ] **Step 3: Implement the Groq client**

`src/lib/groq/client.ts`:

```typescript
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return key;
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const apiKey = requireApiKey();
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", "whisper-large-v3-turbo");

  const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}

export type MatchContext = {
  contactosConocidos: { id: string; nombre: string }[];
  propiedadesConocidas: { id: string; direccion: string }[];
};

export type ExtractedNote = {
  contactoNombreMencionado: string | null;
  propiedadMencionada: string | null;
  tipoEvento: "conversacion" | "consulta" | "muestra" | "oferta";
  feedback: string | null;
  montoOferta: number | null;
  presupuestoMencionado: number | null;
  proximoPaso: string | null;
  confianza: "alta" | "media" | "baja";
};

const EXTRACTION_SYSTEM_PROMPT = `Sos un asistente que estructura notas de voz de una asesora
inmobiliaria en un JSON. Devolvé SOLO un objeto JSON (sin texto adicional) con estas claves:
contactoNombreMencionado (string o null), propiedadMencionada (string o null),
tipoEvento ("conversacion" | "consulta" | "muestra" | "oferta"),
feedback (string o null), montoOferta (number o null), presupuestoMencionado (number o null),
proximoPaso (string o null), confianza ("alta" | "media" | "baja" — baja si no estás seguro
de a qué contacto o propiedad se refiere la nota).`;

export async function extractStructuredData(
  transcript: string,
  context: MatchContext
): Promise<ExtractedNote> {
  const apiKey = requireApiKey();
  const contextText = `Contactos conocidos: ${context.contactosConocidos
    .map((c) => c.nombre)
    .join(", ") || "ninguno"}. Propiedades conocidas: ${context.propiedadesConocidas
    .map((p) => p.direccion)
    .join(", ") || "ninguna"}.`;

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `${contextText}\n\nNota transcripta: "${transcript}"` },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as ExtractedNote;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- groq`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/groq
git commit -m "feat: add Groq client for transcription and structured extraction"
```

---

## Task 7: Telegram client

**Files:**
- Create: `src/lib/telegram/client.ts`
- Test: `src/lib/telegram/client.test.ts`

**Interfaces:**
- Produces: `sendMessage(chatId, text, options?)`, `getFileDownloadUrl(fileId)`,
  `downloadFile(url)`, `verifyWebhookSecret(headerValue)`. Consumed by Tasks 9, 10, 11.

- [ ] **Step 1: Write the failing test**

`src/lib/telegram/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendMessage,
  getFileDownloadUrl,
  downloadFile,
  verifyWebhookSecret,
} from "./client";

describe("telegram client", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_WEBHOOK_SECRET = "shh";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a message via the Bot API", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await sendMessage(12345, "Hola");

    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse(options.body);
    expect(body).toEqual({ chat_id: 12345, text: "Hola" });
  });

  it("resolves a file_id to a downloadable URL", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { file_path: "voice/file123.oga" } }),
    });

    const url = await getFileDownloadUrl("file123");

    expect(url).toBe(
      "https://api.telegram.org/file/bottest-token/voice/file123.oga"
    );
  });

  it("downloads file bytes from a URL", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    (fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });

    const buffer = await downloadFile("https://example.com/file.oga");

    expect(Buffer.from(buffer)).toEqual(Buffer.from(bytes));
  });

  it("verifies the webhook secret header matches the configured secret", () => {
    expect(verifyWebhookSecret("shh")).toBe(true);
    expect(verifyWebhookSecret("wrong")).toBe(false);
    expect(verifyWebhookSecret(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- telegram`
Expected: FAIL — `./client` doesn't exist yet.

- [ ] **Step 3: Implement the Telegram client**

`src/lib/telegram/client.ts`:

```typescript
function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${requireBotToken()}/${method}`;
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: { reply_markup?: unknown }
): Promise<void> {
  const response = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed (${response.status})`);
  }
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const token = requireBotToken();
  const response = await fetch(apiUrl("getFile") + `?file_id=${fileId}`);
  if (!response.ok) {
    throw new Error(`Telegram getFile failed (${response.status})`);
  }
  const data = await response.json();
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

export async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`File download failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function verifyWebhookSecret(headerValue: string | undefined | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !headerValue) return false;
  return headerValue === expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- telegram`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram
git commit -m "feat: add Telegram Bot API client"
```

---

## Task 8: Contact and property matching logic

**Files:**
- Create: `src/lib/bot/matching.ts`
- Test: `src/lib/bot/matching.test.ts`

**Interfaces:**
- Consumes: `normalizeText` (Task 4, `src/lib/text/normalize.ts`) — reused here rather than
  duplicated, since it's the same accent/case-insensitive comparison need.
- Produces: `matchContacto(nombreMencionado, candidatos): MatchResult<Contacto>` and
  `matchPropiedad(direccionMencionada, candidatos): MatchResult<Propiedad>`, where
  `MatchResult<T> = { type: "unico"; item: T } | { type: "ambiguo"; candidatos: T[] } | { type: "sin_match" }`.
  Consumed by Task 9.

- [ ] **Step 1: Write the failing test**

`src/lib/bot/matching.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { matchContacto, matchPropiedad } from "./matching";
import type { Contacto } from "../domain/contactos";
import type { Propiedad } from "../domain/propiedades";

function contacto(nombre: string): Contacto {
  return {
    id: nombre,
    nombre,
    telefono: null,
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Nuevo",
    temperatura: "Tibio",
    ultima_actividad: "2026-01-01",
    created_at: "2026-01-01",
  };
}

function propiedad(direccion: string): Propiedad {
  return {
    id: direccion,
    contacto_propietario_id: null,
    direccion,
    tipo_propiedad: "Departamento",
    descripcion: null,
    precio: null,
    fecha_recibida: "2026-01-01",
    condiciones: null,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
    created_at: "2026-01-01",
  };
}

describe("matchContacto", () => {
  it("returns 'sin_match' when no name was mentioned", () => {
    expect(matchContacto(null, [contacto("María Gómez")])).toEqual({ type: "sin_match" });
  });

  it("returns a unique match on an exact case-insensitive substring", () => {
    const candidatos = [contacto("María Gómez"), contacto("Juan Pérez")];
    expect(matchContacto("maria", candidatos)).toEqual({
      type: "unico",
      item: candidatos[0],
    });
  });

  it("returns 'ambiguo' when more than one candidate matches", () => {
    const candidatos = [contacto("Juan Pérez"), contacto("Juan Gómez")];
    const result = matchContacto("juan", candidatos);
    expect(result.type).toBe("ambiguo");
    if (result.type === "ambiguo") {
      expect(result.candidatos).toHaveLength(2);
    }
  });

  it("returns 'sin_match' when no candidate matches", () => {
    expect(matchContacto("Roberto", [contacto("María Gómez")])).toEqual({
      type: "sin_match",
    });
  });
});

describe("matchPropiedad", () => {
  it("returns a unique match on a partial address mention", () => {
    const candidatos = [propiedad("Avenida Colón 1234"), propiedad("Calle Falsa 100")];
    expect(matchPropiedad("colon", candidatos)).toEqual({
      type: "unico",
      item: candidatos[0],
    });
  });

  it("returns 'sin_match' when nothing was mentioned or matches", () => {
    expect(matchPropiedad(null, [propiedad("Avenida Colón 1234")])).toEqual({
      type: "sin_match",
    });
    expect(matchPropiedad("inexistente", [propiedad("Avenida Colón 1234")])).toEqual({
      type: "sin_match",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- matching`
Expected: FAIL — `./matching` doesn't exist yet.

- [ ] **Step 3: Implement matching logic**

`src/lib/bot/matching.ts`:

```typescript
import type { Contacto } from "../domain/contactos";
import type { Propiedad } from "../domain/propiedades";
import { normalizeText } from "../text/normalize";

export type MatchResult<T> =
  | { type: "unico"; item: T }
  | { type: "ambiguo"; candidatos: T[] }
  | { type: "sin_match" };

function matchByField<T>(
  mencion: string | null,
  candidatos: T[],
  getField: (item: T) => string
): MatchResult<T> {
  if (!mencion) return { type: "sin_match" };
  const normalizedMencion = normalizeText(mencion);
  const matches = candidatos.filter((item) =>
    normalizeText(getField(item)).includes(normalizedMencion)
  );
  if (matches.length === 0) return { type: "sin_match" };
  if (matches.length === 1) return { type: "unico", item: matches[0] };
  return { type: "ambiguo", candidatos: matches };
}

export function matchContacto(
  nombreMencionado: string | null,
  candidatos: Contacto[]
): MatchResult<Contacto> {
  return matchByField(nombreMencionado, candidatos, (c) => c.nombre);
}

export function matchPropiedad(
  direccionMencionada: string | null,
  candidatos: Propiedad[]
): MatchResult<Propiedad> {
  return matchByField(direccionMencionada, candidatos, (p) => p.direccion);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- matching`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/matching.ts src/lib/bot/matching.test.ts
git commit -m "feat: add contact and property matching logic"
```

---

## Task 9: `processVoiceNote` orchestration

**Files:**
- Create: `src/lib/bot/processVoiceNote.ts`
- Test: `src/lib/bot/processVoiceNote.test.ts`

**Interfaces:**
- Consumes: `transcribeAudio`, `extractStructuredData` (Task 6); `matchContacto`,
  `matchPropiedad` (Task 8); domain modules (Tasks 4, 5).
- Produces: `processVoiceNote(deps, audioBuffer, filename): Promise<{ respuesta: string }>`
  where `deps` bundles all injected modules — this is the exact shape Task 10 (webhook route)
  constructs and calls.

- [ ] **Step 1: Write the failing test**

`src/lib/bot/processVoiceNote.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { processVoiceNote, type ProcessVoiceNoteDeps } from "./processVoiceNote";

function buildDeps(overrides: Partial<ProcessVoiceNoteDeps> = {}): ProcessVoiceNoteDeps {
  const defaults: ProcessVoiceNoteDeps = {
    transcribeAudio: vi.fn().mockResolvedValue("transcripción por defecto"),
    extractStructuredData: vi.fn().mockResolvedValue({
      contactoNombreMencionado: null,
      propiedadMencionada: null,
      tipoEvento: "conversacion",
      feedback: null,
      montoOferta: null,
      presupuestoMencionado: null,
      proximoPaso: null,
      confianza: "alta",
    }),
    contactos: {
      list: vi.fn().mockResolvedValue([]),
      findByNombreLike: vi.fn().mockResolvedValue([]),
      marcarActividad: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
    } as any,
    propiedades: {
      list: vi.fn().mockResolvedValue([]),
      findByDireccionLike: vi.fn().mockResolvedValue([]),
    } as any,
    conversaciones: { create: vi.fn().mockResolvedValue({}) } as any,
    muestras: { create: vi.fn().mockResolvedValue({}) } as any,
    consultas: { create: vi.fn().mockResolvedValue({}) } as any,
    ofertas: { create: vi.fn().mockResolvedValue({}) } as any,
  };
  // Merge nested deps objects (not just top-level) so a test overriding e.g.
  // `contactos.findByNombreLike` doesn't silently drop the default `contactos.list` mock.
  return {
    ...defaults,
    ...overrides,
    contactos: { ...defaults.contactos, ...(overrides.contactos as object) } as any,
    propiedades: { ...defaults.propiedades, ...(overrides.propiedades as object) } as any,
  };
}

describe("processVoiceNote", () => {
  it("asks for clarification when confianza is 'baja'", async () => {
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "María",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "baja",
      }),
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(result.respuesta).toMatch(/no.*segur|repet/i);
    expect(deps.conversaciones.create).not.toHaveBeenCalled();
  });

  it("asks the user to choose when the contact name is ambiguous", async () => {
    const juanPerez = { id: "1", nombre: "Juan Pérez" };
    const juanGomez = { id: "2", nombre: "Juan Gómez" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: {
        findByNombreLike: vi.fn().mockResolvedValue([juanPerez, juanGomez]),
      } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(result.respuesta).toContain("Juan Pérez");
    expect(result.respuesta).toContain("Juan Gómez");
    expect(deps.conversaciones.create).not.toHaveBeenCalled();
  });

  it("creates a Conversacion for a matched contact and confirms it", async () => {
    const maria = { id: "1", nombre: "María Gómez" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "María",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: "quiere ver más opciones",
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: "mandarle más opciones",
        confianza: "alta",
      }),
      contactos: {
        findByNombreLike: vi.fn().mockResolvedValue([maria]),
        marcarActividad: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.conversaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contacto_id: "1",
        resumen: "quiere ver más opciones",
        proximo_paso: "mandarle más opciones",
        origen: "nota_de_voz",
      })
    );
    expect(deps.contactos.marcarActividad).toHaveBeenCalledWith("1");
    expect(result.respuesta).toContain("María Gómez");
  });

  it("creates a Muestra linked to contacto and propiedad when tipoEvento is 'muestra'", async () => {
    const maria = { id: "1", nombre: "María Gómez" };
    const depto = { id: "10", direccion: "Nueva Córdoba 500" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "María",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "muestra",
        feedback: "le encantó",
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: "esperar respuesta",
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([maria]), marcarActividad: vi.fn() } as any,
      propiedades: { findByDireccionLike: vi.fn().mockResolvedValue([depto]) } as any,
    });

    await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.muestras.create).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "1", propiedad_id: "10", feedback: "le encantó" })
    );
  });

  it("creates an Oferta with the mentioned amount when tipoEvento is 'oferta'", async () => {
    const juan = { id: "1", nombre: "Juan Pérez" };
    const depto = { id: "10", direccion: "Nueva Córdoba 500" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "oferta",
        feedback: null,
        montoOferta: 95000,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([juan]), marcarActividad: vi.fn() } as any,
      propiedades: { findByDireccionLike: vi.fn().mockResolvedValue([depto]) } as any,
    });

    await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.ofertas.create).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "1", propiedad_id: "10", monto: 95000, estado: "Pendiente" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- processVoiceNote`
Expected: FAIL — `./processVoiceNote` doesn't exist yet.

- [ ] **Step 3: Implement the orchestration**

`src/lib/bot/processVoiceNote.ts`:

```typescript
import { transcribeAudio, extractStructuredData, type ExtractedNote } from "../groq/client";
import { matchContacto, matchPropiedad } from "./matching";
import type { createContactosModule } from "../domain/contactos";
import type { createPropiedadesModule } from "../domain/propiedades";
import type { createConversacionesModule } from "../domain/conversaciones";
import type { createMuestrasModule } from "../domain/muestras";
import type { createConsultasModule } from "../domain/consultas";
import type { createOfertasModule } from "../domain/ofertas";

export type ProcessVoiceNoteDeps = {
  transcribeAudio: typeof transcribeAudio;
  extractStructuredData: typeof extractStructuredData;
  contactos: ReturnType<typeof createContactosModule>;
  propiedades: ReturnType<typeof createPropiedadesModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
  muestras: ReturnType<typeof createMuestrasModule>;
  consultas: ReturnType<typeof createConsultasModule>;
  ofertas: ReturnType<typeof createOfertasModule>;
};

const CLARIFICATION_MESSAGE =
  "No estoy segura de haber entendido bien esa nota. ¿Podés repetirla o mandarme un resumen escrito?";

function buildAmbiguityMessage(nombreODireccion: string, opciones: { nombre?: string; direccion?: string }[]) {
  const lista = opciones.map((o) => `- ${o.nombre ?? o.direccion}`).join("\n");
  return `Encontré más de una coincidencia para "${nombreODireccion}":\n${lista}\n¿A cuál te referís? Contame de nuevo con más detalle.`;
}

export async function processVoiceNote(
  deps: ProcessVoiceNoteDeps,
  audioBuffer: Buffer,
  filename: string
): Promise<{ respuesta: string }> {
  const transcript = await deps.transcribeAudio(audioBuffer, filename);

  const [contactosConocidos, propiedadesConocidas] = await Promise.all([
    deps.contactos.list(),
    deps.propiedades.list(),
  ]);

  const extracted: ExtractedNote = await deps.extractStructuredData(transcript, {
    contactosConocidos: contactosConocidos.map((c) => ({ id: c.id, nombre: c.nombre })),
    propiedadesConocidas: propiedadesConocidas.map((p) => ({ id: p.id, direccion: p.direccion })),
  });

  if (extracted.confianza === "baja") {
    return { respuesta: CLARIFICATION_MESSAGE };
  }

  const contactoCandidatos = extracted.contactoNombreMencionado
    ? await deps.contactos.findByNombreLike(extracted.contactoNombreMencionado)
    : [];
  const contactoMatch = matchContacto(extracted.contactoNombreMencionado, contactoCandidatos);

  if (contactoMatch.type === "ambiguo") {
    return {
      respuesta: buildAmbiguityMessage(extracted.contactoNombreMencionado!, contactoMatch.candidatos),
    };
  }
  if (contactoMatch.type === "sin_match") {
    return {
      respuesta:
        "No encontré ningún contacto que coincida con esa nota. Si es alguien nuevo, contame su nombre completo y de dónde viene (Instagram, Facebook, portal, referido) para cargarlo.",
    };
  }

  const contacto = contactoMatch.item;

  const propiedadCandidatos = extracted.propiedadMencionada
    ? await deps.propiedades.findByDireccionLike(extracted.propiedadMencionada)
    : [];
  const propiedadMatch = matchPropiedad(extracted.propiedadMencionada, propiedadCandidatos);

  if (propiedadMatch.type === "ambiguo") {
    return {
      respuesta: buildAmbiguityMessage(extracted.propiedadMencionada!, propiedadMatch.candidatos),
    };
  }

  const propiedadId = propiedadMatch.type === "unico" ? propiedadMatch.item.id : null;

  switch (extracted.tipoEvento) {
    case "muestra":
      await deps.muestras.create({
        contacto_id: contacto.id,
        propiedad_id: propiedadId,
        propiedad_mostrada_texto: propiedadId ? null : extracted.propiedadMencionada,
        feedback: extracted.feedback,
        interes_resultante: null,
      } as any);
      break;
    case "consulta":
      if (propiedadId) {
        await deps.consultas.create({
          propiedad_id: propiedadId,
          contacto_id: contacto.id,
          canal: "Otro",
          origen: "nota_de_voz",
        } as any);
      }
      break;
    case "oferta":
      if (propiedadId && extracted.montoOferta) {
        await deps.ofertas.create({
          propiedad_id: propiedadId,
          contacto_id: contacto.id,
          monto: extracted.montoOferta,
          estado: "Pendiente",
          origen: "nota_de_voz",
        } as any);
      }
      break;
    default:
      await deps.conversaciones.create({
        contacto_id: contacto.id,
        canal: "Otro",
        resumen: extracted.feedback ?? transcript,
        proximo_paso: extracted.proximoPaso,
        origen: "nota_de_voz",
      } as any);
  }

  await deps.contactos.marcarActividad(contacto.id);

  return {
    respuesta: `✅ Guardé: ${contacto.nombre} — ${extracted.tipoEvento}${
      extracted.proximoPaso ? `. Próximo paso: ${extracted.proximoPaso}` : ""
    }`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- processVoiceNote`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/processVoiceNote.ts src/lib/bot/processVoiceNote.test.ts
git commit -m "feat: add processVoiceNote orchestration for the Telegram bot"
```

---

## Task 10: Telegram webhook route

**Files:**
- Create: `src/app/api/telegram/webhook/route.ts`
- Test: `src/app/api/telegram/webhook/route.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookSecret`, `getFileDownloadUrl`, `downloadFile`, `sendMessage`
  (Task 7); `processVoiceNote` (Task 9); `getPool` (Task 3); domain module factories
  (Tasks 4, 5).

- [ ] **Step 1: Write the failing test**

`src/app/api/telegram/webhook/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/telegram/client", () => ({
  verifyWebhookSecret: vi.fn(),
  getFileDownloadUrl: vi.fn().mockResolvedValue("https://example.com/file.oga"),
  downloadFile: vi.fn().mockResolvedValue(Buffer.from("audio")),
  sendMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bot/processVoiceNote", () => ({
  processVoiceNote: vi.fn().mockResolvedValue({ respuesta: "✅ Guardé todo" }),
}));
vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));

import { POST } from "./route";
import { verifyWebhookSecret } from "@/lib/telegram/client";
import { processVoiceNote } from "@/lib/bot/processVoiceNote";

function buildRequest(body: unknown, secretHeader?: string) {
  return new NextRequest("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: secretHeader ? { "x-telegram-bot-api-secret-token": secretHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(true);
  });

  it("rejects requests with an invalid webhook secret", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);

    const response = await POST(buildRequest({}, "wrong-secret"));

    expect(response.status).toBe(401);
  });

  it("ignores updates without a voice message", async () => {
    const response = await POST(
      buildRequest({ message: { chat: { id: 1 }, text: "hola" } }, "secret")
    );

    expect(response.status).toBe(200);
    expect(processVoiceNote).not.toHaveBeenCalled();
  });

  it("processes a voice note and replies with the confirmation", async () => {
    const response = await POST(
      buildRequest(
        { message: { chat: { id: 1 }, voice: { file_id: "abc123" } } },
        "secret"
      )
    );

    expect(response.status).toBe(200);
    expect(processVoiceNote).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- webhook`
Expected: FAIL — `./route` doesn't exist yet.

- [ ] **Step 3: Implement the webhook route**

`src/app/api/telegram/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSecret,
  getFileDownloadUrl,
  downloadFile,
  sendMessage,
} from "@/lib/telegram/client";
import { processVoiceNote } from "@/lib/bot/processVoiceNote";
import { transcribeAudio, extractStructuredData } from "@/lib/groq/client";
import { getPool } from "@/lib/db/pool";
import { createContactosModule } from "@/lib/domain/contactos";
import { createPropiedadesModule } from "@/lib/domain/propiedades";
import { createConversacionesModule } from "@/lib/domain/conversaciones";
import { createMuestrasModule } from "@/lib/domain/muestras";
import { createConsultasModule } from "@/lib/domain/consultas";
import { createOfertasModule } from "@/lib/domain/ofertas";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    voice?: { file_id: string };
  };
};

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secretHeader)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const voice = update.message?.voice;
  const chatId = update.message?.chat.id;

  if (!voice || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const fileUrl = await getFileDownloadUrl(voice.file_id);
  const audioBuffer = await downloadFile(fileUrl);

  const pool = getPool();
  const { respuesta } = await processVoiceNote(
    {
      transcribeAudio,
      extractStructuredData,
      contactos: createContactosModule(pool),
      propiedades: createPropiedadesModule(pool),
      conversaciones: createConversacionesModule(pool),
      muestras: createMuestrasModule(pool),
      consultas: createConsultasModule(pool),
      ofertas: createOfertasModule(pool),
    },
    audioBuffer,
    `${voice.file_id}.oga`
  );

  await sendMessage(chatId, respuesta);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- webhook`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/telegram/webhook
git commit -m "feat: add Telegram webhook route wiring bot logic to HTTP"
```

---

## Task 11: Daily reminders cron route

**Files:**
- Create: `src/lib/bot/reminders.ts`
- Create: `src/app/api/cron/recordatorios/route.ts`
- Test: `src/lib/bot/reminders.test.ts`
- Test: `src/app/api/cron/recordatorios/route.test.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `findNecesitanSeguimiento` (Task 4), `sendMessage` (Task 7).
- Produces: `buildRecordatorioMessage(contactos): string` and the cron route that verifies
  `CRON_SECRET` and calls it daily.

- [ ] **Step 1: Write the failing reminders test**

`src/lib/bot/reminders.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildRecordatorioMessage } from "./reminders";
import type { Contacto } from "../domain/contactos";

function contacto(nombre: string): Contacto {
  return {
    id: "1",
    nombre,
    telefono: null,
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Buscando",
    temperatura: "Tibio",
    ultima_actividad: "2026-01-01",
    created_at: "2026-01-01",
  };
}

describe("buildRecordatorioMessage", () => {
  it("returns a friendly no-pending message when the list is empty", () => {
    expect(buildRecordatorioMessage([])).toMatch(/nadie|al día/i);
  });

  it("lists each contact needing follow-up", () => {
    const message = buildRecordatorioMessage([contacto("María Gómez"), contacto("Juan Pérez")]);
    expect(message).toContain("María Gómez");
    expect(message).toContain("Juan Pérez");
  });
});
```

- [ ] **Step 2: Write the failing cron route test**

`src/app/api/cron/recordatorios/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/domain/contactos", () => ({
  createContactosModule: vi.fn().mockReturnValue({
    findNecesitanSeguimiento: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock("@/lib/telegram/client", () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) }));

import { GET } from "./route";
import { sendMessage } from "@/lib/telegram/client";

function buildRequest(authHeader?: string) {
  return new NextRequest("https://example.com/api/cron/recordatorios", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/recordatorios", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cronsecret";
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
  });

  it("rejects requests without the correct bearer secret", async () => {
    const response = await GET(buildRequest("Bearer wrong"));
    expect(response.status).toBe(401);
  });

  it("sends the reminder message to the admin chat when authorized", async () => {
    const response = await GET(buildRequest("Bearer cronsecret"));
    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledWith(999, expect.any(String));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- reminders`
Expected: FAIL — neither file exists yet.

- [ ] **Step 4: Implement `reminders.ts`**

`src/lib/bot/reminders.ts`:

```typescript
import type { Contacto } from "../domain/contactos";

export function buildRecordatorioMessage(contactos: Contacto[]): string {
  if (contactos.length === 0) {
    return "Hoy no hay nadie pendiente de seguimiento — estás al día. 🎉";
  }
  const lista = contactos.map((c) => `- ${c.nombre} (${c.etapa})`).join("\n");
  return `Conviene seguir a estos contactos hoy:\n${lista}`;
}
```

- [ ] **Step 5: Implement the cron route**

`src/app/api/cron/recordatorios/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { createContactosModule } from "@/lib/domain/contactos";
import { sendMessage } from "@/lib/telegram/client";
import { buildRecordatorioMessage } from "@/lib/bot/reminders";

const DIAS_SIN_ACTIVIDAD = 5;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const contactos = createContactosModule(pool);
  const pendientes = await contactos.findNecesitanSeguimiento(DIAS_SIN_ACTIVIDAD);

  const adminChatId = Number(process.env.TELEGRAM_ADMIN_CHAT_ID);
  await sendMessage(adminChatId, buildRecordatorioMessage(pendientes));

  return NextResponse.json({ ok: true, cantidad: pendientes.length });
}
```

- [ ] **Step 6: Add Vercel Cron config**

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/recordatorios",
      "schedule": "0 12 * * *"
    }
  ]
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- reminders`
Expected: PASS (4 tests total across both files).

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/reminders.ts src/lib/bot/reminders.test.ts src/app/api/cron vercel.json
git commit -m "feat: add daily follow-up reminders via Vercel Cron"
```

---

## Task 12: Repository factory with in-memory fallback for local dev

**Files:**
- Create: `src/lib/domain/inMemoryStore.ts`
- Create: `src/lib/domain/seedData.ts`
- Create: `src/lib/domain/factory.ts`
- Test: `src/lib/domain/factory.test.ts`

**Interfaces:**
- Produces: `getDomainModules(): { contactos, propiedades, busquedas, conversaciones, muestras, consultas, ofertas }`
  — returns real Postgres-backed modules when `DATABASE_URL` is set, otherwise an in-memory
  implementation seeded with realistic fixtures. Dashboard pages (Tasks 13–14) call this and
  never import `getPool` directly.

- [ ] **Step 1: Write the failing test**

`src/lib/domain/factory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDomainModules } from "./factory";

describe("getDomainModules", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("returns seeded in-memory data when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const modules = getDomainModules();
    const contactos = await modules.contactos.list();
    expect(contactos.length).toBeGreaterThan(0);
  });

  it("returns the same in-memory instance across calls in one process", () => {
    delete process.env.DATABASE_URL;
    const first = getDomainModules();
    const second = getDomainModules();
    expect(first.contactos).toBe(second.contactos);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- factory`
Expected: FAIL — `./factory` doesn't exist yet.

- [ ] **Step 3: Implement the in-memory store**

`src/lib/domain/inMemoryStore.ts`:

```typescript
import { randomUUID } from "node:crypto";

export function createInMemoryTable<T extends { id: string }>(initial: T[] = []) {
  let rows: T[] = [...initial];

  return {
    async list(where?: Partial<T>): Promise<T[]> {
      if (!where) return [...rows];
      return rows.filter((row) =>
        Object.entries(where).every(([key, value]) => (row as any)[key] === value)
      );
    },
    async findById(id: string): Promise<T | null> {
      return rows.find((row) => row.id === id) ?? null;
    },
    async create(data: Omit<T, "id">): Promise<T> {
      const created = { ...data, id: randomUUID() } as T;
      rows = [...rows, created];
      return created;
    },
    async update(id: string, patch: Partial<Omit<T, "id">>): Promise<T | null> {
      const existing = rows.find((row) => row.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...patch } as T;
      rows = rows.map((row) => (row.id === id ? updated : row));
      return updated;
    },
  };
}
```

- [ ] **Step 4: Implement seed data**

`src/lib/domain/seedData.ts`:

```typescript
import type { Contacto } from "./contactos";
import type { Propiedad } from "./propiedades";

const now = new Date().toISOString();

export const CONTACTOS_SEED: Contacto[] = [
  {
    id: "seed-contacto-1",
    nombre: "María Gómez",
    telefono: "+54 351 555-0101",
    email: null,
    fuente: "Instagram",
    fecha_primer_contacto: now,
    tipo: "Comprador",
    etapa: "Mostrando propiedades",
    temperatura: "Caliente",
    ultima_actividad: now,
    created_at: now,
  },
  {
    id: "seed-contacto-2",
    nombre: "Carlos Ruiz",
    telefono: "+54 351 555-0102",
    email: null,
    fuente: "Referido",
    fecha_primer_contacto: now,
    tipo: "Propietario",
    etapa: "Negociando",
    temperatura: "Tibio",
    ultima_actividad: now,
    created_at: now,
  },
];

export const PROPIEDADES_SEED: Propiedad[] = [
  {
    id: "seed-propiedad-1",
    contacto_propietario_id: "seed-contacto-2",
    direccion: "Nueva Córdoba 500",
    tipo_propiedad: "Departamento",
    descripcion: "2 dormitorios, balcón",
    precio: 120000,
    fecha_recibida: now,
    condiciones: "Exclusividad 90 días",
    estado: "Activa",
    consultas_historicas: 6,
    visitas_historicas: 2,
    created_at: now,
  },
];
```

- [ ] **Step 5: Implement the factory**

`src/lib/domain/factory.ts`:

```typescript
import { getPool } from "../db/pool";
import { createContactosModule } from "./contactos";
import { createPropiedadesModule } from "./propiedades";
import { createBusquedasModule } from "./busquedas";
import { createConversacionesModule } from "./conversaciones";
import { createMuestrasModule } from "./muestras";
import { createConsultasModule } from "./consultas";
import { createOfertasModule } from "./ofertas";
import { createInMemoryTable } from "./inMemoryStore";
import { CONTACTOS_SEED, PROPIEDADES_SEED } from "./seedData";

export type DomainModules = {
  contactos: ReturnType<typeof createContactosModule>;
  propiedades: ReturnType<typeof createPropiedadesModule>;
  busquedas: ReturnType<typeof createBusquedasModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
  muestras: ReturnType<typeof createMuestrasModule>;
  consultas: ReturnType<typeof createConsultasModule>;
  ofertas: ReturnType<typeof createOfertasModule>;
};

let cachedInMemoryModules: DomainModules | undefined;

function buildInMemoryModules(): DomainModules {
  const contactosTable = createInMemoryTable(CONTACTOS_SEED);
  const propiedadesTable = createInMemoryTable(PROPIEDADES_SEED);
  const busquedasTable = createInMemoryTable([]);
  const conversacionesTable = createInMemoryTable([]);
  const muestrasTable = createInMemoryTable([]);
  const consultasTable = createInMemoryTable([]);
  const ofertasTable = createInMemoryTable([]);

  return {
    contactos: {
      ...contactosTable,
      findByNombreLike: async (nombre: string) =>
        (await contactosTable.list()).filter((c) =>
          c.nombre.toLowerCase().includes(nombre.toLowerCase())
        ),
      findNecesitanSeguimiento: async () => [],
      marcarActividad: async () => {},
    } as any,
    propiedades: {
      ...propiedadesTable,
      findByDireccionLike: async (direccion: string) =>
        (await propiedadesTable.list()).filter((p) =>
          p.direccion.toLowerCase().includes(direccion.toLowerCase())
        ),
      withTotales: async (propiedad: any) => ({
        ...propiedad,
        consultas_totales: propiedad.consultas_historicas,
        visitas_totales: propiedad.visitas_historicas,
      }),
    } as any,
    busquedas: {
      ...busquedasTable,
      findByContactoId: async (id: string) =>
        (await busquedasTable.list()).filter((b: any) => b.contacto_id === id),
    } as any,
    conversaciones: {
      ...conversacionesTable,
      findByContactoId: async (id: string) =>
        (await conversacionesTable.list()).filter((c: any) => c.contacto_id === id),
    } as any,
    muestras: {
      ...muestrasTable,
      findByContactoId: async (id: string) =>
        (await muestrasTable.list()).filter((m: any) => m.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await muestrasTable.list()).filter((m: any) => m.propiedad_id === id),
    } as any,
    consultas: {
      ...consultasTable,
      findByContactoId: async (id: string) =>
        (await consultasTable.list()).filter((c: any) => c.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await consultasTable.list()).filter((c: any) => c.propiedad_id === id),
    } as any,
    ofertas: {
      ...ofertasTable,
      findByContactoId: async (id: string) =>
        (await ofertasTable.list()).filter((o: any) => o.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await ofertasTable.list()).filter((o: any) => o.propiedad_id === id),
    } as any,
  };
}

export function getDomainModules(): DomainModules {
  if (!process.env.DATABASE_URL) {
    if (!cachedInMemoryModules) {
      cachedInMemoryModules = buildInMemoryModules();
    }
    return cachedInMemoryModules;
  }

  const pool = getPool();
  return {
    contactos: createContactosModule(pool),
    propiedades: createPropiedadesModule(pool),
    busquedas: createBusquedasModule(pool),
    conversaciones: createConversacionesModule(pool),
    muestras: createMuestrasModule(pool),
    consultas: createConsultasModule(pool),
    ofertas: createOfertasModule(pool),
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- factory`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/domain/inMemoryStore.ts src/lib/domain/seedData.ts src/lib/domain/factory.ts src/lib/domain/factory.test.ts
git commit -m "feat: add repository factory with seeded in-memory fallback for local dev"
```

---

## Task 13: Contact list and detail pages

**Files:**
- Create: `src/lib/view/contactFilters.ts`
- Test: `src/lib/view/contactFilters.test.ts`
- Create: `src/components/StageBadge.tsx`, `src/components/TemperatureBadge.tsx`
- Create: `src/app/contactos/page.tsx`
- Create: `src/app/contactos/[id]/page.tsx`

**Interfaces:**
- Consumes: `getDomainModules` (Task 12).
- Produces: `filterContactos(contactos, filters)`, `needsFollowUp(contacto, diasSinActividad)` —
  pure, tested logic used by the (untested-by-Vitest, manually browser-verified in Task 18)
  page components.

- [ ] **Step 1: Write the failing filter logic test**

`src/lib/view/contactFilters.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filterContactos, needsFollowUp } from "./contactFilters";
import type { Contacto } from "../domain/contactos";

function contacto(overrides: Partial<Contacto>): Contacto {
  return {
    id: "1",
    nombre: "Test",
    telefono: null,
    email: null,
    fuente: "Otro",
    fecha_primer_contacto: "2026-01-01",
    tipo: "Comprador",
    etapa: "Nuevo",
    temperatura: "Tibio",
    ultima_actividad: new Date().toISOString(),
    created_at: "2026-01-01",
    ...overrides,
  };
}

describe("filterContactos", () => {
  it("filters by tipo", () => {
    const contactos = [contacto({ tipo: "Comprador" }), contacto({ tipo: "Propietario" })];
    expect(filterContactos(contactos, { tipo: "Propietario" })).toHaveLength(1);
  });

  it("returns all contacts when no filters are given", () => {
    const contactos = [contacto({}), contacto({})];
    expect(filterContactos(contactos, {})).toHaveLength(2);
  });
});

describe("needsFollowUp", () => {
  it("is true for a stale, non-closed contact", () => {
    const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      needsFollowUp(contacto({ etapa: "Buscando", ultima_actividad: staleDate }), 5)
    ).toBe(true);
  });

  it("is false for a closed contact even if stale", () => {
    const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      needsFollowUp(contacto({ etapa: "Cerrado-ganado", ultima_actividad: staleDate }), 5)
    ).toBe(false);
  });

  it("is false for a fresh contact", () => {
    expect(needsFollowUp(contacto({ etapa: "Buscando" }), 5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- contactFilters`
Expected: FAIL — `./contactFilters` doesn't exist yet.

- [ ] **Step 3: Implement filter logic**

`src/lib/view/contactFilters.ts`:

```typescript
import type { Contacto } from "../domain/contactos";

export type ContactoFilters = {
  tipo?: Contacto["tipo"];
  etapa?: Contacto["etapa"];
  temperatura?: Contacto["temperatura"];
  zona?: string;
};

const ETAPAS_CERRADAS: Contacto["etapa"][] = ["Cerrado-ganado", "Cerrado-perdido", "Inactivo"];

export function filterContactos(contactos: Contacto[], filters: ContactoFilters): Contacto[] {
  return contactos.filter((contacto) => {
    if (filters.tipo && contacto.tipo !== filters.tipo) return false;
    if (filters.etapa && contacto.etapa !== filters.etapa) return false;
    if (filters.temperatura && contacto.temperatura !== filters.temperatura) return false;
    return true;
  });
}

export function needsFollowUp(contacto: Contacto, diasSinActividad: number): boolean {
  if (ETAPAS_CERRADAS.includes(contacto.etapa)) return false;
  const ultimaActividad = new Date(contacto.ultima_actividad).getTime();
  const limite = Date.now() - diasSinActividad * 24 * 60 * 60 * 1000;
  return ultimaActividad < limite;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- contactFilters`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement badge components**

`src/components/StageBadge.tsx`:

```tsx
import type { Contacto } from "@/lib/domain/contactos";

const STAGE_STYLES: Record<Contacto["etapa"], string> = {
  Nuevo: "bg-slate-100 text-slate-700",
  Calificando: "bg-blue-100 text-blue-700",
  Buscando: "bg-indigo-100 text-indigo-700",
  "Mostrando propiedades": "bg-purple-100 text-purple-700",
  Negociando: "bg-amber-100 text-amber-700",
  "Cerrado-ganado": "bg-green-100 text-green-700",
  "Cerrado-perdido": "bg-red-100 text-red-700",
  Inactivo: "bg-gray-100 text-gray-500",
};

export function StageBadge({ etapa }: { etapa: Contacto["etapa"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_STYLES[etapa]}`}>
      {etapa}
    </span>
  );
}
```

`src/components/TemperatureBadge.tsx`:

```tsx
import type { Contacto } from "@/lib/domain/contactos";

const TEMP_STYLES: Record<Contacto["temperatura"], string> = {
  Frio: "bg-sky-100 text-sky-700",
  Tibio: "bg-orange-100 text-orange-700",
  Caliente: "bg-rose-100 text-rose-700",
};

const TEMP_ICONS: Record<Contacto["temperatura"], string> = {
  Frio: "❄️",
  Tibio: "🌤️",
  Caliente: "🔥",
};

export function TemperatureBadge({ temperatura }: { temperatura: Contacto["temperatura"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TEMP_STYLES[temperatura]}`}>
      {TEMP_ICONS[temperatura]} {temperatura}
    </span>
  );
}
```

- [ ] **Step 6: Implement the contact list page**

`src/app/contactos/page.tsx`:

```tsx
import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";
import { filterContactos, needsFollowUp, type ContactoFilters } from "@/lib/view/contactFilters";
import { StageBadge } from "@/components/StageBadge";
import { TemperatureBadge } from "@/components/TemperatureBadge";

const DIAS_SIN_ACTIVIDAD = 5;

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<ContactoFilters>;
}) {
  const filters = await searchParams;
  const { contactos } = getDomainModules();
  const todos = await contactos.list();
  const filtrados = filterContactos(todos, filters);
  const ordenados = [...filtrados].sort((a, b) => {
    const aNecesita = needsFollowUp(a, DIAS_SIN_ACTIVIDAD);
    const bNecesita = needsFollowUp(b, DIAS_SIN_ACTIVIDAD);
    return aNecesita === bNecesita ? 0 : aNecesita ? -1 : 1;
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Contactos</h1>
      <ul className="space-y-2">
        {ordenados.map((contacto) => (
          <li key={contacto.id}>
            <Link
              href={`/contactos/${contacto.id}`}
              className={`block rounded-lg border p-3 transition hover:border-slate-400 ${
                needsFollowUp(contacto, DIAS_SIN_ACTIVIDAD)
                  ? "border-amber-400 bg-amber-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{contacto.nombre}</span>
                <span className="text-xs text-slate-500">{contacto.tipo}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <StageBadge etapa={contacto.etapa} />
                <TemperatureBadge temperatura={contacto.temperatura} />
              </div>
            </Link>
          </li>
        ))}
        {ordenados.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-500">
            No hay contactos con esos filtros.
          </li>
        )}
      </ul>
    </main>
  );
}
```

- [ ] **Step 7: Implement the contact detail page**

`src/app/contactos/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { StageBadge } from "@/components/StageBadge";
import { TemperatureBadge } from "@/components/TemperatureBadge";

export default async function ContactoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { contactos, busquedas, propiedades, conversaciones, muestras, ofertas } =
    getDomainModules();

  const contacto = await contactos.findById(id);
  if (!contacto) notFound();

  const [busquedasDelContacto, conversacionesDelContacto, muestrasDelContacto, ofertasDelContacto, propiedadesEnCartera] =
    await Promise.all([
      busquedas.findByContactoId(id),
      conversaciones.findByContactoId(id),
      muestras.findByContactoId(id),
      ofertas.findByContactoId(id),
      propiedades.list({ contacto_propietario_id: id } as any),
    ]);

  const timeline = [
    ...conversacionesDelContacto.map((c: any) => ({ tipo: "Conversación", fecha: c.fecha, detalle: c.resumen })),
    ...muestrasDelContacto.map((m: any) => ({ tipo: "Muestra", fecha: m.fecha, detalle: m.feedback })),
    ...ofertasDelContacto.map((o: any) => ({ tipo: "Oferta", fecha: o.fecha, detalle: `$${o.monto} (${o.estado})` })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold text-slate-900">{contacto.nombre}</h1>
      <div className="mt-2 flex gap-2">
        <StageBadge etapa={contacto.etapa} />
        <TemperatureBadge temperatura={contacto.temperatura} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <dt>Teléfono</dt>
        <dd>{contacto.telefono ?? "—"}</dd>
        <dt>Fuente</dt>
        <dd>{contacto.fuente}</dd>
        <dt>Tipo</dt>
        <dd>{contacto.tipo}</dd>
      </dl>

      {busquedasDelContacto.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">Búsqueda activa</h2>
          {busquedasDelContacto.map((b: any) => (
            <p key={b.id} className="mt-1 text-sm text-slate-600">
              {b.tipo_operacion} · {b.tipo_propiedad} · {b.zona} · hasta ${b.presupuesto}
            </p>
          ))}
        </section>
      )}

      {propiedadesEnCartera.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">Propiedades en cartera</h2>
          {propiedadesEnCartera.map((p: any) => (
            <p key={p.id} className="mt-1 text-sm text-slate-600">
              {p.direccion} · ${p.precio} · {p.estado}
            </p>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Línea de tiempo</h2>
        <ul className="mt-2 space-y-2">
          {timeline.map((evento, index) => (
            <li key={index} className="rounded border border-slate-200 p-2 text-sm">
              <span className="font-medium">{evento.tipo}</span> —{" "}
              {new Date(evento.fecha).toLocaleDateString("es-AR")}
              <p className="text-slate-600">{evento.detalle}</p>
            </li>
          ))}
          {timeline.length === 0 && (
            <li className="text-sm text-slate-500">Todavía no hay actividad registrada.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/view/contactFilters.ts src/lib/view/contactFilters.test.ts src/components/StageBadge.tsx src/components/TemperatureBadge.tsx src/app/contactos
git commit -m "feat: add contact list and detail dashboard pages"
```

---

## Task 14: Property list and detail pages

**Files:**
- Create: `src/app/propiedades/page.tsx`
- Create: `src/app/propiedades/[id]/page.tsx`

**Interfaces:**
- Consumes: `getDomainModules`, `withTotales` (Task 12, Task 4).

- [ ] **Step 1: Implement the property list page**

`src/app/propiedades/page.tsx`:

```tsx
import Link from "next/link";
import { getDomainModules } from "@/lib/domain/factory";

export default async function PropiedadesPage() {
  const { propiedades } = getDomainModules();
  const todas = await propiedades.list();
  const conTotales = await Promise.all(todas.map((p: any) => propiedades.withTotales(p)));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Propiedades</h1>
      <ul className="space-y-2">
        {conTotales.map((propiedad: any) => (
          <li key={propiedad.id}>
            <Link
              href={`/propiedades/${propiedad.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{propiedad.direccion}</span>
                <span className="text-xs text-slate-500">{propiedad.estado}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                ${propiedad.precio ?? "—"} · {propiedad.consultas_totales} consultas ·{" "}
                {propiedad.visitas_totales} visitas
              </p>
            </Link>
          </li>
        ))}
        {conTotales.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-500">
            Todavía no hay propiedades cargadas.
          </li>
        )}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Implement the property detail page**

`src/app/propiedades/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";

export default async function PropiedadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { propiedades, contactos, consultas, muestras, ofertas } = getDomainModules();

  const propiedad = await propiedades.findById(id);
  if (!propiedad) notFound();

  const [conTotales, propietario, consultasDeLaPropiedad, muestrasDeLaPropiedad, ofertasDeLaPropiedad] =
    await Promise.all([
      propiedades.withTotales(propiedad),
      propiedad.contacto_propietario_id
        ? contactos.findById(propiedad.contacto_propietario_id)
        : Promise.resolve(null),
      consultas.findByPropiedadId(id),
      muestras.findByPropiedadId(id),
      ofertas.findByPropiedadId(id),
    ]);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold text-slate-900">{propiedad.direccion}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {propiedad.tipo_propiedad} · ${propiedad.precio ?? "—"} · {propiedad.estado}
      </p>
      {propietario && (
        <p className="mt-2 text-sm text-slate-600">
          Propietario: <span className="font-medium">{propietario.nombre}</span>
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <dt>Consultas totales</dt>
        <dd>{conTotales.consultas_totales}</dd>
        <dt>Visitas totales</dt>
        <dd>{conTotales.visitas_totales}</dd>
        <dt>Ofertas</dt>
        <dd>{ofertasDeLaPropiedad.length}</dd>
      </dl>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Historial de muestras</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {muestrasDeLaPropiedad.map((m: any) => (
            <li key={m.id}>
              {new Date(m.fecha).toLocaleDateString("es-AR")} — {m.feedback ?? "sin feedback"} (
              {m.interes_resultante ?? "sin definir"})
            </li>
          ))}
          {muestrasDeLaPropiedad.length === 0 && <li>Todavía no se mostró a nadie.</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Ofertas recibidas</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {ofertasDeLaPropiedad.map((o: any) => (
            <li key={o.id}>
              ${o.monto} — {o.estado} ({new Date(o.fecha).toLocaleDateString("es-AR")})
            </li>
          ))}
          {ofertasDeLaPropiedad.length === 0 && <li>Todavía no hay ofertas.</li>}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/propiedades
git commit -m "feat: add property list and detail dashboard pages"
```

---

## Task 15: Dashboard authentication + security pass

**Files:**
- Create: `src/proxy.ts`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Produces: HTTP Basic Auth gate over every route except `/api/telegram/webhook` and
  `/api/cron/recordatorios` (which use their own secret checks from Tasks 10–11).

> **Note:** This Next.js version renamed the `middleware.ts` file convention to `proxy.ts`
> (function `middleware` → `proxy`) — confirmed against
> `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` before
> writing this task. Do not create a `middleware.ts` file; it is deprecated in this version.

- [ ] **Step 1: Write the failing test**

`src/proxy.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("dashboard auth proxy", () => {
  beforeEach(() => {
    process.env.DASHBOARD_USER = "brunella";
    process.env.DASHBOARD_PASSWORD = "supersecret";
  });

  it("skips auth for the Telegram webhook route", () => {
    const request = new NextRequest("https://example.com/api/telegram/webhook");
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("skips auth for the cron route", () => {
    const request = new NextRequest("https://example.com/api/cron/recordatorios");
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("rejects dashboard requests without credentials", () => {
    const request = new NextRequest("https://example.com/contactos");
    const response = proxy(request);
    expect(response.status).toBe(401);
  });

  it("accepts dashboard requests with correct Basic Auth credentials", () => {
    const encoded = Buffer.from("brunella:supersecret").toString("base64");
    const request = new NextRequest("https://example.com/contactos", {
      headers: { authorization: `Basic ${encoded}` },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("rejects dashboard requests with wrong credentials", () => {
    const encoded = Buffer.from("brunella:wrongpassword").toString("base64");
    const request = new NextRequest("https://example.com/contactos", {
      headers: { authorization: `Basic ${encoded}` },
    });
    const response = proxy(request);
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- proxy`
Expected: FAIL — `./proxy` doesn't exist yet.

- [ ] **Step 3: Implement the proxy**

`src/proxy.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/api/telegram/webhook", "/api/cron/recordatorios"];

export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const [user, password] = decoded.split(":");
    if (user === expectedUser && password === expectedPassword) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Segundo Cerebro"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- proxy`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts
git commit -m "feat: gate the dashboard behind HTTP Basic Auth via proxy.ts"
```

---

## Task 16: Excel import script

**Files:**
- Create: `scripts/import-excel.ts`
- Create: `scripts/fixtures/propiedades-ejemplo.xlsx` (generated by the test, not hand-authored)
- Test: `scripts/import-excel.test.ts`

**Interfaces:**
- Produces: a CLI script `npm run import:excel -- <path-to-excel> <owner-contacto-id-or-empty>`
  that inserts rows into `propiedades` with historical baselines. Column names are provisional
  (`fecha`, `tipo`, `descripcion`, `precio`, `consultas`, `visitas`) — **must be confirmed
  against Brunella's real file before running for real** (flagged in Task 17's README).

- [ ] **Step 1: Add the `xlsx` dependency**

```bash
npm install xlsx
```

- [ ] **Step 2: Write the failing test with a generated fixture workbook**

`scripts/import-excel.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import * as XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";
import { parsePropiedadesFromExcel } from "./import-excel";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "propiedades-ejemplo.xlsx");

beforeAll(() => {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  const worksheet = XLSX.utils.json_to_sheet([
    {
      fecha: "2026-01-15",
      tipo: "Departamento",
      descripcion: "2 dormitorios, luminoso",
      precio: 95000,
      consultas: 4,
      visitas: 1,
    },
    {
      fecha: "2026-02-01",
      tipo: "Casa",
      descripcion: "Con patio",
      precio: 150000,
      consultas: 2,
      visitas: 0,
    },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Propiedades");
  XLSX.writeFile(workbook, FIXTURE_PATH);
});

describe("parsePropiedadesFromExcel", () => {
  it("parses each row into a Propiedad-shaped insert payload", () => {
    const rows = parsePropiedadesFromExcel(FIXTURE_PATH);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tipo_propiedad: "Departamento",
      descripcion: "2 dormitorios, luminoso",
      precio: 95000,
      consultas_historicas: 4,
      visitas_historicas: 1,
    });
    expect(rows[0].direccion).toBeTruthy();
    expect(rows[1].tipo_propiedad).toBe("Casa");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- import-excel`
Expected: FAIL — `./import-excel` doesn't exist yet.

- [ ] **Step 4: Implement the import script**

`scripts/import-excel.ts`:

```typescript
import * as XLSX from "xlsx";
import { Pool } from "pg";

type FilaExcel = {
  fecha?: string;
  direccion?: string;
  tipo?: string;
  descripcion?: string;
  precio?: number;
  consultas?: number;
  visitas?: number;
};

export type PropiedadInsert = {
  direccion: string;
  tipo_propiedad: string;
  descripcion: string | null;
  precio: number | null;
  fecha_recibida: string;
  consultas_historicas: number;
  visitas_historicas: number;
  contacto_propietario_id: string | null;
};

const TIPOS_VALIDOS = ["Departamento", "Casa", "Lote", "Local/Oficina"];

export function parsePropiedadesFromExcel(
  filePath: string,
  contactoPropietarioId: string | null = null
): PropiedadInsert[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<FilaExcel>(workbook.Sheets[sheetName]);

  return rows.map((row, index) => {
    const tipo = TIPOS_VALIDOS.includes(row.tipo ?? "") ? (row.tipo as string) : "Departamento";
    return {
      direccion: row.direccion ?? `Propiedad importada #${index + 1} (confirmar dirección real)`,
      tipo_propiedad: tipo,
      descripcion: row.descripcion ?? null,
      precio: row.precio ?? null,
      fecha_recibida: row.fecha ?? new Date().toISOString().slice(0, 10),
      consultas_historicas: row.consultas ?? 0,
      visitas_historicas: row.visitas ?? 0,
      contacto_propietario_id: contactoPropietarioId,
    };
  });
}

async function main() {
  const [, , filePath, contactoPropietarioId] = process.argv;
  if (!filePath) {
    console.error("Uso: npm run import:excel -- <ruta-al-excel> [contacto-propietario-id]");
    process.exit(1);
  }

  const propiedades = parsePropiedadesFromExcel(filePath, contactoPropietarioId ?? null);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  for (const propiedad of propiedades) {
    await pool.query(
      `insert into propiedades
       (direccion, tipo_propiedad, descripcion, precio, fecha_recibida, consultas_historicas, visitas_historicas, contacto_propietario_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        propiedad.direccion,
        propiedad.tipo_propiedad,
        propiedad.descripcion,
        propiedad.precio,
        propiedad.fecha_recibida,
        propiedad.consultas_historicas,
        propiedad.visitas_historicas,
        propiedad.contacto_propietario_id,
      ]
    );
  }

  console.log(`Importadas ${propiedades.length} propiedades.`);
  await pool.end();
}

if (require.main === module) {
  main();
}
```

- [ ] **Step 5: Add the npm script**

Add to `package.json` `"scripts"`:

```json
"import:excel": "tsx scripts/import-excel.ts"
```

```bash
npm install -D tsx
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- import-excel`
Expected: PASS (1 test).

- [ ] **Step 7: Add the fixture directory to `.gitignore`-exempt tracked test assets**

Confirm `scripts/fixtures/propiedades-ejemplo.xlsx` is committed (it's a small generated test
fixture, not a secret) so the test is reproducible without regenerating it — actually the
`beforeAll` regenerates it every run, so add the fixtures directory to `.gitignore` instead:

`.gitignore` (append):

```
scripts/fixtures/
```

- [ ] **Step 8: Commit**

```bash
git add scripts/import-excel.ts scripts/import-excel.test.ts package.json package-lock.json .gitignore
git commit -m "feat: add Excel import script for historical property data"
```

---

## Task 17: Setup documentation

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: the single reference doc listing every manual step a human must do (accounts,
  tokens, deploy, Excel file) — this is the checklist the final "you're up" message points to.

- [ ] **Step 1: Write the README**

`README.md`:

```markdown
# Segundo Cerebro — Brunella Real Estate

CRM interno: bot de Telegram por nota de voz + dashboard web. Ver
`docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md` para el diseño completo.

## Desarrollo local (no requiere ninguna cuenta)

```bash
npm install
npm test
npm run dev
```

Sin `DATABASE_URL` configurado, la app corre con datos de ejemplo en memoria — anda a
`http://localhost:3000/contactos` y `http://localhost:3000/propiedades` para verla funcionando.

## Puesta en producción — pasos manuales pendientes

1. **Supabase (base de datos gratis)**
   - Crear cuenta en supabase.com y un proyecto nuevo.
   - Project Settings → Database → Connection string → copiar la "URI" (modo *Session*, puerto
     5432) → pegarla como `DATABASE_URL`.
   - Ejecutar `supabase/migrations/0001_schema.sql` contra ese proyecto (SQL Editor de Supabase,
     pegar y correr el archivo entero).

2. **Groq (transcripción + IA, capa gratuita)**
   - Crear cuenta en console.groq.com → API Keys → generar una → pegarla como `GROQ_API_KEY`.

3. **Telegram (bot de carga por voz)**
   - Desde la cuenta de Telegram de Brunella, hablarle a `@BotFather` → `/newbot` → seguir los
     pasos → copiar el token → pegarlo como `TELEGRAM_BOT_TOKEN`.
   - Generar cualquier string al azar como `TELEGRAM_WEBHOOK_SECRET` (ej. con
     `openssl rand -hex 20`).
   - Obtener el `chat_id` de Brunella (mandarle un mensaje al bot y consultar
     `https://api.telegram.org/bot<TOKEN>/getUpdates`) → pegarlo como `TELEGRAM_ADMIN_CHAT_ID`.
   - Una vez desplegado en Vercel (paso 5), registrar el webhook:
     ```bash
     curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
       -d "url=https://<tu-dominio>.vercel.app/api/telegram/webhook" \
       -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
     ```

4. **Autenticación del dashboard**
   - Elegir un usuario/contraseña y setearlos como `DASHBOARD_USER` / `DASHBOARD_PASSWORD`.

5. **Vercel (hosting gratis + cron diario)**
   - Crear cuenta en vercel.com, importar este repo.
   - Cargar todas las variables de entorno de `.env.example` en Project Settings → Environment
     Variables.
   - Generar un string al azar como `CRON_SECRET` (Vercel lo agrega automáticamente como
     `Authorization: Bearer <CRON_SECRET>` en las llamadas a rutas de cron — confirmar que
     coincide con el valor cargado).
   - Deploy.

6. **Excel histórico de propiedades**
   - Conseguir el archivo real de Brunella.
   - Confirmar los nombres de columna reales contra los que asume
     `scripts/import-excel.ts` (`fecha`, `direccion`, `tipo`, `descripcion`, `precio`,
     `consultas`, `visitas`) y ajustar el mapeo si difieren.
   - Correr: `npm run import:excel -- /ruta/al/archivo.xlsx`

## Fases futuras (no incluidas acá)

- **Fase 2:** bot de búsqueda/filtrado de propiedades en portales (Zonaprop, Grupo Banker,
  Tokko) usando las Búsquedas ya cargadas.
- **Fase 3:** panel de métricas de redes (Meta Business) para uso propio de Brunella.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup and deployment README"
```

---

## Task 18: Full test suite, coverage, and static checks

**Files:**
- Modify: none (verification task)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests across all files PASS.

- [ ] **Step 2: Run coverage and confirm ≥80% on business logic**

Run: `npm run test:coverage`
Expected: `src/lib/**` (excluding Next.js page/layout files, already excluded in
`vitest.config.ts`) at or above 80% line coverage. If any file is below, add the missing test
cases for its untested branches before moving on.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit any fixes made in this task**

```bash
git add -A
git commit -m "test: close coverage gaps found in full-suite verification"
```

(Skip the commit if step 1–3 required no changes.)

---

## Task 19: Code review and security review pass

- [ ] **Step 1:** Dispatch the `code-reviewer` agent against the full diff (`git diff
  <first-commit-hash>...HEAD` or the whole `src/`, `scripts/`, `supabase/` trees) for general
  code quality, dead code, and adherence to the file/function-size limits in the Global
  Constraints section.
- [ ] **Step 2:** Dispatch the `security-reviewer` agent specifically against
  `src/app/api/telegram/webhook/route.ts`, `src/app/api/cron/recordatorios/route.ts`,
  `src/proxy.ts`, and `scripts/import-excel.ts` (the only places handling external input,
  secrets, or a raw DB connection string).
- [ ] **Step 3:** Fix every CRITICAL and HIGH finding from both reviews. Re-run `npm test` after
  each fix.
- [ ] **Step 4:** Commit fixes.

```bash
git add -A
git commit -m "fix: address code review and security review findings"
```

---

## Task 20: UI/UX verification in the browser

- [ ] **Step 1:** Run `npm run dev` (no `DATABASE_URL` needed — seeded in-memory data from Task
  12 powers the screens).
- [ ] **Step 2:** Open `/contactos` in the Browser pane at desktop width (1280px) and mobile
  width (375px, since Brunella will mostly use this from her phone). Verify: list renders,
  stage/temperature badges are legible, the seeded stale contact (if any) is highlighted,
  no horizontal overflow at 375px.
- [ ] **Step 3:** Click into a contact detail page. Verify: timeline renders in reverse
  chronological order, empty states ("Todavía no hay actividad registrada.") show correctly
  for contacts with no history.
- [ ] **Step 4:** Open `/propiedades` and a property detail page at both widths. Verify:
  consultas/visitas/ofertas totals display, empty states render for a property with no
  history.
- [ ] **Step 5:** Verify the Basic Auth gate: open any page without credentials and confirm a
  401 challenge appears; confirm the browser's native credential prompt lets the seeded
  `DASHBOARD_USER`/`DASHBOARD_PASSWORD` (from `.env.local`, set to any placeholder value for
  this manual check) through.
- [ ] **Step 6:** Fix any layout, contrast, or overflow issue found. Re-check in the browser
  after each fix.
- [ ] **Step 7:** Commit fixes.

```bash
git add -A
git commit -m "fix: address UI/UX issues found in manual browser verification"
```

---

## Self-Review Notes (completed while writing this plan)

- **Spec coverage:** every entity (Contacto, Busqueda, Propiedad, Consulta, Conversacion,
  Muestra, Oferta), the bot flow (transcribe → extract → match → persist → confirm,
  ambiguity handling, low-confidence handling), reminders, dashboard views, and the Excel
  migration from the spec each map to a task above (2, 4, 5, 6–9, 11, 13–14, 16). Fase 2 and
  Fase 3 are explicitly out of scope per the spec and not tasked here.
- **Placeholder scan:** no TBD/TODO markers; the one "provisional" note (Excel column names in
  Task 16) is an explicit, named exception requiring a real file the human must supply — not a
  vague placeholder.
- **Type consistency:** `Contacto`, `Propiedad`, `Busqueda`, `Conversacion`, `Muestra`,
  `Consulta`, `Oferta` field names are identical across Tasks 2, 4, 5, 8, 9, 12, 13, 14.
  `ProcessVoiceNoteDeps` (Task 9) matches exactly what Task 10's webhook route constructs.
  `getDomainModules()`'s return shape (Task 12) matches what Tasks 13–14's pages destructure.
