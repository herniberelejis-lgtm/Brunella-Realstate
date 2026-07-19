import { submitCompradorAction } from "./actions";
import { BrandMark } from "./BrandMark";
import { ZONAS_CORDOBA } from "./zonasCordoba";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#E4D8C3] bg-white px-4 py-3 text-base text-[#2B2620] placeholder:text-[#B8AC96] focus:border-[#C9A24B] focus:outline-none focus:ring-2 focus:ring-[#C9A24B]/25";
const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9C7A2E]";
const fieldWrap = "";

export function CompradorForm({ token, showError }: { token: string | null; showError: boolean }) {
  const action = submitCompradorAction.bind(null, token);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-col items-center gap-6 text-center">
        <BrandMark />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-[#9C7A2E]">
            BUSCÁ TU PROPIEDAD
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl text-[#2B2620] sm:text-4xl">
            Contame qué estás buscando
          </h1>
          <p className="mt-2 font-[family-name:var(--font-fraunces)] text-lg italic text-[#6B5F4C]">
            y te acerco las mejores opciones.
          </p>
        </div>
      </div>

      {showError && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">
          Revisá los datos obligatorios e intentá de nuevo.
        </p>
      )}

      <form
        action={action}
        className="rounded-2xl border border-[#EFE3CE] bg-white/80 p-6 shadow-[0_8px_30px_rgba(120,95,40,0.08)] sm:p-10"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="tipo_operacion">
              Tipo de operación
            </label>
            <select id="tipo_operacion" name="tipo_operacion" className={inputClass} defaultValue="Compra">
              <option value="Compra">Comprar</option>
              <option value="Alquiler">Alquilar</option>
              <option value="Inversion">Inversión</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="presupuesto_max">
              Presupuesto
            </label>
            <div className="mt-1.5 flex gap-2">
              <select name="moneda" defaultValue="USD" className={`${inputClass} mt-0 w-24 flex-none`}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                id="presupuesto_max"
                name="presupuesto_max"
                type="number"
                placeholder="Ej. 150.000"
                className={`${inputClass} mt-0`}
              />
            </div>
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="zona">
              Zona / barrio
            </label>
            <input
              id="zona"
              name="zona"
              type="text"
              list="zonas-cordoba"
              placeholder="Córdoba, Nueva Córdoba..."
              className={inputClass}
            />
            <datalist id="zonas-cordoba">
              {ZONAS_CORDOBA.map((zona) => (
                <option key={zona} value={zona} />
              ))}
            </datalist>
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="tipo_propiedad">
              Tipo de propiedad
            </label>
            <select id="tipo_propiedad" name="tipo_propiedad" className={inputClass} defaultValue="Departamento">
              <option value="Departamento">Departamento</option>
              <option value="Casa">Casa</option>
              <option value="PH">PH</option>
              <option value="Lote">Lote</option>
              <option value="Local/Oficina">Local/Oficina</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="dormitorios">
              Dormitorios
            </label>
            <select id="dormitorios" name="dormitorios" className={inputClass} defaultValue="">
              <option value="">Indistinto</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="nombre">
              Nombre
            </label>
            <input id="nombre" name="nombre" type="text" required className={inputClass} />
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="telefono">
              Teléfono / WhatsApp
            </label>
            <input id="telefono" name="telefono" type="tel" required className={inputClass} />
          </div>

          <div className={fieldWrap}>
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" className={inputClass} />
          </div>
        </div>

        <div className="mt-5">
          <label className={labelClass} htmlFor="otros_requisitos">
            Otros requisitos (opcional)
          </label>
          <textarea id="otros_requisitos" name="otros_requisitos" rows={3} className={inputClass} />
        </div>

        <button
          type="submit"
          className="mt-7 min-h-[52px] w-full rounded-full bg-[#C9A24B] px-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#B58F3E] active:scale-[0.99]"
        >
          Enviar mi búsqueda
        </button>
      </form>
    </main>
  );
}
