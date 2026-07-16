# Fase 2 — Intake Automatizado de Clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate client-side intake — auto-reply to Instagram/Facebook DMs with a link to a
self-service form, capture ad attribution, confirm the client via WhatsApp, match their search
against Brunella's own property portfolio, and let her approve-and-send the compatibility
document to the client over WhatsApp.

**Architecture:** Two new Meta webhooks (Messenger+Instagram combined; WhatsApp Cloud API) sit
alongside the existing Telegram webhook. A new public form (inside the same Next.js app)
creates/updates `Contacto` + `Busqueda`/`Propiedad` rows using the same Server Action + Zod
pattern as the rest of the dashboard. A deterministic matching engine compares an active
`Busqueda` against `propiedades`, and a Telegram message (photos + text + inline button) lets
Brunella approve sending the result to the client over WhatsApp.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Zod, `pg` against
Supabase Postgres (in-memory fallback for local dev), Vitest, Meta Graph API (Messenger,
Instagram Messaging, WhatsApp Cloud API) called via `fetch` — no new npm dependencies.

## Global Constraints

- No new npm dependencies — everything is built with `fetch` against Graph API, same as the
  existing Telegram client.
- Every new webhook must verify its signature/secret before doing any work, same posture as
  the existing Telegram webhook (`verifyWebhookSecret`) — see
  [2026-07-15-fase2-intake-clientes-design.md](../specs/2026-07-15-fase2-intake-clientes-design.md).
- All new/changed domain types must have an in-memory fallback in `src/lib/domain/factory.ts`
  so `npm run dev` keeps working with zero external credentials, same as Fase 1.
- No PDF generation — the "compatibility document" is a Telegram message (photos + text),
  forwarded as text + image messages over WhatsApp.
- No live scraping/API calls to Tokko/Adinco/Zonaprop — matching only reads `propiedades`.
- Migrations are additive only — never rewrite `0001_schema.sql` or `0002_...sql`.
- Spanish user-facing strings, English code identifiers — matches the whole existing codebase.
- Follow existing patterns exactly: generic `createRepository<T>` for CRUD, Zod schemas in
  `src/lib/view/*.ts`, Server Actions in `actions.ts` next to their `page.tsx`.

---

### Task 1: Migration 0003 + domain type updates

**Files:**
- Create: `supabase/migrations/0003_fase2_intake.sql`
- Modify: `src/lib/domain/propiedades.ts`
- Modify: `src/lib/domain/busquedas.ts`
- Modify: `src/lib/domain/consultas.ts`
- Modify: `src/lib/domain/contactos.ts`
- Modify: `src/lib/db/testDb.ts` (already loads all migrations in `supabase/migrations/`
  dynamically — no change needed, just confirm it still works)
- Test: `src/lib/db/schema.test.ts`

**Interfaces:**
- Produces: `Propiedad.moneda`, `Propiedad.codigo`, `Propiedad.dormitorios`,
  `Busqueda.moneda`, `Busqueda.presupuesto_min`, `Busqueda.presupuesto_max`,
  `Busqueda.documento_aprobado`, `Busqueda.documento_enviado`,
  `Contacto.whatsapp_confirmado`, `Consulta.origen` including `'formulario_cliente'`. All
  later tasks read/write these exact field names.

- [ ] **Step 1: Write the migration**

```sql
-- Fase 2: client-facing intake form needs currency-aware budgets, a short referral code per
-- property (pasted into Meta ad `ref` params), bedroom count for matching, and the
-- approve/confirm bookkeeping the WhatsApp hand-off depends on.

alter table propiedades add column moneda text check (moneda in ('ARS','USD'));
alter table propiedades add column codigo text unique;
alter table propiedades add column dormitorios integer;
alter table propiedades drop constraint propiedades_tipo_propiedad_check;
alter table propiedades add constraint propiedades_tipo_propiedad_check
  check (tipo_propiedad in ('Departamento','Casa','PH','Lote','Local/Oficina'));

alter table busquedas add column moneda text check (moneda in ('ARS','USD'));
alter table busquedas add column presupuesto_min numeric;
alter table busquedas add column presupuesto_max numeric;
alter table busquedas add column documento_aprobado boolean not null default false;
alter table busquedas add column documento_enviado boolean not null default false;
alter table busquedas drop column presupuesto;
alter table busquedas drop constraint busquedas_tipo_propiedad_check;
alter table busquedas add constraint busquedas_tipo_propiedad_check
  check (tipo_propiedad in ('Departamento','Casa','PH','Lote','Local/Oficina'));

alter table contactos add column whatsapp_confirmado boolean not null default false;

alter table consultas drop constraint consultas_origen_check;
alter table consultas add constraint consultas_origen_check
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
```

- [ ] **Step 2: Update the `Propiedad` type**

In `src/lib/domain/propiedades.ts`, update the type:

```typescript
export type Propiedad = {
  id: string;
  contacto_propietario_id: string | null;
  direccion: string;
  tipo_propiedad: "Departamento" | "Casa" | "PH" | "Lote" | "Local/Oficina";
  descripcion: string | null;
  precio: number | null;
  moneda: "ARS" | "USD" | null;
  codigo: string | null;
  dormitorios: number | null;
  fecha_recibida: string;
  condiciones: string | null;
  estado: "Activa" | "Vendida" | "Retirada";
  consultas_historicas: number;
  visitas_historicas: number;
  imagenes: string | null;
  created_at: string;
};
```

(Leave the rest of the file — `findByDireccionLike`, `withTotales` — unchanged.)

- [ ] **Step 3: Update the `Busqueda` type**

Replace the full type in `src/lib/domain/busquedas.ts`:

```typescript
export type Busqueda = {
  id: string;
  contacto_id: string;
  tipo_operacion: "Compra" | "Alquiler" | "Inversion";
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: "ARS" | "USD" | null;
  zona: string | null;
  tipo_propiedad: "Departamento" | "Casa" | "PH" | "Lote" | "Local/Oficina" | null;
  dormitorios: number | null;
  otros_requisitos: string | null;
  activa: boolean;
  documento_aprobado: boolean;
  documento_enviado: boolean;
  created_at: string;
};
```

- [ ] **Step 4: Update `Consulta.origen` and add `Contacto.whatsapp_confirmado`**

In `src/lib/domain/consultas.ts`, find the `Consulta` type's `origen` field and widen it to
`"nota_de_voz" | "manual" | "formulario_cliente"`.

In `src/lib/domain/contactos.ts`, add `whatsapp_confirmado: boolean;` to the `Contacto` type,
and add these two methods inside `createContactosModule`, alongside the existing ones:

```typescript
    async findByTelefono(telefono: string): Promise<Contacto | null> {
      const normalizado = telefono.replace(/\D/g, "");
      const todos = await this.list();
      return todos.find((c) => c.telefono?.replace(/\D/g, "") === normalizado) ?? null;
    },

    async marcarWhatsappConfirmado(contactoId: string): Promise<void> {
      await pool.query(
        "update contactos set whatsapp_confirmado = true where id = $1",
        [contactoId]
      );
    },
```

- [ ] **Step 5: Update the schema test**

Open `src/lib/db/schema.test.ts` and add a test confirming the new columns exist and the
`leads_pendientes` table works, following the existing style (see the "0002 migration" test
already in that file for the pattern):

```typescript
  it("supports Fase 2 fields on propiedades/busquedas/contactos and leads_pendientes (0003 migration)", async () => {
    const db = await loadTestDb();

    const contacto = await db.query(
      `insert into contactos (nombre, tipo) values ('Test Fase2', 'Comprador') returning id`
    );
    const contactoId = contacto.rows[0].id;

    const propiedad = await db.query(
      `insert into propiedades (direccion, tipo_propiedad, moneda, codigo, dormitorios)
       values ('Test 123', 'PH', 'USD', 'COD-TEST', 2) returning *`
    );
    expect(propiedad.rows[0].moneda).toBe("USD");
    expect(propiedad.rows[0].codigo).toBe("COD-TEST");
    expect(propiedad.rows[0].dormitorios).toBe(2);

    const busqueda = await db.query(
      `insert into busquedas (contacto_id, tipo_operacion, presupuesto_min, presupuesto_max, moneda, tipo_propiedad)
       values ($1, 'Compra', 50000, 80000, 'USD', 'PH') returning *`,
      [contactoId]
    );
    expect(busqueda.rows[0].presupuesto_min).toBe("50000");
    expect(busqueda.rows[0].documento_aprobado).toBe(false);
    expect(busqueda.rows[0].documento_enviado).toBe(false);

    await db.query("update contactos set whatsapp_confirmado = true where id = $1", [
      contactoId,
    ]);
    const confirmado = await db.query("select whatsapp_confirmado from contactos where id = $1", [
      contactoId,
    ]);
    expect(confirmado.rows[0].whatsapp_confirmado).toBe(true);

    const consulta = await db.query(
      `insert into consultas (propiedad_id, contacto_id, canal, origen)
       values ($1, $2, 'Instagram', 'formulario_cliente') returning *`,
      [propiedad.rows[0].id, contactoId]
    );
    expect(consulta.rows[0].origen).toBe("formulario_cliente");

    const lead = await db.query(
      `insert into leads_pendientes (token, canal, psid, codigo_propiedad)
       values ('tok-123', 'Instagram', 'psid-abc', 'COD-TEST') returning *`
    );
    expect(lead.rows[0].usado).toBe(false);

    await db.end();
  });
```

- [ ] **Step 6: Run the schema test**

Run: `cd brunella-crm && npm test -- schema.test.ts`
Expected: all tests pass, including the new one. If pg-mem rejects the `alter table ... drop
constraint` syntax, fall back to dropping and recreating the whole table constraint set in the
migration using `alter table ... add constraint ... check (...) not valid` — check the actual
pg-mem error message first before changing anything.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_fase2_intake.sql src/lib/domain/propiedades.ts src/lib/domain/busquedas.ts src/lib/domain/consultas.ts src/lib/domain/contactos.ts src/lib/db/schema.test.ts
git commit -m "feat: add Fase 2 data model (moneda, codigo, dormitorios, confirmation/approval flags)"
```

---

### Task 2: Código corto generation

**Files:**
- Create: `src/lib/domain/codigoPropiedad.ts`
- Test: `src/lib/domain/codigoPropiedad.test.ts`
- Modify: `src/app/propiedades/[id]/page.tsx` (show the code + "Generar código" button)
- Modify: `src/app/propiedades/[id]/editar/actions.ts` (add a `generarCodigoAction`)

**Interfaces:**
- Produces: `generateCodigoPropiedad(): string`, used by Task 8 (Propietario form action)
  and this task's own "generate on demand" button for existing properties.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { generateCodigoPropiedad } from "./codigoPropiedad";

describe("generateCodigoPropiedad", () => {
  it("returns a short code in the COD-XXXX format", () => {
    const codigo = generateCodigoPropiedad();
    expect(codigo).toMatch(/^COD-[A-F0-9]{4}$/);
  });

  it("returns a different code on each call", () => {
    const a = generateCodigoPropiedad();
    const b = generateCodigoPropiedad();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- codigoPropiedad.test.ts`
