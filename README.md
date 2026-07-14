# Segundo Cerebro — Brunella Real Estate

CRM interno: bot de Telegram por nota de voz + dashboard web. Ver
`docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md` para el diseño completo y
`docs/superpowers/plans/2026-07-14-segundo-cerebro-fase1.md` para el plan de implementación.

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

## Stack técnico

Next.js 16 (App Router) + TypeScript + Tailwind, Postgres vía `pg` directo (hosteado en
Supabase, sin usar su SDK/Auth/Storage), Groq para transcripción y extracción de IA, Telegram
Bot API, Vercel para hosting + Cron. Tests con Vitest; `pg-mem` emula Postgres en los tests
sin necesitar Docker ni una cuenta real.

## Fases futuras (no incluidas acá)

- **Fase 2:** bot de búsqueda/filtrado de propiedades en portales (Zonaprop, Grupo Banker,
  Tokko) usando las Búsquedas ya cargadas.
- **Fase 3:** panel de métricas de redes (Meta Business) para uso propio de Brunella — no hay
  conector MCP disponible hoy; requiere una app de Meta for Developers y manejo de tokens.
