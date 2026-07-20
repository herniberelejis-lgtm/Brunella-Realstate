import { getPool } from "../db/pool";
import { createContactosModule, type Contacto } from "./contactos";
import { createPropiedadesModule, type Propiedad } from "./propiedades";
import { createBusquedasModule, type Busqueda } from "./busquedas";
import { createConversacionesModule, type Conversacion } from "./conversaciones";
import { createMuestrasModule, type Muestra } from "./muestras";
import { createConsultasModule, type Consulta } from "./consultas";
import { createOfertasModule, type Oferta } from "./ofertas";
import { createLeadsPendientesModule, type LeadPendiente } from "./leadsPendientes";
import { createInMemoryTable } from "./inMemoryStore";
import { CONTACTOS_SEED, PROPIEDADES_SEED } from "./seedData";
import { phoneMatches } from "../text/phone";
import { normalizeText } from "../text/normalize";

export type DomainModules = {
  contactos: ReturnType<typeof createContactosModule>;
  propiedades: ReturnType<typeof createPropiedadesModule>;
  busquedas: ReturnType<typeof createBusquedasModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
  muestras: ReturnType<typeof createMuestrasModule>;
  consultas: ReturnType<typeof createConsultasModule>;
  ofertas: ReturnType<typeof createOfertasModule>;
  leadsPendientes: ReturnType<typeof createLeadsPendientesModule>;
};

let cachedInMemoryModules: DomainModules | undefined;

function buildInMemoryModules(): DomainModules {
  const contactosTable = createInMemoryTable<Contacto>(CONTACTOS_SEED);
  const propiedadesTable = createInMemoryTable<Propiedad>(PROPIEDADES_SEED);
  const busquedasTable = createInMemoryTable<Busqueda>([]);
  const conversacionesTable = createInMemoryTable<Conversacion>([]);
  const muestrasTable = createInMemoryTable<Muestra>([]);
  const consultasTable = createInMemoryTable<Consulta>([]);
  const ofertasTable = createInMemoryTable<Oferta>([]);
  const leadsPendientesTable = createInMemoryTable<LeadPendiente>([]);

  return {
    contactos: {
      ...contactosTable,
      findByNombreLike: async (nombre: string) =>
        (await contactosTable.list()).filter((c) =>
          normalizeText(c.nombre).includes(normalizeText(nombre))
        ),
      findByTelefono: async (telefono: string) =>
        (await contactosTable.list()).find((c) => phoneMatches(c.telefono, telefono)) ?? null,
      findNecesitanSeguimiento: async () => [],
      marcarActividad: async () => {},
      marcarWhatsappConfirmado: async (id: string) => {
        const item = await contactosTable.findById(id);
        if (item) await contactosTable.update(id, { whatsapp_confirmado: true });
      },
    },
    propiedades: {
      ...propiedadesTable,
      findByDireccionLike: async (direccion: string) =>
        (await propiedadesTable.list()).filter((p) =>
          normalizeText(p.direccion).includes(normalizeText(direccion))
        ),
      findByCodigo: async (codigo: string) =>
        (await propiedadesTable.list()).find((p) => p.codigo === codigo) ?? null,
      withTotales: async (propiedad: Propiedad) => ({
        ...propiedad,
        consultas_totales: propiedad.consultas_historicas,
        visitas_totales: propiedad.visitas_historicas,
      }),
    },
    busquedas: {
      ...busquedasTable,
      findByContactoId: async (id: string) =>
        (await busquedasTable.list()).filter((b) => b.contacto_id === id),
      findPendienteAprobadoByContactoId: async (id: string) =>
        (await busquedasTable.list()).find(
          (b) => b.contacto_id === id && b.documento_aprobado && !b.documento_enviado
        ) ?? null,
    },
    conversaciones: {
      ...conversacionesTable,
      findByContactoId: async (id: string) =>
        (await conversacionesTable.list()).filter((c) => c.contacto_id === id),
      findContactoIdsByOrigen: async (origen: Conversacion["origen"]) => [
        ...new Set(
          (await conversacionesTable.list())
            .filter((c) => c.origen === origen)
            .map((c) => c.contacto_id)
        ),
      ],
    },
    muestras: {
      ...muestrasTable,
      findByContactoId: async (id: string) =>
        (await muestrasTable.list()).filter((m) => m.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await muestrasTable.list()).filter((m) => m.propiedad_id === id),
    },
    consultas: {
      ...consultasTable,
      findByContactoId: async (id: string) =>
        (await consultasTable.list()).filter((c) => c.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await consultasTable.list()).filter((c) => c.propiedad_id === id),
    },
    ofertas: {
      ...ofertasTable,
      findByContactoId: async (id: string) =>
        (await ofertasTable.list()).filter((o) => o.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await ofertasTable.list()).filter((o) => o.propiedad_id === id),
    },
    leadsPendientes: {
      ...leadsPendientesTable,
      findByToken: async (token: string) =>
        (await leadsPendientesTable.list()).find((l) => l.token === token) ?? null,
      marcarUsado: async (id: string) => {
        const item = await leadsPendientesTable.findById(id);
        if (item) await leadsPendientesTable.update(id, { usado: true });
      },
    },
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
    leadsPendientes: createLeadsPendientesModule(pool),
  };
}