Expected: FAIL — `codigoPropiedad.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
import { randomBytes } from "node:crypto";

export function generateCodigoPropiedad(): string {
  const hex = randomBytes(2).toString("hex").toUpperCase();
  return `COD-${hex}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- codigoPropiedad.test.ts`
Expected: PASS

- [ ] **Step 5: Add a "Generar código" button to the property detail page**

In `src/app/propiedades/[id]/page.tsx`, find where `propiedad` fields are rendered and add,
near the `direccion`/`estado` block:

```tsx
        <p className="mt-1 text-sm text-slate-600">
          Código de anuncio:{" "}
          {propiedad.codigo ?? (
            <form action={generarCodigoAction.bind(null, propiedad.id)} className="inline">
              <button
                type="submit"
                className="cursor-pointer font-medium text-indigo-600 underline hover:text-indigo-800"
              >
                Generar código
              </button>
            </form>
          )}
          {propiedad.codigo && (
            <span className="ml-1 font-mono font-medium text-slate-900">{propiedad.codigo}</span>
          )}
        </p>
```

Add the import at the top: `import { generarCodigoAction } from "./editar/actions";`

- [ ] **Step 6: Add the Server Action**

In `src/app/propiedades/[id]/editar/actions.ts`, add alongside the existing
`updatePropiedadAction`:

```typescript
import { generateCodigoPropiedad } from "@/lib/domain/codigoPropiedad";

export async function generarCodigoAction(id: string): Promise<void> {
  const { propiedades } = getDomainModules();
  await propiedades.update(id, { codigo: generateCodigoPropiedad() });
  revalidatePath(`/propiedades/${id}`);
}
```

Add `revalidatePath` to the existing `next/navigation`/`next/cache` imports at the top of the
file (`import { revalidatePath } from "next/cache";`) if not already present.

- [ ] **Step 7: Run the full test suite**

Run: `cd brunella-crm && npm test`
Expected: all tests pass (no regressions).

- [ ] **Step 8: Commit**

```bash
git add src/lib/domain/codigoPropiedad.ts src/lib/domain/codigoPropiedad.test.ts src/app/propiedades/\[id\]/page.tsx src/app/propiedades/\[id\]/editar/actions.ts
git commit -m "feat: generate short referral code per property for ad attribution"
```

---

### Task 3: `leads_pendientes` domain module + in-memory fallback

**Files:**
- Create: `src/lib/domain/leadsPendientes.ts`
- Test: `src/lib/domain/leadsPendientes.test.ts`
- Modify: `src/lib/domain/factory.ts`

**Interfaces:**
- Consumes: `createRepository<T>` from `src/lib/db/repository.ts` (Task 1 context, already
  exists).
- Produces: `createLeadsPendientesModule(pool)` returning
  `{ ...repo, findByToken(token): Promise<LeadPendiente | null>, marcarUsado(id): Promise<void> }`,
  used by Task 5 (Meta webhook) and Task 7 (form actions).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { createLeadsPendientesModule } from "./leadsPendientes";
import { loadTestDb } from "../db/testDb";

describe("leadsPendientesModule", () => {
  it("creates and finds a lead by token", async () => {
    const { pool } = await loadTestDb();
    const mod = createLeadsPendientesModule(pool);

    await mod.create({
      token: "tok-abc",
      canal: "Instagram",
      psid: "psid-123",
      codigo_propiedad: "COD-TEST",
      usado: false,
    });

    const found = await mod.findByToken("tok-abc");
    expect(found?.psid).toBe("psid-123");
    expect(found?.codigo_propiedad).toBe("COD-TEST");

    await pool.end();
  });

  it("returns null for an unknown token", async () => {
    const { pool } = await loadTestDb();
    const mod = createLeadsPendientesModule(pool);
    const found = await mod.findByToken("nope");
    expect(found).toBeNull();
    await pool.end();
  });

  it("marks a lead as used", async () => {
    const { pool } = await loadTestDb();
    const mod = createLeadsPendientesModule(pool);
    const created = await mod.create({
      token: "tok-xyz",
      canal: "Facebook",
      psid: "psid-999",
      codigo_propiedad: null,
      usado: false,
    });

    await mod.marcarUsado(created.id);

    const found = await mod.findByToken("tok-xyz");
    expect(found?.usado).toBe(true);

    await pool.end();
  });
});
```

Check `src/lib/db/testDb.ts` for the exact exported shape (`loadTestDb` may return just a
`pool`, or `{ pool }` — match whatever the existing tests in `busquedas.test.ts` or similar
already use; adjust the destructuring in this test to match).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- leadsPendientes.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import type { Pool } from "pg";
import { createRepository } from "../db/repository";

export type LeadPendiente = {
  id: string;
  token: string;
  canal: "Instagram" | "Facebook";
  psid: string;
  codigo_propiedad: string | null;
  usado: boolean;
  created_at: string;
};

export function createLeadsPendientesModule(pool: Pool) {
  const repo = createRepository<LeadPendiente>(pool, "leads_pendientes");
  return {
    ...repo,
    async findByToken(token: string): Promise<LeadPendiente | null> {
      const result = await pool.query(
        "select * from leads_pendientes where token = $1",
        [token]
      );
      return result.rows[0] ?? null;
    },
    async marcarUsado(id: string): Promise<void> {
      await pool.query("update leads_pendientes set usado = true where id = $1", [id]);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- leadsPendientes.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into the domain factory**

In `src/lib/domain/factory.ts`:

1. Add the import: `import { createLeadsPendientesModule } from "./leadsPendientes";`
2. Add `leadsPendientes: ReturnType<typeof createLeadsPendientesModule>;` to the
   `DomainModules` type.
3. In `buildInMemoryModules()`, add:

```typescript
  const leadsPendientesTable = createInMemoryTable([]);
```

and, in the returned object:

```typescript
    leadsPendientes: {
      ...leadsPendientesTable,
      findByToken: async (token: string) =>
        (await leadsPendientesTable.list()).find((l: any) => l.token === token) ?? null,
      marcarUsado: async (id: string) => {
        const item = await leadsPendientesTable.findById(id);
        if (item) await leadsPendientesTable.update(id, { usado: true } as any);
      },
    } as any,
```

4. In `getDomainModules()`, add `leadsPendientes: createLeadsPendientesModule(pool),` to the
   real (Postgres-backed) branch's returned object.

- [ ] **Step 6: Run the full test suite**

Run: `cd brunella-crm && npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/domain/leadsPendientes.ts src/lib/domain/leadsPendientes.test.ts src/lib/domain/factory.ts
git commit -m "feat: add leads_pendientes domain module with in-memory fallback"
```

---

### Task 4: Meta webhook verification utility + Meta messaging client

**Files:**
- Create: `src/lib/meta/webhookVerification.ts`
- Test: `src/lib/meta/webhookVerification.test.ts`
- Create: `src/lib/meta/client.ts`
- Test: `src/lib/meta/client.test.ts`

**Interfaces:**
- Produces: `verifyChallenge(mode, token, challenge): string | null`,
  `verifySignature(rawBody, signatureHeader): boolean`,
  `sendMessengerMessage(psid, text): Promise<void>`,
  `sendInstagramMessage(igsid, text): Promise<void>`. Used by Task 5 (Meta webhook route) and
  reused (signature verification only) by Task 9 (WhatsApp client), since WhatsApp Cloud API
  uses the identical Meta signature scheme.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/meta/webhookVerification.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyChallenge, verifySignature } from "./webhookVerification";

describe("verifyChallenge", () => {
  beforeEach(() => {
    process.env.META_VERIFY_TOKEN = "test-verify-token";
  });

  it("returns the challenge when mode and token match", () => {
    const result = verifyChallenge("subscribe", "test-verify-token", "challenge-123");
    expect(result).toBe("challenge-123");
  });

  it("returns null when the token does not match", () => {
    const result = verifyChallenge("subscribe", "wrong-token", "challenge-123");
    expect(result).toBeNull();
  });

  it("returns null when mode is not subscribe", () => {
    const result = verifyChallenge("unsubscribe", "test-verify-token", "challenge-123");
    expect(result).toBeNull();
  });
});

describe("verifySignature", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = "test-app-secret";
  });

  it("accepts a signature computed with the configured app secret", () => {
    const rawBody = '{"object":"page","entry":[]}';
    const expected =
      "sha256=" + createHmac("sha256", "test-app-secret").update(rawBody).digest("hex");
    expect(verifySignature(rawBody, expected)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const rawBody = '{"object":"page","entry":[]}';
    const wrong = "sha256=" + createHmac("sha256", "not-the-secret").update(rawBody).digest("hex");
    expect(verifySignature(rawBody, wrong)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature('{"object":"page"}', undefined)).toBe(false);
  });
});
```

```typescript
// src/lib/meta/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendMessengerMessage, sendInstagramMessage } from "./client";

