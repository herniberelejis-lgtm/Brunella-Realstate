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
