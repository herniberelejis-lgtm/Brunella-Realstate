import { submitPropietarioAction } from "./actions";
import { BrandMark } from "./BrandMark";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#E4D8C3] bg-white px-4 py-3 text-base text-[#2B2620] placeholder:text-[#B8AC96] focus:border-[#C9A24B] focus:outline-none focus:ring-2 focus:ring-[#C9A24B]/25";
const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9C7A2E]";

export function PropietarioForm({ token, showError }: { token: string | null; showError: boolean }) {
  const action = submitPropietarioAction.bind(null, token);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-col items-center gap-6 text-center">
        <BrandMark />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-[#9C7A2E]">
            PUBLICÁ TU PROPIEDAD
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl text-[#2B2620] sm:text-4xl">
            Contanos de tu propiedad
          </h1>
          <p className="mt-2 font-[family-name:var(--font-fraunces)] text-lg italic text-[#6B5F4C]">
            y te ayudamos a venderla o alquilarla.
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
          <div>
            <label className={labelClass} htmlFor="que_quiere_hacer">
              Qué querés hacer
            </label>
            <select id="que_quiere_hacer" name="que_quiere_hacer" className={inputClass} defaultValue="Vender">
              <option value="Vender">Vender</option>
              <option value="Alquilar">Alquilar</option>
              <option value="Alquiler temporario">Alquiler temporario</option>
            </select>
          </div>

          <div>
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

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="direccion">
              Dirección
            </label>
            <input id="direccion" name="direccion" type="text" required className={inputClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="precio">
              Precio
            </label>
            <div className="mt-1.5 flex gap-2">
              <select name="moneda" defaultValue="USD" className={`${inputClass} mt-0 w-24 flex-none`}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                id="precio"
                name="precio"
                type="number"
                placeholder="Ej. 150.000"
                className={`${inputClass} mt-0`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="nombre">
              Nombre
            </label>
            <input id="nombre" name="nombre" type="text" required className={inputClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="telefono">
              Teléfono / WhatsApp
            </label>
            <input id="telefono" name="telefono" type="tel" required className={inputClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" className={inputClass} />
          </div>
        </div>

        <div className="mt-5">
          <label className={labelClass} htmlFor="descripcion">
            Descripción (opcional)
          </label>
          <textarea id="descripcion" name="descripcion" rows={3} className={inputClass} />
        </div>

        <button
          type="submit"
          className="mt-7 min-h-[52px] w-full rounded-full bg-[#C9A24B] px-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#B58F3E] active:scale-[0.99]"
        >
          Enviar mi propiedad
        </button>
      </form>
    </main>
  );
}