describe("Meta messaging client", () => {
  beforeEach(() => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = "page-token";
    process.env.INSTAGRAM_ACCESS_TOKEN = "ig-token";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a Messenger message with the page access token", async () => {
    await sendMessengerMessage("psid-1", "hola");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("access_token=page-token"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends an Instagram message with the Instagram access token", async () => {
    await sendInstagramMessage("igsid-1", "hola");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("access_token=ig-token"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the Graph API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as any;
    await expect(sendMessengerMessage("psid-1", "hola")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd brunella-crm && npm test -- meta/`
Expected: FAIL — neither file exists yet.

- [ ] **Step 3: Write `webhookVerification.ts`**

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  const expected = process.env.META_VERIFY_TOKEN;
  if (!expected || mode !== "subscribe" || token !== expected || !challenge) return null;
  return challenge;
}

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Write `client.ts`**

```typescript
const GRAPH_API_VERSION = "v21.0";

function requireToken(envVar: string): string {
  const token = process.env[envVar];
  if (!token) throw new Error(`${envVar} is not set`);
  return token;
}

async function sendGraphMessage(
  recipientId: string,
  text: string,
  accessTokenEnvVar: string
): Promise<void> {
  const token = requireToken(accessTokenEnvVar);
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
  if (!response.ok) {
    throw new Error(`Graph API sendMessage failed (${response.status})`);
  }
}

export async function sendMessengerMessage(psid: string, text: string): Promise<void> {
  return sendGraphMessage(psid, text, "MESSENGER_PAGE_ACCESS_TOKEN");
}

export async function sendInstagramMessage(igsid: string, text: string): Promise<void> {
  return sendGraphMessage(igsid, text, "INSTAGRAM_ACCESS_TOKEN");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd brunella-crm && npm test -- meta/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/meta/webhookVerification.ts src/lib/meta/webhookVerification.test.ts src/lib/meta/client.ts src/lib/meta/client.test.ts
git commit -m "feat: add Meta webhook verification and Messenger/Instagram messaging client"
```

---

### Task 5: Meta webhook route (Messenger + Instagram combined)

**Files:**
- Create: `src/app/api/meta/webhook/route.ts`
- Test: `src/app/api/meta/webhook/route.test.ts`

**Interfaces:**
- Consumes: `verifyChallenge`, `verifySignature` (Task 4), `sendMessengerMessage`,
  `sendInstagramMessage` (Task 4), `getDomainModules().leadsPendientes` (Task 3).
- Produces: `GET`/`POST` route handlers. No other task depends on this file directly — it's
  an entry point.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

vi.mock("@/lib/meta/client", () => ({
  sendMessengerMessage: vi.fn().mockResolvedValue(undefined),
  sendInstagramMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn().mockReturnValue({}) }));

// The route generates its own token via randomUUID() and only ever reads that local value —
// it never reads a token back from leadsPendientes.create()'s return value. Mock randomUUID
// itself so the test can assert on a predictable link instead of the create() mock's (unused)
// return shape.
vi.mock("node:crypto", () => ({ randomUUID: () => "tok-generated" }));

const leadsPendientesCreate = vi.fn().mockResolvedValue({ id: "lead-1" });
vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    leadsPendientes: { create: leadsPendientesCreate },
  }),
}));

import { GET, POST } from "./route";
import { sendMessengerMessage, sendInstagramMessage } from "@/lib/meta/client";

function signedRequest(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature =
    "sha256=" + createHmac("sha256", "test-secret").update(rawBody).digest("hex");
  return new NextRequest("https://example.com/api/meta/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature, "content-type": "application/json" },
    body: rawBody,
  });
}

describe("GET /api/meta/webhook (verification)", () => {
  beforeEach(() => {
    process.env.META_VERIFY_TOKEN = "verify-me";
  });

  it("returns the challenge when the verify token matches", async () => {
    const url =
      "https://example.com/api/meta/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123";
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  it("rejects when the verify token does not match", async () => {
    const url =
      "https://example.com/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123";
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/meta/webhook (messages)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadsPendientesCreate.mockResolvedValue({ id: "lead-1" });
    process.env.META_APP_SECRET = "test-secret";
    process.env.APP_BASE_URL = "https://brunella-realstate.vercel.app";
  });

  it("rejects requests with an invalid signature", async () => {
    const request = new NextRequest("https://example.com/api/meta/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=invalid" },
      body: JSON.stringify({ object: "page", entry: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("replies on Messenger with a form link and stores the referral", async () => {
    const request = signedRequest({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "psid-1" },
              message: { text: "hola" },
              referral: { ref: "COD-TEST" },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(leadsPendientesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ canal: "Facebook", psid: "psid-1", codigo_propiedad: "COD-TEST" })
    );
    expect(sendMessengerMessage).toHaveBeenCalledWith(
      "psid-1",
      expect.stringContaining("tok-generated")
    );
  });

  it("replies on Instagram without a referral when there is none", async () => {
    const request = signedRequest({
      object: "instagram",
      entry: [
        {
          messaging: [{ sender: { id: "igsid-1" }, message: { text: "hola" } }],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(leadsPendientesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ canal: "Instagram", psid: "igsid-1", codigo_propiedad: null })
    );
    expect(sendInstagramMessage).toHaveBeenCalled();
  });

  it("ignores malformed payloads instead of throwing", async () => {
    const request = signedRequest({ not: "a meta event" });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(sendMessengerMessage).not.toHaveBeenCalled();
    expect(sendInstagramMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd brunella-crm && npm test -- meta/webhook`
Expected: FAIL — route does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifyChallenge, verifySignature } from "@/lib/meta/webhookVerification";
import { sendMessengerMessage, sendInstagramMessage } from "@/lib/meta/client";
import { getDomainModules } from "@/lib/domain/factory";

const metaEventSchema = z.object({
  object: z.enum(["page", "instagram"]),
  entry: z.array(
    z.object({
      messaging: z
        .array(
          z.object({
            sender: z.object({ id: z.string() }),
            referral: z.object({ ref: z.string() }).optional(),
          })
        )
        .optional(),
    })
  ),
});

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const challenge = verifyChallenge(
    searchParams.get("hub.mode"),
    searchParams.get("hub.verify_token"),
    searchParams.get("hub.challenge")
  );
  if (!challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const parsed = metaEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const { leadsPendientes } = getDomainModules();
  const canal = parsed.data.object === "page" ? "Facebook" : "Instagram";
  const baseUrl = process.env.APP_BASE_URL ?? "";

  for (const entry of parsed.data.entry) {
    for (const event of entry.messaging ?? []) {
      const token = randomUUID();
      await leadsPendientes.create({
        token,
        canal,
        psid: event.sender.id,
        codigo_propiedad: event.referral?.ref ?? null,
      });

      const link = `${baseUrl}/formulario?t=${token}`;
      const text = `¡Hola! Contame lo que buscás (o la propiedad que querés publicar) acá: ${link}`;

      if (canal === "Facebook") {
        await sendMessengerMessage(event.sender.id, text);
      } else {
        await sendInstagramMessage(event.sender.id, text);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd brunella-crm && npm test -- meta/webhook`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/meta/webhook/route.ts src/app/api/meta/webhook/route.test.ts
git commit -m "feat: add combined Messenger/Instagram webhook that replies with the intake form link"
```

---

### Task 6: Lead form validation schemas

**Files:**
- Create: `src/lib/view/leadForm.ts`
- Test: `src/lib/view/leadForm.test.ts`

**Interfaces:**
- Produces: `parseCompradorForm(formData): { success, data } | { success, error }`,
  `parsePropietarioForm(formData): { success, data } | { success, error }`. Used by Task 7
  (Server Actions).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { parseCompradorForm, parsePropietarioForm } from "./leadForm";

function fd(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

describe("parseCompradorForm", () => {
  it("parses a valid comprador submission", () => {
    const result = parseCompradorForm(
      fd({
        nombre: "Juan Pérez",
        telefono: "+54 351 555-1234",
        tipo_operacion: "Compra",
        tipo_propiedad: "PH",
        zona: "Nueva Córdoba",
        presupuesto_min: "50000",
        presupuesto_max: "80000",
        moneda: "USD",
        dormitorios: "2",
        otros_requisitos: "Con cochera",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Juan Pérez");
      expect(result.data.presupuesto_min).toBe(50000);
      expect(result.data.dormitorios).toBe(2);
    }
  });

  it("requires nombre and telefono", () => {
    const result = parseCompradorForm(fd({ tipo_operacion: "Compra" }));
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be blank", () => {
    const result = parseCompradorForm(
      fd({
        nombre: "Ana",
        telefono: "+54 351 555-0000",
        tipo_operacion: "Alquiler",
        tipo_propiedad: "Departamento",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zona).toBeNull();
      expect(result.data.presupuesto_min).toBeNull();
    }
  });
});

describe("parsePropietarioForm", () => {
  it("parses a valid propietario submission", () => {
    const result = parsePropietarioForm(
      fd({
        nombre: "Marcela",
        telefono: "+54 351 555-4321",
        que_quiere_hacer: "Vender",
        direccion: "Av. Colón 1234",
        tipo_propiedad: "Casa",
        precio: "120000",
        moneda: "USD",
        descripcion: "Casa de 3 dormitorios",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direccion).toBe("Av. Colón 1234");
      expect(result.data.precio).toBe(120000);
    }
  });

  it("requires direccion and tipo_propiedad", () => {
    const result = parsePropietarioForm(
      fd({ nombre: "Marcela", telefono: "+54 351 555-4321", que_quiere_hacer: "Vender" })
    );
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- leadForm.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from "zod";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalNumber = z.preprocess(
  blankToNull,
  z.coerce.number().nullable().default(null)
);

const TIPOS_PROPIEDAD = ["Departamento", "Casa", "PH", "Lote", "Local/Oficina"] as const;

const compradorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().min(6, "El WhatsApp es obligatorio"),
  tipo_operacion: z.enum(["Compra", "Alquiler", "Inversion"]),
  tipo_propiedad: z.enum(TIPOS_PROPIEDAD),
  zona: z.preprocess(blankToNull, z.string().nullable().default(null)),
  presupuesto_min: optionalNumber,
  presupuesto_max: optionalNumber,
  moneda: z.preprocess(blankToNull, z.enum(["ARS", "USD"]).nullable().default(null)),
  dormitorios: optionalNumber,
  otros_requisitos: z.preprocess(blankToNull, z.string().nullable().default(null)),
});

const propietarioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().min(6, "El WhatsApp es obligatorio"),
  que_quiere_hacer: z.enum(["Vender", "Alquilar", "Alquiler temporario"]),
  direccion: z.string().trim().min(1, "La dirección es obligatoria"),
  tipo_propiedad: z.enum(TIPOS_PROPIEDAD),
  precio: optionalNumber,
  moneda: z.preprocess(blankToNull, z.enum(["ARS", "USD"]).nullable().default(null)),
  descripcion: z.preprocess(blankToNull, z.string().nullable().default(null)),
});

export type CompradorFormData = z.infer<typeof compradorSchema>;
export type PropietarioFormData = z.infer<typeof propietarioSchema>;

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  formData: FormData
): { success: true; data: T } | { success: false; error: string } {
  const raw = Object.fromEntries(formData.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos" };
  }
  return { success: true, data: result.data };
}

export function parseCompradorForm(formData: FormData) {
  return parseWithSchema(compradorSchema, formData);
}

export function parsePropietarioForm(formData: FormData) {
  return parseWithSchema(propietarioSchema, formData);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- leadForm.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/leadForm.ts src/lib/view/leadForm.test.ts
git commit -m "feat: add Zod schemas for the client-facing comprador/propietario form"
```

---

### Task 7: Lead form Server Actions

**Files:**
- Create: `src/app/formulario/actions.ts`
- Test: `src/app/formulario/actions.test.ts`

**Interfaces:**
- Consumes: `parseCompradorForm`, `parsePropietarioForm` (Task 6), `getDomainModules()`
  (Tasks 1, 3), `findByTelefono`/`marcarWhatsappConfirmado` (Task 1).
- Produces: `submitCompradorAction(token, formData): Promise<never>` (redirects),
  `submitPropietarioAction(token, formData): Promise<never>` (redirects). Both redirect to
  `/formulario/confirmar?c=<contactoId>`, consumed by Task 8 (confirmation page).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const contactosFindByTelefono = vi.fn().mockResolvedValue(null);
const contactosCreate = vi.fn().mockResolvedValue({ id: "contacto-1", nombre: "Juan" });
const busquedasCreate = vi.fn().mockResolvedValue({ id: "busqueda-1" });
const propiedadesFindByCodigo = vi.fn().mockResolvedValue(null);
// `list` is unused until Task 15 wires in the matching engine, but it's declared here (rather
// than added later) so every test in this file shares one mock shape — Task 15 only needs to
// set its return value per-test, not restructure this mock.
const propiedadesList = vi.fn().mockResolvedValue([]);
const consultasCreate = vi.fn().mockResolvedValue({ id: "consulta-1" });
const leadsPendientesFindByToken = vi.fn().mockResolvedValue(null);
const leadsPendientesMarcarUsado = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    contactos: { findByTelefono: contactosFindByTelefono, create: contactosCreate },
    busquedas: { create: busquedasCreate },
    propiedades: { findByCodigo: propiedadesFindByCodigo, create: vi.fn(), list: propiedadesList },
    consultas: { create: consultasCreate },
    leadsPendientes: {
      findByToken: leadsPendientesFindByToken,
      marcarUsado: leadsPendientesMarcarUsado,
    },
  }),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("REDIRECT"); }) }));

import { submitCompradorAction } from "./actions";
import { redirect } from "next/navigation";

function fd(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

describe("submitCompradorAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new contacto and busqueda, and redirects to the confirmation page", async () => {
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-1", nombre: "Juan" });

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Juan",
          telefono: "+54 351 555-1234",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(contactosCreate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Juan", tipo: "Comprador", fuente: "Otro" })
    );
    expect(busquedasCreate).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "contacto-1", tipo_operacion: "Compra" })
    );
    expect(redirect).toHaveBeenCalledWith("/formulario/confirmar?c=contacto-1");
  });

  it("reuses an existing contacto with the same phone instead of duplicating", async () => {
    contactosFindByTelefono.mockResolvedValue({ id: "contacto-existing", nombre: "Juan" });

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Juan",
          telefono: "+54 351 555-1234",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(contactosCreate).not.toHaveBeenCalled();
    expect(busquedasCreate).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "contacto-existing" })
    );
  });

  it("resolves attribution from the token and links the consulta to the matched property", async () => {
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-2", nombre: "Ana" });
    leadsPendientesFindByToken.mockResolvedValue({
      id: "lead-1",
      canal: "Instagram",
      codigo_propiedad: "COD-TEST",
    });
    propiedadesFindByCodigo.mockResolvedValue({ id: "propiedad-1" });

    await expect(
      submitCompradorAction(
        "tok-123",
        fd({
          nombre: "Ana",
          telefono: "+54 351 555-9999",
          tipo_operacion: "Alquiler",
          tipo_propiedad: "Departamento",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(contactosCreate).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: "Instagram" })
    );
    expect(consultasCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        propiedad_id: "propiedad-1",
        contacto_id: "contacto-2",
        canal: "Instagram",
        origen: "formulario_cliente",
      })
    );
    expect(leadsPendientesMarcarUsado).toHaveBeenCalledWith("lead-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- formulario/actions`
Expected: FAIL — `src/app/formulario/actions.ts` does not exist.

- [ ] **Step 3: Add `findByCodigo` to the propiedades module**

Before writing the action, add this method to `createPropiedadesModule` in
`src/lib/domain/propiedades.ts` (used by the action to resolve attribution):

```typescript
    async findByCodigo(codigo: string): Promise<Propiedad | null> {
      const result = await pool.query("select * from propiedades where codigo = $1", [codigo]);
      return result.rows[0] ?? null;
    },
```

And in `src/lib/domain/factory.ts`'s in-memory `propiedades` block, add:

```typescript
      findByCodigo: async (codigo: string) =>
        (await propiedadesTable.list()).find((p: any) => p.codigo === codigo) ?? null,
```

- [ ] **Step 4: Write the implementation**

```typescript
"use server";

import { redirect } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { parseCompradorForm, parsePropietarioForm } from "@/lib/view/leadForm";

async function resolveAtribucion(token: string | null) {
  if (!token) return { fuente: "Otro" as const, propiedadId: null as string | null, leadId: null as string | null };

  const { leadsPendientes, propiedades } = getDomainModules();
  const lead = await leadsPendientes.findByToken(token);
  if (!lead) return { fuente: "Otro" as const, propiedadId: null, leadId: null };

  const propiedad = lead.codigo_propiedad
    ? await propiedades.findByCodigo(lead.codigo_propiedad)
    : null;

  return { fuente: lead.canal, propiedadId: propiedad?.id ?? null, leadId: lead.id };
}

export async function submitCompradorAction(
  token: string | null,
  formData: FormData
): Promise<void> {
  const result = parseCompradorForm(formData);
  if (!result.success) {
    redirect(`/formulario?t=${token ?? ""}&error=1`);
  }
  const data = result.data;

  const { contactos, busquedas, consultas, leadsPendientes } = getDomainModules();
  const { fuente, propiedadId, leadId } = await resolveAtribucion(token);

  let contacto = await contactos.findByTelefono(data.telefono);
  if (!contacto) {
    contacto = await contactos.create({
      nombre: data.nombre,
      telefono: data.telefono,
      fuente,
      tipo: "Comprador",
      etapa: "Buscando",
      temperatura: "Tibio",
    });
  }

  await busquedas.create({
    contacto_id: contacto.id,
    tipo_operacion: data.tipo_operacion,
    tipo_propiedad: data.tipo_propiedad,
    zona: data.zona,
    presupuesto_min: data.presupuesto_min,
    presupuesto_max: data.presupuesto_max,
    moneda: data.moneda,
    dormitorios: data.dormitorios,
    otros_requisitos: data.otros_requisitos,
    activa: true,
  });

  if (propiedadId) {
    await consultas.create({
      propiedad_id: propiedadId,
      contacto_id: contacto.id,
      canal: fuente === "Otro" ? "Otro" : fuente,
      origen: "formulario_cliente",
    });
  }
  if (leadId) {
    await leadsPendientes.marcarUsado(leadId);
  }

  redirect(`/formulario/confirmar?c=${contacto.id}`);
}

export async function submitPropietarioAction(
  token: string | null,
  formData: FormData
): Promise<void> {
  const result = parsePropietarioForm(formData);
  if (!result.success) {
    redirect(`/formulario?t=${token ?? ""}&tipo=propietario&error=1`);
  }
  const data = result.data;

  const { contactos, propiedades, leadsPendientes } = getDomainModules();
  const { fuente, leadId } = await resolveAtribucion(token);

  let contacto = await contactos.findByTelefono(data.telefono);
  if (!contacto) {
    contacto = await contactos.create({
      nombre: data.nombre,
      telefono: data.telefono,
      fuente,
      tipo: "Propietario",
      etapa: "Nuevo",
      temperatura: "Tibio",
    });
  }

  await propiedades.create({
    contacto_propietario_id: contacto.id,
    direccion: data.direccion,
    tipo_propiedad: data.tipo_propiedad,
    precio: data.precio,
    moneda: data.moneda,
    descripcion: data.descripcion,
    condiciones: data.que_quiere_hacer,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
  });

  if (leadId) {
    await leadsPendientes.marcarUsado(leadId);
  }

  redirect(`/formulario/confirmar?c=${contacto.id}`);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- formulario/actions`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `cd brunella-crm && npm test`
Expected: all pass — confirms `findByCodigo` additions didn't break existing propiedades
tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/formulario/actions.ts src/app/formulario/actions.test.ts src/lib/domain/propiedades.ts src/lib/domain/factory.ts
git commit -m "feat: add Server Actions creating Contacto+Busqueda/Propiedad from the client form"
```

---

### Task 8: Lead form pages + confirmation page

**Files:**
- Create: `src/app/formulario/page.tsx`
- Create: `src/app/formulario/CompradorForm.tsx`
- Create: `src/app/formulario/PropietarioForm.tsx`
- Create: `src/app/formulario/confirmar/page.tsx`

**Interfaces:**
- Consumes: `submitCompradorAction`, `submitPropietarioAction` (Task 7),
  `getDomainModules().contactos.findById` (Task 1).
- Produces: the public routes `/formulario` and `/formulario/confirmar` — terminal UI, no
  other task depends on these files.

- [ ] **Step 1: Write the step-selector + form page**

```tsx
import { CompradorForm } from "./CompradorForm";
import { PropietarioForm } from "./PropietarioForm";

export default async function FormularioPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tipo?: string; error?: string }>;
}) {
  const { t, tipo, error } = await searchParams;
  const token = t ?? null;

  if (tipo === "propietario") {
    return <PropietarioForm token={token} showError={error === "1"} />;
  }
  if (tipo === "comprador") {
    return <CompradorForm token={token} showError={error === "1"} />;
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">¿Qué estás buscando?</h1>
      <div className="space-y-3">
        <a
          href={`/formulario?tipo=comprador${token ? `&t=${token}` : ""}`}
          className="block min-h-[56px] rounded-lg border border-slate-200 bg-white p-4 text-center text-base font-medium text-slate-900 hover:border-indigo-400"
        >
          Quiero comprar o alquilar una propiedad
        </a>
        <a
          href={`/formulario?tipo=propietario${token ? `&t=${token}` : ""}`}
          className="block min-h-[56px] rounded-lg border border-slate-200 bg-white p-4 text-center text-base font-medium text-slate-900 hover:border-indigo-400"
        >
          Quiero publicar mi propiedad (vender o alquilar)
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the Comprador form component**

```tsx
import { submitCompradorAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const labelClass = "block text-sm font-medium text-slate-700";

export function CompradorForm({ token, showError }: { token: string | null; showError: boolean }) {
  const action = submitCompradorAction.bind(null, token);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Contame qué buscás</h1>
      {showError && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Revisá los datos obligatorios e intentá de nuevo.
        </p>
      )}
      <form action={action} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" type="text" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="telefono">Tu WhatsApp</label>
          <input id="telefono" name="telefono" type="tel" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tipo_operacion">Qué operación</label>
          <select id="tipo_operacion" name="tipo_operacion" className={inputClass} defaultValue="Compra">
            <option value="Compra">Comprar</option>
            <option value="Alquiler">Alquilar</option>
            <option value="Inversion">Inversión</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="tipo_propiedad">Tipo de propiedad</label>
          <select id="tipo_propiedad" name="tipo_propiedad" className={inputClass} defaultValue="Departamento">
            <option value="Departamento">Departamento</option>
            <option value="Casa">Casa</option>
            <option value="PH">PH</option>
            <option value="Lote">Lote</option>
            <option value="Local/Oficina">Local/Oficina</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="zona">Zona/barrio</label>
          <input id="zona" name="zona" type="text" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="presupuesto_min">Presupuesto mínimo</label>
            <input id="presupuesto_min" name="presupuesto_min" type="number" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="presupuesto_max">Presupuesto máximo</label>
            <input id="presupuesto_max" name="presupuesto_max" type="number" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="moneda">Moneda</label>
          <select id="moneda" name="moneda" className={inputClass} defaultValue="USD">
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="dormitorios">Dormitorios mínimos</label>
          <input id="dormitorios" name="dormitorios" type="number" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="otros_requisitos">Otros requisitos (opcional)</label>
          <textarea id="otros_requisitos" name="otros_requisitos" rows={3} className={inputClass} />
        </div>
        <button
          type="submit"
          className="min-h-[48px] w-full rounded-lg bg-indigo-600 px-4 font-medium text-white transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Write the Propietario form component**

```tsx
import { submitPropietarioAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const labelClass = "block text-sm font-medium text-slate-700";

export function PropietarioForm({ token, showError }: { token: string | null; showError: boolean }) {
  const action = submitPropietarioAction.bind(null, token);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Contanos de tu propiedad</h1>
      {showError && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Revisá los datos obligatorios e intentá de nuevo.
        </p>
      )}
      <form action={action} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" type="text" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="telefono">Tu WhatsApp</label>
          <input id="telefono" name="telefono" type="tel" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="que_quiere_hacer">Qué querés hacer</label>
          <select id="que_quiere_hacer" name="que_quiere_hacer" className={inputClass} defaultValue="Vender">
            <option value="Vender">Vender</option>
            <option value="Alquilar">Alquilar</option>
            <option value="Alquiler temporario">Alquiler temporario</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="direccion">Dirección</label>
          <input id="direccion" name="direccion" type="text" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tipo_propiedad">Tipo de propiedad</label>
          <select id="tipo_propiedad" name="tipo_propiedad" className={inputClass} defaultValue="Departamento">
            <option value="Departamento">Departamento</option>
            <option value="Casa">Casa</option>
            <option value="PH">PH</option>
            <option value="Lote">Lote</option>
            <option value="Local/Oficina">Local/Oficina</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="precio">Precio</label>
            <input id="precio" name="precio" type="number" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="moneda">Moneda</label>
            <select id="moneda" name="moneda" className={inputClass} defaultValue="USD">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="descripcion">Descripción (opcional)</label>
          <textarea id="descripcion" name="descripcion" rows={3} className={inputClass} />
        </div>
        <button
          type="submit"
          className="min-h-[48px] w-full rounded-lg bg-indigo-600 px-4 font-medium text-white transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Write the confirmation page**

```tsx
import { notFound } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";

export default async function ConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  if (!c) notFound();

  const { contactos } = getDomainModules();
  const contacto = await contactos.findById(c);
  if (!contacto) notFound();

  const numeroNegocio = process.env.WHATSAPP_BUSINESS_NUMBER ?? "";
  const mensaje = encodeURIComponent(`Hola, completé el formulario - soy ${contacto.nombre}`);
  const waLink = `https://wa.me/${numeroNegocio}?text=${mensaje}`;

  return (
    <main className="mx-auto max-w-2xl p-4 text-center">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">¡Gracias, {contacto.nombre}!</h1>
      <p className="mb-6 text-base text-slate-600">
        Ya recibimos tus datos. Para que podamos responderte, tocá el botón y mandanos el
        mensaje que te dejamos escrito — así arrancamos la conversación por WhatsApp.
      </p>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block min-h-[48px] rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
      >
        Confirmar por WhatsApp
      </a>
    </main>
  );
}
```

- [ ] **Step 5: Verify no regressions**

Run: `cd brunella-crm && npm test && npm run build`
Expected: tests pass, build succeeds (new pages compile).

- [ ] **Step 6: Commit**

```bash
git add src/app/formulario/page.tsx src/app/formulario/CompradorForm.tsx src/app/formulario/PropietarioForm.tsx src/app/formulario/confirmar/page.tsx
git commit -m "feat: add public intake form (comprador/propietario) and WhatsApp confirmation page"
```

---

### Task 9: WhatsApp Cloud API client

**Files:**
- Create: `src/lib/whatsapp/client.ts`
- Test: `src/lib/whatsapp/client.test.ts`

**Interfaces:**
- Consumes: `verifyChallenge`, `verifySignature` from `src/lib/meta/webhookVerification.ts`
  (Task 4) — re-exported here for convenience so the webhook route (Task 10) only imports from
  one module.
- Produces: `sendWhatsAppText(to, text): Promise<void>`,
  `sendWhatsAppImage(to, imageUrl, caption): Promise<void>`. Used by Task 12/14 (sending the
  compatibility document) and Task 10 (webhook, indirectly via Task 14).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppText, sendWhatsAppImage } from "./client";

describe("WhatsApp Cloud API client", () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "wa-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  afterEach(() => vi.restoreAllMocks());

  it("sends a text message to the given phone number", async () => {
    await sendWhatsAppText("5493511234567", "hola");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("1234567890/messages"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer wa-token" }),
      })
    );
  });

  it("sends an image message with a caption", async () => {
    await sendWhatsAppImage("5493511234567", "https://example.com/foto.jpg", "Depto en Nueva Córdoba");
    const call = (fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.type).toBe("image");
    expect(body.image.link).toBe("https://example.com/foto.jpg");
    expect(body.image.caption).toBe("Depto en Nueva Córdoba");
  });

  it("throws when the Graph API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as any;
    await expect(sendWhatsAppText("5493511234567", "hola")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- whatsapp/client`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
const GRAPH_API_VERSION = "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function postToWhatsApp(body: Record<string, unknown>): Promise<void> {
  const token = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API request failed (${response.status})`);
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  await postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption: string
): Promise<void> {
  await postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: imageUrl, caption },
  });
}

export { verifyChallenge, verifySignature } from "@/lib/meta/webhookVerification";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- whatsapp/client`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/client.ts src/lib/whatsapp/client.test.ts
git commit -m "feat: add WhatsApp Cloud API client for text/image messages"
```

---

### Task 10: WhatsApp webhook route

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`
- Test: `src/app/api/whatsapp/webhook/route.test.ts`

**Interfaces:**
- Consumes: `verifyChallenge`, `verifySignature` (via `@/lib/whatsapp/client`, Task 9),
  `getDomainModules().contactos.findByTelefono`/`marcarWhatsappConfirmado` (Task 1),
  `getDomainModules().busquedas` (needs a new `findPendienteAprobadoByContactoId` — added in
  this task).
- Produces: `GET`/`POST` handlers. Depends on Task 12 (matching) and Task 13 (document
  builder) for the "send now if already approved" branch — see Step 3.

- [ ] **Step 1: Add `findPendienteAprobadoByContactoId` to the busquedas module**

In `src/lib/domain/busquedas.ts`, add this method alongside `findByContactoId`:

```typescript
    async findPendienteAprobadoByContactoId(contactoId: string): Promise<Busqueda | null> {
      const result = await pool.query(
        `select * from busquedas
         where contacto_id = $1 and documento_aprobado = true and documento_enviado = false
         order by created_at desc limit 1`,
        [contactoId]
      );
      return result.rows[0] ?? null;
    },
```

And in `src/lib/domain/factory.ts`'s in-memory `busquedas` block:

```typescript
      findPendienteAprobadoByContactoId: async (id: string) =>
        (await busquedasTable.list()).find(
          (b: any) => b.contacto_id === id && b.documento_aprobado && !b.documento_enviado
        ) ?? null,
```

- [ ] **Step 2: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

const marcarWhatsappConfirmado = vi.fn().mockResolvedValue(undefined);
const findByTelefono = vi.fn().mockResolvedValue({ id: "contacto-1", telefono: "5493511234567" });
const findPendienteAprobadoByContactoId = vi.fn().mockResolvedValue(null);
const enviarDocumentoAprobado = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    contactos: { findByTelefono, marcarWhatsappConfirmado },
    busquedas: { findPendienteAprobadoByContactoId },
  }),
}));
vi.mock("@/lib/bot/enviarDocumentoAprobado", () => ({
  enviarDocumentoAprobado,
}));

import { GET, POST } from "./route";

function signedRequest(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", "test-secret").update(rawBody).digest("hex");
  return new NextRequest("https://example.com/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body: rawBody,
  });
}

describe("GET /api/whatsapp/webhook", () => {
  it("returns the challenge when the verify token matches", async () => {
    process.env.META_VERIFY_TOKEN = "verify-me";
    const url =
      "https://example.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=xyz";
    const response = await GET(new NextRequest(url));
    expect(await response.text()).toBe("xyz");
  });
});

describe("POST /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByTelefono.mockResolvedValue({ id: "contacto-1", telefono: "5493511234567" });
    findPendienteAprobadoByContactoId.mockResolvedValue(null);
    process.env.META_APP_SECRET = "test-secret";
  });

  it("marks the contacto as confirmed when a message arrives from their number", async () => {
    const request = signedRequest({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "5493511234567", text: { body: "Hola" } }],
              },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(marcarWhatsappConfirmado).toHaveBeenCalledWith("contacto-1");
  });

  it("sends the pending approved document once the client confirms", async () => {
    findPendienteAprobadoByContactoId.mockResolvedValue({ id: "busqueda-1" });
    const request = signedRequest({
      entry: [
        { changes: [{ value: { messages: [{ from: "5493511234567", text: { body: "Hola" } }] } }] },
      ],
    });

    await POST(request);

    expect(enviarDocumentoAprobado).toHaveBeenCalledWith("busqueda-1");
  });

  it("ignores messages from unknown numbers instead of throwing", async () => {
    findByTelefono.mockResolvedValue(null);
    const request = signedRequest({
      entry: [{ changes: [{ value: { messages: [{ from: "0000000000", text: {} }] } }] }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(marcarWhatsappConfirmado).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd brunella-crm && npm test -- whatsapp/webhook`
Expected: FAIL — route and `enviarDocumentoAprobado` module don't exist yet. This is
expected; `enviarDocumentoAprobado` is built in Task 14, but the mock lets this test pass
in isolation. Proceed to Step 4 for the webhook route itself — Task 14 will make the real
(non-mocked) integration work end to end.

- [ ] **Step 4: Write the webhook route**

```typescript
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { verifyChallenge, verifySignature } from "@/lib/whatsapp/client";
import { getDomainModules } from "@/lib/domain/factory";
import { enviarDocumentoAprobado } from "@/lib/bot/enviarDocumentoAprobado";

const whatsappEventSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z
              .array(z.object({ from: z.string() }))
              .optional(),
          }),
        })
      ),
    })
  ),
});

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const challenge = verifyChallenge(
    searchParams.get("hub.mode"),
    searchParams.get("hub.verify_token"),
    searchParams.get("hub.challenge")
  );
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const parsed = whatsappEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const { contactos, busquedas } = getDomainModules();

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      for (const message of change.value.messages ?? []) {
        const contacto = await contactos.findByTelefono(message.from);
        if (!contacto) continue;

        await contactos.marcarWhatsappConfirmado(contacto.id);

        const pendiente = await busquedas.findPendienteAprobadoByContactoId(contacto.id);
        if (pendiente) {
          await enviarDocumentoAprobado(pendiente.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd brunella-crm && npm test -- whatsapp/webhook`
Expected: still FAIL at this point because `enviarDocumentoAprobado` (Task 14) doesn't exist
as a real module yet — but the `vi.mock` in the test replaces it entirely, so the test itself
should PASS once the route file compiles. If it still fails, check that the import path
`@/lib/bot/enviarDocumentoAprobado` matches exactly what Task 14 will create.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts src/app/api/whatsapp/webhook/route.test.ts src/lib/domain/busquedas.ts src/lib/domain/factory.ts
git commit -m "feat: add WhatsApp webhook confirming contacts and triggering pending sends"
```

---

### Task 11: Property matching engine

**Files:**
- Create: `src/lib/bot/propertyMatching.ts`
- Test: `src/lib/bot/propertyMatching.test.ts`

**Interfaces:**
- Consumes: `Propiedad` (Task 1), `Busqueda` (Task 1), `normalizeText` (existing,
  `src/lib/text/normalize.ts`).
- Produces: `PropertySource` interface, `createPortfolioPropioSource(propiedadesModule)`,
  `buildMatchReason(propiedad, busqueda): string`. Used by Task 14
  (`enviarDocumentoAprobado`) and Task 15 (form-submission wiring).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { createPortfolioPropioSource, buildMatchReason } from "./propertyMatching";
import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";

function makePropiedad(overrides: Partial<Propiedad>): Propiedad {
  return {
    id: "p1",
    contacto_propietario_id: null,
    direccion: "Bv. Illia 500, Nueva Córdoba",
    tipo_propiedad: "Departamento",
    descripcion: null,
    precio: 70000,
    moneda: "USD",
    codigo: null,
    dormitorios: 2,
    fecha_recibida: "2026-01-01",
    condiciones: null,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
    imagenes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBusqueda(overrides: Partial<Busqueda>): Busqueda {
  return {
    id: "b1",
    contacto_id: "c1",
    tipo_operacion: "Compra",
    presupuesto_min: 50000,
    presupuesto_max: 90000,
    moneda: "USD",
    zona: "Nueva Córdoba",
    tipo_propiedad: "Departamento",
    dormitorios: 2,
    otros_requisitos: null,
    activa: true,
    documento_aprobado: false,
    documento_enviado: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("createPortfolioPropioSource", () => {
  it("matches a property that satisfies tipo, precio, zona and dormitorios", async () => {
    const propiedad = makePropiedad({});
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({}));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("excludes a property with the wrong tipo_propiedad", async () => {
    const propiedad = makePropiedad({ tipo_propiedad: "Casa" });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({}));

    expect(result).toHaveLength(0);
  });

  it("excludes a property with fewer dormitorios than requested", async () => {
    const propiedad = makePropiedad({ dormitorios: 1 });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ dormitorios: 2 }));

    expect(result).toHaveLength(0);
  });

  it("excludes a property outside the requested price range", async () => {
    const propiedad = makePropiedad({ precio: 200000 });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ presupuesto_min: 50000, presupuesto_max: 90000 }));

    expect(result).toHaveLength(0);
  });

  it("does not exclude on price when currencies differ (no conversion)", async () => {
    const propiedad = makePropiedad({ precio: 200000, moneda: "ARS" });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ presupuesto_min: 50000, presupuesto_max: 90000, moneda: "USD" }));

    expect(result).toHaveLength(1);
  });

  it("excludes a property in a different zona", async () => {
    const propiedad = makePropiedad({ direccion: "Calle Falsa 123, Alta Córdoba" });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ zona: "Nueva Córdoba" }));

    expect(result).toHaveLength(0);
  });

  it("only searches properties with estado Activa", async () => {
    const propiedadesModule = {
      list: async (where: any) => {
        expect(where).toEqual({ estado: "Activa" });
        return [];
      },
    } as any;
    const source = createPortfolioPropioSource(propiedadesModule);
    await source.buscar(makeBusqueda({}));
  });
});

