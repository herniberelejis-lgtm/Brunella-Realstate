import ExcelJS from "exceljs";
import { Pool } from "pg";

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

export async function parsePropiedadesFromExcel(
  filePath: string,
  contactoPropietarioId: string | null = null
): Promise<PropiedadInsert[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const propiedades: PropiedadInsert[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (key) record[key] = cell.value;
    });

    const tipo = TIPOS_VALIDOS.includes(String(record.tipo ?? ""))
      ? String(record.tipo)
      : "Departamento";

    propiedades.push({
      direccion:
        typeof record.direccion === "string" && record.direccion.length > 0
          ? record.direccion
          : `Propiedad importada #${rowNumber - 1} (confirmar dirección real)`,
      tipo_propiedad: tipo,
      descripcion: (record.descripcion as string) ?? null,
      precio: (record.precio as number) ?? null,
      fecha_recibida: record.fecha
        ? String(record.fecha).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      consultas_historicas: Number(record.consultas ?? 0),
      visitas_historicas: Number(record.visitas ?? 0),
      contacto_propietario_id: contactoPropietarioId,
    });
  });

  return propiedades;
}

async function main() {
  const [, , filePath, contactoPropietarioId] = process.argv;
  if (!filePath) {
    console.error("Uso: npm run import:excel -- <ruta-al-excel> [contacto-propietario-id]");
    process.exit(1);
  }

  const propiedades = await parsePropiedadesFromExcel(filePath, contactoPropietarioId ?? null);
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
