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