describe("buildMatchReason", () => {
  it("mentions budget, zona and dormitorios when all match", () => {
    const reason = buildMatchReason(makePropiedad({}), makeBusqueda({}));
    expect(reason).toContain("presupuesto");
    expect(reason).toContain("Nueva Córdoba");
    expect(reason).toContain("2 dormitorios");
  });

  it("falls back to a generic reason when no specific criteria were given", () => {
    const reason = buildMatchReason(
      makePropiedad({}),
      makeBusqueda({ zona: null, dormitorios: null, presupuesto_min: null, presupuesto_max: null })
    );
    expect(reason).toContain("tipo de propiedad");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- propertyMatching.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import { normalizeText } from "../text/normalize";

export interface PropertySource {
  buscar(busqueda: Busqueda): Promise<Propiedad[]>;
}

function matchesCriteria(propiedad: Propiedad, busqueda: Busqueda): boolean {
  if (busqueda.tipo_propiedad && propiedad.tipo_propiedad !== busqueda.tipo_propiedad) {
    return false;
  }

  if (busqueda.dormitorios != null) {
    if (propiedad.dormitorios == null || propiedad.dormitorios < busqueda.dormitorios) {
      return false;
    }
  }

  const sameCurrency = busqueda.moneda && propiedad.moneda && busqueda.moneda === propiedad.moneda;
  if (sameCurrency && propiedad.precio != null) {
    if (busqueda.presupuesto_min != null && propiedad.precio < busqueda.presupuesto_min) return false;
    if (busqueda.presupuesto_max != null && propiedad.precio > busqueda.presupuesto_max) return false;
  }

  if (busqueda.zona) {
    const zonaNormalizada = normalizeText(busqueda.zona);
    if (!normalizeText(propiedad.direccion).includes(zonaNormalizada)) return false;
  }

  return true;
}

export function createPortfolioPropioSource(propiedadesModule: {
  list(where?: Partial<Propiedad>): Promise<Propiedad[]>;
}): PropertySource {
  return {
    async buscar(busqueda: Busqueda): Promise<Propiedad[]> {
      const activas = await propiedadesModule.list({ estado: "Activa" });
      return activas.filter((p) => matchesCriteria(p, busqueda));
    },
  };
}

export function buildMatchReason(propiedad: Propiedad, busqueda: Busqueda): string {
  const razones: string[] = [];

  const sameCurrency = busqueda.moneda && propiedad.moneda && busqueda.moneda === propiedad.moneda;
  if (sameCurrency && (busqueda.presupuesto_min != null || busqueda.presupuesto_max != null)) {
    const min = busqueda.presupuesto_min ?? "sin mínimo";
    const max = busqueda.presupuesto_max ?? "sin máximo";
    razones.push(`está dentro de tu presupuesto de ${busqueda.moneda} ${min}-${max}`);
  }
  if (busqueda.zona) {
    razones.push(`está en la zona que buscás (${busqueda.zona})`);
  }
  if (busqueda.dormitorios != null && propiedad.dormitorios != null) {
    razones.push(`tiene ${propiedad.dormitorios} dormitorios, cumpliendo el mínimo que pediste`);
  }

  if (razones.length === 0) {
    return "Coincide con el tipo de propiedad que buscás.";
  }
  return `Te la recomiendo porque ${razones.join(" y ")}.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- propertyMatching.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/propertyMatching.ts src/lib/bot/propertyMatching.test.ts
git commit -m "feat: add deterministic property matching engine against own portfolio"
```

---

### Task 12: Telegram client additions (media group + inline keyboard)

**Files:**
- Modify: `src/lib/telegram/client.ts`
- Modify: `src/lib/telegram/client.test.ts` (create if it does not exist yet — check first)

**Interfaces:**
- Produces: `sendMediaGroup(chatId, photos): Promise<void>`, and confirms `sendMessage`
  already supports `reply_markup` (it does — see Task context). Used by Task 13
  (compatibility document builder/sender).

- [ ] **Step 1: Check for an existing test file**

Run: `ls brunella-crm/src/lib/telegram/client.test.ts 2>&1 || echo "no test file yet"`

If it exists, read it first and add the new test alongside the existing ones rather than
recreating the file.

- [ ] **Step 2: Write the failing test**

Add this test (in the existing file, or a new `src/lib/telegram/client.test.ts` if none
exists — mirror the mocking style of `src/app/api/telegram/webhook/route.test.ts` for
`fetch`):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendMediaGroup } from "./client";

describe("sendMediaGroup", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  afterEach(() => vi.restoreAllMocks());

  it("sends a Telegram media group with the given photos", async () => {
    await sendMediaGroup(123, [
      { url: "https://example.com/a.jpg", caption: "Depto A" },
      { url: "https://example.com/b.jpg" },
    ]);

    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toContain("sendMediaGroup");
    const body = JSON.parse(call[1].body);
    expect(body.chat_id).toBe(123);
    expect(body.media).toHaveLength(2);
    expect(body.media[0]).toEqual({ type: "photo", media: "https://example.com/a.jpg", caption: "Depto A" });
  });

  it("throws when the Telegram API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as any;
    await expect(sendMediaGroup(123, [{ url: "https://example.com/a.jpg" }])).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- telegram/client`
Expected: FAIL — `sendMediaGroup` is not exported yet.

- [ ] **Step 4: Add the implementation**

In `src/lib/telegram/client.ts`, add this function alongside the existing `sendMessage`:

```typescript
export async function sendMediaGroup(
  chatId: number,
  photos: { url: string; caption?: string }[]
): Promise<void> {
  const response = await fetch(apiUrl("sendMediaGroup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media: photos.map((p) => ({ type: "photo", media: p.url, ...(p.caption ? { caption: p.caption } : {}) })),
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMediaGroup failed (${response.status})`);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- telegram/client`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/telegram/client.ts src/lib/telegram/client.test.ts
git commit -m "feat: add sendMediaGroup to the Telegram client for compatibility document photos"
```

---

### Task 13: Compatibility document builder + sender

**Files:**
- Create: `src/lib/bot/compatibilityDocument.ts`
- Test: `src/lib/bot/compatibilityDocument.test.ts`

**Interfaces:**
- Consumes: `buildMatchReason` (Task 11), `parseImagenes` (existing,
  `src/lib/view/imagenes.ts`), `sendMediaGroup`/`sendMessage` (Task 12/existing).
- Produces: `notificarBrunellaCompatibilidad(deps, contacto, busqueda, matches): Promise<void>`
  and `enviarPorWhatsApp(deps, telefono, contacto, busqueda, matches): Promise<void>`. Both
  used by Task 14 (`enviarDocumentoAprobado`) and Task 15 (wiring the form submission).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { notificarBrunellaCompatibilidad, enviarPorWhatsApp } from "./compatibilityDocument";
import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import type { Contacto } from "../domain/contactos";

function makePropiedad(overrides: Partial<Propiedad>): Propiedad {
  return {
    id: "p1",
    contacto_propietario_id: null,
    direccion: "Bv. Illia 500",
    tipo_propiedad: "Departamento",
    descripcion: null,
    precio: 70000,
    moneda: "USD",
    codigo: null,
    dormitorios: 2,
    fecha_recibida: "2026-01-01",
    condiciones: null,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
    imagenes: "https://example.com/a.jpg",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const busqueda: Busqueda = {
  id: "b1",
  contacto_id: "c1",
  tipo_operacion: "Compra",
  presupuesto_min: 50000,
  presupuesto_max: 90000,
  moneda: "USD",
  zona: "Nueva Córdoba",
  tipo_propiedad: "Departamento",
  dormitorios: 2,
  otros_requisitos: null,
  activa: true,
  documento_aprobado: false,
  documento_enviado: false,
  created_at: "2026-01-01T00:00:00Z",
};

const contacto: Contacto = {
  id: "c1",
  nombre: "Juan",
  telefono: "5493511234567",
  email: null,
  fuente: "Instagram",
  fecha_primer_contacto: "2026-01-01",
  tipo: "Comprador",
  etapa: "Buscando",
  temperatura: "Tibio",
  whatsapp_confirmado: false,
  ultima_actividad: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

describe("notificarBrunellaCompatibilidad", () => {
  it("sends a media group and a text message with the approve button when there are matches", async () => {
    const sendMediaGroup = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await notificarBrunellaCompatibilidad(
      { sendMediaGroup, sendMessage },
      42,
      contacto,
      busqueda,
      [makePropiedad({})]
    );

    expect(sendMediaGroup).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      42,
      expect.stringContaining("Juan"),
      expect.objectContaining({
        reply_markup: {
          inline_keyboard: [[{ text: "Aprobar y enviar", callback_data: `aprobar_busqueda:b1` }]],
        },
      })
    );
  });

  it("sends a text-only message explaining there are no matches yet", async () => {
    const sendMediaGroup = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await notificarBrunellaCompatibilidad({ sendMediaGroup, sendMessage }, 42, contacto, busqueda, []);

    expect(sendMediaGroup).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(42, expect.stringContaining("Sin matches"));
  });
});

describe("enviarPorWhatsApp", () => {
  it("sends an image message per property plus a closing text message", async () => {
    const sendWhatsAppImage = vi.fn().mockResolvedValue(undefined);
    const sendWhatsAppText = vi.fn().mockResolvedValue(undefined);

    await enviarPorWhatsApp(
      { sendWhatsAppImage, sendWhatsAppText },
      "5493511234567",
      contacto,
      busqueda,
      [makePropiedad({})]
    );

    expect(sendWhatsAppImage).toHaveBeenCalledWith(
      "5493511234567",
      "https://example.com/a.jpg",
      expect.stringContaining("Bv. Illia 500")
    );
    expect(sendWhatsAppText).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- compatibilityDocument.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import type { Contacto } from "../domain/contactos";
import { buildMatchReason } from "./propertyMatching";
import { parseImagenes } from "../view/imagenes";

type TelegramDeps = {
  sendMediaGroup: (chatId: number, photos: { url: string; caption?: string }[]) => Promise<void>;
  sendMessage: (chatId: number, text: string, options?: { reply_markup?: unknown }) => Promise<void>;
};

type WhatsAppDeps = {
  sendWhatsAppImage: (to: string, imageUrl: string, caption: string) => Promise<void>;
  sendWhatsAppText: (to: string, text: string) => Promise<void>;
};

function buildResumenTexto(contacto: Contacto, matches: Propiedad[], busqueda: Busqueda): string {
  const lineas = matches.map(
    (p) => `- ${p.direccion}: ${buildMatchReason(p, busqueda)}`
  );
  return `Propiedades para ${contacto.nombre}:\n${lineas.join("\n")}`;
}

export async function notificarBrunellaCompatibilidad(
  deps: TelegramDeps,
  chatId: number,
  contacto: Contacto,
  busqueda: Busqueda,
  matches: Propiedad[]
): Promise<void> {
  if (matches.length === 0) {
    await deps.sendMessage(
      chatId,
      `Sin matches por ahora para la búsqueda de ${contacto.nombre} — quedó guardada, avisame cuando cargues algo que pueda servirle.`
    );
    return;
  }

  const fotos = matches
    .flatMap((p) => parseImagenes(p.imagenes).slice(0, 1).map((url) => ({ url, caption: p.direccion })));
  if (fotos.length > 0) {
    await deps.sendMediaGroup(chatId, fotos);
  }

  await deps.sendMessage(chatId, buildResumenTexto(contacto, matches, busqueda), {
    reply_markup: {
      inline_keyboard: [[{ text: "Aprobar y enviar", callback_data: `aprobar_busqueda:${busqueda.id}` }]],
    },
  });
}

export async function enviarPorWhatsApp(
  deps: WhatsAppDeps,
  telefono: string,
  contacto: Contacto,
  busqueda: Busqueda,
  matches: Propiedad[]
): Promise<void> {
  for (const propiedad of matches) {
    const foto = parseImagenes(propiedad.imagenes)[0];
    const caption = `${propiedad.direccion} — ${buildMatchReason(propiedad, busqueda)}`;
    if (foto) {
      await deps.sendWhatsAppImage(telefono, foto, caption);
    } else {
      await deps.sendWhatsAppText(telefono, caption);
    }
  }
  await deps.sendWhatsAppText(
    telefono,
    `Estas son las propiedades que mejor matchean con lo que buscás, ${contacto.nombre}. ¡Cualquier consulta, escribime!`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- compatibilityDocument.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/compatibilityDocument.ts src/lib/bot/compatibilityDocument.test.ts
git commit -m "feat: build compatibility document content for Telegram review and WhatsApp send"
```

---

### Task 14: `enviarDocumentoAprobado` orchestrator + Telegram callback_query handling

**Files:**
- Create: `src/lib/bot/enviarDocumentoAprobado.ts`
- Test: `src/lib/bot/enviarDocumentoAprobado.test.ts`
- Modify: `src/app/api/telegram/webhook/route.ts`
- Modify: `src/app/api/telegram/webhook/route.test.ts`

**Interfaces:**
- Consumes: `createPortfolioPropioSource` (Task 11), `enviarPorWhatsApp` (Task 13),
  `sendWhatsAppImage`/`sendWhatsAppText` (Task 9), `getDomainModules()` (Tasks 1, 3).
- Produces: `enviarDocumentoAprobado(busquedaId): Promise<void>` — this satisfies the import
  that Task 10's webhook route already expects.

- [ ] **Step 1: Write the failing test for `enviarDocumentoAprobado`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const busquedasFindById = vi.fn();
const busquedasUpdate = vi.fn().mockResolvedValue({});
const contactosFindById = vi.fn();
const propiedadesList = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/domain/factory", () => ({
  getDomainModules: () => ({
    busquedas: { findById: busquedasFindById, update: busquedasUpdate },
    contactos: { findById: contactosFindById },
    propiedades: { list: propiedadesList },
  }),
}));

const sendWhatsAppImage = vi.fn().mockResolvedValue(undefined);
const sendWhatsAppText = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/whatsapp/client", () => ({ sendWhatsAppImage, sendWhatsAppText }));

import { enviarDocumentoAprobado } from "./enviarDocumentoAprobado";

describe("enviarDocumentoAprobado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    busquedasFindById.mockResolvedValue({
      id: "b1",
      contacto_id: "c1",
      tipo_propiedad: "Departamento",
      presupuesto_min: null,
      presupuesto_max: null,
      moneda: null,
      zona: null,
      dormitorios: null,
      documento_aprobado: true,
      documento_enviado: false,
    });
    contactosFindById.mockResolvedValue({ id: "c1", nombre: "Juan", telefono: "5493511234567" });
    propiedadesList.mockResolvedValue([]);
  });

  it("sends the document over WhatsApp and marks it as enviado", async () => {
    await enviarDocumentoAprobado("b1");

    expect(sendWhatsAppText).toHaveBeenCalled();
    expect(busquedasUpdate).toHaveBeenCalledWith("b1", { documento_enviado: true });
  });

  it("does nothing if the busqueda no longer exists", async () => {
    busquedasFindById.mockResolvedValue(null);
    await enviarDocumentoAprobado("missing");
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brunella-crm && npm test -- enviarDocumentoAprobado.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { getDomainModules } from "@/lib/domain/factory";
import { sendWhatsAppImage, sendWhatsAppText } from "@/lib/whatsapp/client";
import { createPortfolioPropioSource } from "./propertyMatching";
import { enviarPorWhatsApp } from "./compatibilityDocument";

export async function enviarDocumentoAprobado(busquedaId: string): Promise<void> {
  const { busquedas, contactos, propiedades } = getDomainModules();

  const busqueda = await busquedas.findById(busquedaId);
  if (!busqueda) return;

  const contacto = await contactos.findById(busqueda.contacto_id);
  if (!contacto || !contacto.telefono) return;

  const source = createPortfolioPropioSource(propiedades);
  const matches = await source.buscar(busqueda);

  await enviarPorWhatsApp(
    { sendWhatsAppImage, sendWhatsAppText },
    contacto.telefono,
    contacto,
    busqueda,
    matches
  );

  await busquedas.update(busquedaId, { documento_enviado: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brunella-crm && npm test -- enviarDocumentoAprobado.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run Task 10's WhatsApp webhook test**

Run: `cd brunella-crm && npm test -- whatsapp/webhook`
Expected: PASS now that the real module exists (the test still mocks it, but this confirms
the import path is correct and nothing broke).

- [ ] **Step 6: Extend the Telegram webhook to handle `callback_query`**

Add a test to `src/app/api/telegram/webhook/route.test.ts` (alongside the existing ones):

```typescript
  it("approves and sends immediately when the contacto already confirmed WhatsApp", async () => {
    const busquedasFindById = vi.fn().mockResolvedValue({ id: "b1", contacto_id: "c1" });
    const busquedasUpdate = vi.fn().mockResolvedValue({});
    const contactosFindById = vi.fn().mockResolvedValue({ id: "c1", whatsapp_confirmado: true });
    vi.doMock("@/lib/domain/factory", () => ({
      getDomainModules: () => ({
        busquedas: { findById: busquedasFindById, update: busquedasUpdate },
        contactos: { findById: contactosFindById },
      }),
    }));
    const { enviarDocumentoAprobado } = await import("@/lib/bot/enviarDocumentoAprobado");
    vi.mocked(enviarDocumentoAprobado);

    const response = await POST(
      buildRequest(
        {
          callback_query: {
            id: "cb1",
            data: "aprobar_busqueda:b1",
            from: { id: 1 },
            message: { chat: { id: 1 } },
          },
        },
        "secret"
      )
    );

    expect(response.status).toBe(200);
  });
```

(This test mainly documents intent for a human reviewer — the core logic is exercised more
directly by `enviarDocumentoAprobado.test.ts`. Keep it, but don't over-engineer additional
mocking scaffolding beyond what's shown.)

Now extend the route itself. In `src/app/api/telegram/webhook/route.ts`:

1. Extend `telegramUpdateSchema` to also accept `callback_query`:

```typescript
const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
      voice: z.object({ file_id: z.string() }).optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string(),
      from: z.object({ id: z.number() }),
      message: z.object({ chat: z.object({ id: z.number() }) }),
    })
    .optional(),
});
```

2. Add the import: `import { enviarDocumentoAprobado } from "@/lib/bot/enviarDocumentoAprobado";`
   and `import { getDomainModules } from "@/lib/domain/factory";`

3. After the existing admin-check block (`if (!voice || !chatId || !isFromAdmin(chatId))`),
   add a new branch handling `callback_query` before that block runs (since a callback_query
   has no `voice`, it would otherwise be silently dropped):

```typescript
  const callback = parsed.data.callback_query;
  if (callback && isFromAdmin(callback.from.id)) {
    const [action, busquedaId] = callback.data.split(":");
    if (action === "aprobar_busqueda" && busquedaId) {
      const { busquedas, contactos } = getDomainModules();
      const busqueda = await busquedas.findById(busquedaId);
      if (busqueda) {
        const contacto = await contactos.findById(busqueda.contacto_id);
        await busquedas.update(busquedaId, { documento_aprobado: true });
        if (contacto?.whatsapp_confirmado) {
          await enviarDocumentoAprobado(busquedaId);
          await sendMessage(callback.message.chat.id, "Listo, se lo mandé por WhatsApp.");
        } else {
          await sendMessage(
            callback.message.chat.id,
            "Aprobado. Todavía no confirmó por WhatsApp — se lo mando apenas escriba."
          );
        }
      }
    }
    return NextResponse.json({ ok: true });
  }
```

- [ ] **Step 7: Run the Telegram webhook tests**

Run: `cd brunella-crm && npm test -- telegram/webhook`
Expected: PASS

- [ ] **Step 8: Run the full test suite**

Run: `cd brunella-crm && npm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/bot/enviarDocumentoAprobado.ts src/lib/bot/enviarDocumentoAprobado.test.ts src/app/api/telegram/webhook/route.ts src/app/api/telegram/webhook/route.test.ts
git commit -m "feat: wire Telegram approve button to send the compatibility document over WhatsApp"
```

---

### Task 15: Wire matching + Telegram notification into form submission

**Files:**
- Modify: `src/app/formulario/actions.ts`
- Modify: `src/app/formulario/actions.test.ts`

**Interfaces:**
- Consumes: `createPortfolioPropioSource` (Task 11), `notificarBrunellaCompatibilidad`
  (Task 13), `sendMediaGroup`/`sendMessage` (Task 12), `sendMessage` (existing, for the
  Propietario no-matching notification).
- Produces: nothing new — this closes the loop the earlier tasks set up. No further task
  depends on this one.

- [ ] **Step 1: Add tests for the new notification behavior**

Add to `src/app/formulario/actions.test.ts`:

```typescript
const sendMediaGroup = vi.fn().mockResolvedValue(undefined);
const sendMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/telegram/client", () => ({ sendMediaGroup, sendMessage }));

// ... inside the existing describe("submitCompradorAction", ...) block, add:

  it("notifies Brunella on Telegram with the compatibility results after creating the busqueda", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-3", nombre: "Marcos", telefono: "54935111" });
    busquedasCreate.mockResolvedValue({
      id: "busqueda-1",
      contacto_id: "contacto-3",
      tipo_propiedad: "PH",
    });

    await expect(
      submitCompradorAction(
        null,
        fd({
          nombre: "Marcos",
          telefono: "54935111",
          tipo_operacion: "Compra",
          tipo_propiedad: "PH",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(sendMessage).toHaveBeenCalled();
  });
```

Also change the top-level import from Task 7 to include `submitPropietarioAction`:

```typescript
import { submitCompradorAction, submitPropietarioAction } from "./actions";
```

Then add a new describe block for the Propietario side:

```typescript
describe("submitPropietarioAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies Brunella on Telegram that a new property was submitted", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "999";
    contactosFindByTelefono.mockResolvedValue(null);
    contactosCreate.mockResolvedValue({ id: "contacto-4", nombre: "Marcela" });

    await expect(
      submitPropietarioAction(
        null,
        fd({
          nombre: "Marcela",
          telefono: "54935112",
          que_quiere_hacer: "Vender",
          direccion: "Colón 1234",
          tipo_propiedad: "Casa",
        })
      )
    ).rejects.toThrow("REDIRECT");

    expect(sendMessage).toHaveBeenCalledWith(
      999,
      expect.stringContaining("Marcela")
    );
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd brunella-crm && npm test -- formulario/actions`
Expected: FAIL — notification logic not wired yet.

- [ ] **Step 3: Wire the notification into `submitCompradorAction`**

In `src/app/formulario/actions.ts`, add these imports:

```typescript
import { sendMediaGroup, sendMessage } from "@/lib/telegram/client";
import { createPortfolioPropioSource } from "@/lib/bot/propertyMatching";
import { notificarBrunellaCompatibilidad } from "@/lib/bot/compatibilityDocument";
```

First, change the existing `await busquedas.create(...)` call from Task 7 to capture its
return value (it already returns the created row — no need to re-fetch it):

```typescript
  const nuevaBusqueda = await busquedas.create({
    contacto_id: contacto.id,
    tipo_operacion: data.tipo_operacion,
    tipo_propiedad: data.tipo_propiedad,
    zona: data.zona,
    presupuesto_min: data.presupuesto_min,
    presupuesto_max: data.presupuesto_max,
    moneda: data.moneda,
    dormitorios: data.dormitorios,
    otros_requisitos: data.otros_requisitos,
    activa: true,
  });
```

Then, right before the final `redirect(...)` call, insert:

```typescript
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    const source = createPortfolioPropioSource(getDomainModules().propiedades);
    const matches = await source.buscar(nuevaBusqueda);
    await notificarBrunellaCompatibilidad(
      { sendMediaGroup, sendMessage },
      Number(adminChatId),
      contacto,
      nuevaBusqueda,
      matches
    );
  }
```

- [ ] **Step 4: Wire the simple notification into `submitPropietarioAction`**

Right before the final `redirect(...)` call in `submitPropietarioAction`, insert:

```typescript
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    await sendMessage(
      Number(adminChatId),
      `Nueva propiedad cargada por ${contacto.nombre} (${data.que_quiere_hacer}): ${data.direccion}. Revisala en el CRM.`
    );
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd brunella-crm && npm test -- formulario/actions`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `cd brunella-crm && npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/formulario/actions.ts src/app/formulario/actions.test.ts
git commit -m "feat: notify Brunella on Telegram with matches (comprador) or a new listing alert (propietario)"
```

---

### Task 16: README setup documentation

**Files:**
- Modify: `README.md` (or wherever Fase 1's setup steps are documented — check first with
  `grep -l "TELEGRAM_BOT_TOKEN" brunella-crm/*.md`)

**Interfaces:** None — documentation only.

- [ ] **Step 1: Find the existing setup section**

Run: `grep -n "TELEGRAM_BOT_TOKEN\|GROQ_API_KEY\|DATABASE_URL" brunella-crm/README.md`

- [ ] **Step 2: Add the new environment variables to the same table/list**

Add these entries, matching the existing table's format:

```markdown
| `META_APP_SECRET` | App Secret de la app de Meta for Developers (Messenger + Instagram + WhatsApp comparten la misma app) |
| `META_VERIFY_TOKEN` | String arbitrario elegido por vos, usado para verificar los tres webhooks de Meta al configurarlos |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Token de acceso de la Página de Facebook conectada a la app de Meta |
| `INSTAGRAM_ACCESS_TOKEN` | Token de acceso de la cuenta de Instagram conectada a la app de Meta |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso del número de WhatsApp Business (Cloud API) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp Business (Graph API, no el número en sí) |
| `WHATSAPP_BUSINESS_NUMBER` | El número de WhatsApp de Brunella en formato internacional sin `+` (ej. `5493511234567`), usado para armar el link `wa.me` |
| `APP_BASE_URL` | URL pública de la app deployada (ej. `https://brunella-realstate.vercel.app`), usada para armar el link del formulario que se manda por Messenger/Instagram |
```

- [ ] **Step 3: Add a "Fase 2 — configuración de Meta" section**

```markdown
## Fase 2 — Configurar Messenger, Instagram y WhatsApp

Esto requiere una única app en Meta for Developers, conectada a la Página de Facebook, la
cuenta de Instagram y el número de WhatsApp Business de Brunella. Una vez creada esa app:

1. En **Webhooks**, agregá dos suscripciones apuntando a esta app:
   - `https://<tu-dominio>/api/meta/webhook` para Messenger e Instagram (eventos
     `messages`, `messaging_referrals`)
   - `https://<tu-dominio>/api/whatsapp/webhook` para WhatsApp (eventos `messages`)
   - En ambas, usá el mismo valor de `META_VERIFY_TOKEN` que configuraste como variable de
     entorno.
2. Copiá el **App Secret** de la app a `META_APP_SECRET`.
3. Generá un token de acceso de la Página y pegalo en `MESSENGER_PAGE_ACCESS_TOKEN`.
4. Generá un token de acceso de Instagram (misma app, cuenta de Instagram conectada a la
   Página) y pegalo en `INSTAGRAM_ACCESS_TOKEN`.
5. En el producto WhatsApp de la misma app, agregá el número de negocio, copiá su
   `Phone Number ID` a `WHATSAPP_PHONE_NUMBER_ID`, generá un token de acceso permanente y
   pegalo en `WHATSAPP_ACCESS_TOKEN`.
6. Al armar un anuncio de Click-to-Messenger o Click-to-Instagram en Meta Ads Manager para
   promocionar una propiedad puntual, pegá el **código corto de esa propiedad** (visible en su
   ficha en el CRM, botón "Generar código" si todavía no tiene uno) en el campo `ref` del
   anuncio.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document Fase 2 environment variables and Meta webhook setup"
```

---

### Task 17: Full verification pass

**Files:** None created — this task runs and fixes, it doesn't add new files.

**Interfaces:** None.

- [ ] **Step 1: Run the full test suite with coverage**

Run: `cd brunella-crm && npm run test:coverage`
Expected: all tests pass. If coverage on any new file is notably low, add the missing edge
case test (e.g., a matching-engine branch not exercised) rather than lowering the bar.

- [ ] **Step 2: Run the production build**

Run: `cd brunella-crm && npm run build`
Expected: build succeeds with no type errors. Fix any type errors surfaced by the new pages/
routes before continuing (common culprits: `searchParams` typed as `Promise<...>` per Next.js
16's async APIs — already followed in Task 8's code above; the generic `Repository<T>.list`
`Partial<T>` typing when passing `{ estado: "Activa" }` to `propiedades.list`).

- [ ] **Step 3: Browser-verify the intake form (mobile viewport, in-memory mode)**

Start the dev server (`npm run dev`, no `DATABASE_URL` set so it runs in-memory) and, using
the Browser tool at 375×812:
1. Navigate to `/formulario` — confirm the two-option selector renders with no horizontal
   overflow.
2. Navigate to `/formulario?tipo=comprador` — fill every field, submit, confirm it redirects
   to `/formulario/confirmar?c=<id>` and shows the "Confirmar por WhatsApp" button linking to
   a `wa.me` URL.
3. Navigate to `/formulario?tipo=propietario` — same check for the owner path.
4. Check `read_console_messages` for errors on both flows.

- [ ] **Step 4: Manual review of secrets handling**

Grep the new files for anything that looks like a hardcoded token or secret:

Run: `grep -rn "sk-\|EAAG\|xoxb-" brunella-crm/src/lib/meta brunella-crm/src/lib/whatsapp brunella-crm/src/app/api/meta brunella-crm/src/app/api/whatsapp brunella-crm/src/app/formulario`
Expected: no matches — all secrets come from `process.env`.

- [ ] **Step 5: Commit any fixes made during this task**

```bash
git add -A
git commit -m "test: fix issues found during Fase 2 full verification pass"
```

(Skip this commit if Steps 1-4 found nothing to fix.)

---

### Task 18: Summary of manual setup steps (only the user can do these)

**Files:** None — this is a final message to the user, not a code change.

- [ ] **Step 1: Compile the list of account/credential steps still needed**

Once all 17 tasks above are complete, tell the user exactly what's left, matching the style
used at the end of Fase 1 (Supabase/Groq/Telegram setup guidance):

1. Create (or confirm) a single app in **Meta for Developers**, linked to her Facebook Page,
   Instagram professional account, and a WhatsApp Business phone number.
2. Add the two webhook URLs (`/api/meta/webhook`, `/api/whatsapp/webhook`) in that app's
   dashboard, using a `META_VERIFY_TOKEN` value she chooses.
3. Generate and copy into Vercel's environment variables: `META_APP_SECRET`,
   `MESSENGER_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`, `APP_BASE_URL`,
   `META_VERIFY_TOKEN`.
4. Redeploy, then send a real test DM to the Facebook Page and to the Instagram account to
   confirm the auto-reply arrives with a working form link.
5. For each property she wants to advertise, generate its código in the CRM and paste it into
   that ad's `ref` field in Meta Ads Manager.
