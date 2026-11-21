import 'dotenv/config';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CategoriaComunicado,
  EstadoAcceso,
  EstadoAsamblea,
  EstadoAutorizacion,
  EstadoComunicado,
  EstadoCuota,
  EstadoPago,
  EstadoReporte,
  EstadoReserva,
  CategoriaReporte,
  Mensajeria,
  PrioridadReporte,
  PrismaClient,
  Rol,
  TipoDocumento,
} from '../src/generated/prisma/client.js';

/** Mismo cálculo que src/common/fechas (el seed corre fuera de Nest y no usa los alias). */
const ZONA_NEGOCIO = 'America/El_Salvador';
const hoyEnZonaNegocio = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const sumarDias = (iso: string, dias: number) =>
  new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * 86_400_000).toISOString().slice(0, 10);

/**
 * Contraseñas por rol, desde el entorno (nunca en el repo). En producción son
 * obligatorias; fuera de producción hay un valor por defecto solo-local.
 */
const esProduccion = process.env.NODE_ENV === 'production';
const passwordDe = (variable: string, porDefecto: string): string => {
  const valor = process.env[variable];
  if (valor) return valor;
  if (esProduccion) {
    throw new Error(`Seed abortado: falta la variable de entorno ${variable} (obligatoria con NODE_ENV=production).`);
  }
  return porDefecto;
};
const PASSWORDS: Record<Rol, string> = {
  [Rol.ADMINISTRADOR]: passwordDe('SEED_PASSWORD_ADMIN', 'admin-local-1234'),
  [Rol.RESIDENTE]: passwordDe('SEED_PASSWORD_RESIDENTE', 'residente-local-1234'),
  [Rol.SEGURIDAD]: passwordDe('SEED_PASSWORD_SEGURIDAD', 'seguridad-local-1234'),
};

/** UUID determinista a partir de una clave: permite upsert por id sin depender de campos únicos. */
const idFijo = (clave: string): string => {
  const h = createHash('sha1').update(`condominios-seed:${clave}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** PNG válido de 1x1 píxel para las fotos de ejemplo de los paquetes. */
const PNG_EJEMPLO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TORRES = ['Torre A', 'Torre B'];

const UNIDADES = [
  { codigo: 'A-101', torre: 'Torre A' },
  { codigo: 'A-102', torre: 'Torre A' },
  { codigo: 'B-205', torre: 'Torre B' },
];

const USUARIOS = [
  {
    email: 'demo@example.com',
    nombre: 'Usuario Demo',
    rol: Rol.RESIDENTE,
    unidades: [] as string[],
  },
  {
    email: 'residente1@example.com',
    nombre: 'Residente Uno',
    rol: Rol.RESIDENTE,
    unidades: ['A-101', 'B-205'],
  },
  {
    email: 'residente2@example.com',
    nombre: 'Residente Dos',
    rol: Rol.RESIDENTE,
    unidades: ['A-102'],
  },
  {
    email: 'admin@example.com',
    nombre: 'Administrador',
    rol: Rol.ADMINISTRADOR,
    unidades: [] as string[],
  },
  {
    email: 'seguridad@example.com',
    nombre: 'Guardia de Portería',
    rol: Rol.SEGURIDAD,
    unidades: [] as string[],
  },
];

async function main() {
  const hashes = new Map<Rol, string>();
  for (const [rol, password] of Object.entries(PASSWORDS)) {
    hashes.set(rol as Rol, await bcrypt.hash(password, 12));
  }

  // Todo con `upsert` para que el seed sea idempotente: se puede correr las
  // veces que haga falta sin duplicar ni fallar.
  const torreIds = new Map<string, string>();
  for (const nombre of TORRES) {
    const torre = await prisma.torre.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    torreIds.set(nombre, torre.id);
  }

  const unidadIds = new Map<string, string>();
  for (const { codigo, torre } of UNIDADES) {
    const unidad = await prisma.unidad.upsert({
      where: { codigo },
      update: {},
      create: { codigo, torreId: torreIds.get(torre)! },
    });
    unidadIds.set(codigo, unidad.id);
  }

  for (const { email, nombre, rol, unidades } of USUARIOS) {
    // `update` re-aplica nombre y rol para que corregir el seed y volver a
    // correrlo repare usuarios creados antes de existir estos campos.
    const user = await prisma.user.upsert({
      where: { email },
      update: { nombre, rol },
      create: { email, nombre, rol, passwordHash: hashes.get(rol)! },
    });

    for (const codigo of unidades) {
      const unidadId = unidadIds.get(codigo)!;
      await prisma.usuarioUnidad.upsert({
        where: { usuarioId_unidadId: { usuarioId: user.id, unidadId } },
        update: {},
        create: { usuarioId: user.id, unidadId },
      });
    }
  }

  // Cuotas: upsert por (unidadId, periodo) para que sea idempotente.
  type CuotaSeed = { periodo: string; monto: number; estado: EstadoCuota };
  const periodos = (desde: [number, number], n: number) =>
    Array.from({ length: n }, (_, i) => {
      const m = desde[1] - 1 + i;
      return `${desde[0] + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
    });
  const estadoDe = (p: string): EstadoCuota =>
    p >= '2026-11' ? EstadoCuota.PENDIENTE : p >= '2026-09' ? EstadoCuota.VENCIDA : EstadoCuota.PAGADA;

  const cuotasPorUnidad: Record<string, CuotaSeed[]> = {
    // 24 meses 2024-11..2026-10 + 2026-11 (25 filas) para probar paginación.
    'A-101': periodos([2024, 11], 25).map((periodo) => ({
      periodo,
      monto: 45,
      estado: estadoDe(periodo),
    })),
    'B-205': [
      { periodo: '2026-09', monto: 60, estado: EstadoCuota.PAGADA },
      { periodo: '2026-10', monto: 60, estado: EstadoCuota.VENCIDA },
      { periodo: '2026-11', monto: 60, estado: EstadoCuota.PENDIENTE },
    ],
    'A-102': [
      { periodo: '2026-10', monto: 45, estado: EstadoCuota.VENCIDA },
      { periodo: '2026-11', monto: 45, estado: EstadoCuota.PENDIENTE },
    ],
  };
  for (const [codigo, cuotas] of Object.entries(cuotasPorUnidad)) {
    const unidadId = unidadIds.get(codigo)!;
    for (const { periodo, monto, estado } of cuotas) {
      const fechaVencimiento = new Date(`${periodo}-10T00:00:00.000Z`);
      const pagadaEn = estado === EstadoCuota.PAGADA ? new Date(`${periodo}-05T12:00:00.000Z`) : null;
      await prisma.cuota.upsert({
        where: { unidadId_periodo: { unidadId, periodo } },
        update: { monto, fechaVencimiento, estado, pagadaEn },
        create: {
          unidadId,
          periodo,
          monto,
          fechaVencimiento,
          estado,
          pagadaEn,
        },
      });
    }
  }

  // Configuración de cuota (H02): solo si no hay ninguna, para no sumar historial en cada corrida.
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
  if ((await prisma.configuracionCuota.count()) === 0) {
    await prisma.configuracionCuota.create({
      data: { montoMensual: 45, diaVencimiento: 10, creadaPorId: admin.id },
    });
  }

  // Paquetes en portería (H09): upsert por código; la foto de ejemplo está en `archivo`.
  const guardia = await prisma.user.findUniqueOrThrow({ where: { email: 'seguridad@example.com' } });
  const paquetesSeed = [
    { codigo: 'PAQ-000001', unidad: 'A-101', destinatario: 'Residente Uno', mensajeria: Mensajeria.AMAZON, guia: null, retiro: '482915' },
    { codigo: 'PAQ-000002', unidad: 'A-101', destinatario: 'Ana Martínez', mensajeria: Mensajeria.DHL, guia: '1234567890', retiro: '730264' },
    { codigo: 'PAQ-000003', unidad: 'B-205', destinatario: 'Residente Uno', mensajeria: Mensajeria.CORREOS, guia: null, retiro: '159037' },
  ];
  // La foto de ejemplo vive en la tabla `archivo` (la clave de paquete.foto_url debe existir).
  const claveFoto = 'paquetes/ejemplo.png';
  await prisma.archivo.upsert({
    where: { clave: claveFoto },
    update: {},
    create: { clave: claveFoto, mimeType: 'image/png', tamanoBytes: PNG_EJEMPLO.length, datos: new Uint8Array(PNG_EJEMPLO) },
  });
  for (const p of paquetesSeed) {
    const datos = {
      unidadId: unidadIds.get(p.unidad)!,
      destinatario: p.destinatario,
      mensajeria: p.mensajeria,
      guia: p.guia,
      codigoRetiro: p.retiro,
      fotoUrl: claveFoto,
      recibidoPorId: guardia.id,
    };
    await prisma.paquete.upsert({
      where: { codigoPaquete: p.codigo },
      update: datos,
      create: { ...datos, codigoPaquete: p.codigo },
    });
  }
  // La secuencia sigue después del mayor código existente para no chocar con el seed.
  await prisma.$executeRawUnsafe(
    "SELECT setval('paquete_codigo_seq', GREATEST((SELECT COALESCE(MAX(substring(codigo_paquete FROM 5)::int), 0) FROM paquete), 1))",
  );

  // Autorizaciones de visita: fechas relativas a hoy (El Salvador) y códigos
  // fijos, así el upsert por (codigo, fechaVisita) es idempotente el mismo día.
  // Al correrlo otro día las fechas se desplazan y se crean filas nuevas.
  const hoy = hoyEnZonaNegocio();
  const residente = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  const autorizacionesSeed = [
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100001',
      dias: 1,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'María López',
      tipo: TipoDocumento.DUI,
      doc: '01234567-8',
      placa: 'P123-456',
      hora: '10:00',
    },
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100002',
      dias: 5,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'Carlos Pérez',
      tipo: TipoDocumento.PASAPORTE,
      doc: 'AB1234567',
      placa: null,
      hora: '15:30',
    },
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100003',
      dias: 2,
      estado: EstadoAutorizacion.CANCELADA,
      nombre: 'Ana Gómez',
      tipo: TipoDocumento.DUI,
      doc: '07654321-0',
      placa: null,
      hora: '09:15',
    },
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100004',
      dias: -1,
      estado: EstadoAutorizacion.VENCIDA,
      nombre: 'Luis Martínez',
      tipo: TipoDocumento.DUI,
      doc: '03333333-3',
      placa: 'P987-654',
      hora: '18:00',
    },
    {
      // Vigente para hoy: sirve para probar la entrada con código en portería (H08).
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100005',
      dias: 0,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'Sofía Ramírez',
      tipo: TipoDocumento.DUI,
      doc: '05555555-5',
      placa: null,
      hora: '16:00',
    },
    {
      email: 'residente2@example.com',
      unidad: 'A-102',
      codigo: '200001',
      dias: 1,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'Rosa Hernández',
      tipo: TipoDocumento.DUI,
      doc: '04444444-4',
      placa: null,
      hora: '11:45',
    },
  ];
  for (const a of autorizacionesSeed) {
    const fechaVisita = new Date(`${sumarDias(hoy, a.dias)}T00:00:00.000Z`);
    const datos = {
      unidadId: unidadIds.get(a.unidad)!,
      residenteId: await residente(a.email),
      nombre: a.nombre,
      tipoDocumento: a.tipo,
      numeroDocumento: a.doc,
      placa: a.placa,
      horaEstimada: new Date(`1970-01-01T${a.hora}:00.000Z`),
      estado: a.estado,
    };
    await prisma.autorizacionVisita.upsert({
      where: { codigo_fechaVisita: { codigo: a.codigo, fechaVisita } },
      update: datos,
      create: { ...datos, codigo: a.codigo, fechaVisita },
    });
  }

  // Áreas comunes (H03): upsert por nombre, re-aplica la configuración.
  const areasSeed = [
    { nombre: 'Salón de eventos', capacidad: 80, apertura: '08:00', cierre: '22:00', duracion: 3 },
    { nombre: 'Alberca', capacidad: 30, apertura: '07:00', cierre: '19:00', duracion: 2 },
    { nombre: 'Gimnasio', capacidad: 15, apertura: '05:00', cierre: '22:00', duracion: 1 },
    { nombre: 'Asador', capacidad: 20, apertura: '10:00', cierre: '21:00', duracion: 3 },
  ];
  for (const a of areasSeed) {
    const datos = {
      capacidad: a.capacidad,
      horaApertura: new Date(`1970-01-01T${a.apertura}:00.000Z`),
      horaCierre: new Date(`1970-01-01T${a.cierre}:00.000Z`),
      duracionMaxHoras: a.duracion,
    };
    await prisma.areaComun.upsert({
      where: { nombre: a.nombre },
      update: datos,
      create: { nombre: a.nombre, ...datos },
    });
  }

  // Comunicados (H13): se borran y recrean por título para que sea idempotente.
  const hora = (dias: number, hh: string) => new Date(`${sumarDias(hoyEnZonaNegocio(), dias)}T${hh}:00-06:00`);
  const comunicadosSeed = [
    {
      titulo: 'Corte de agua programado',
      contenido: 'El sábado no habrá servicio de agua de 8:00 a 12:00 por mantenimiento de la cisterna.',
      categoria: CategoriaComunicado.AGUA,
      torres: [] as string[],
      fechaPublicacion: hora(-1, '09:00'),
      fechaExpiracion: hora(5, '12:00'),
      estado: EstadoComunicado.PUBLICADO,
    },
    {
      titulo: 'Mantenimiento de ascensor Torre B',
      contenido: 'El ascensor de la Torre B estará fuera de servicio el lunes de 9:00 a 15:00.',
      categoria: CategoriaComunicado.MANTENIMIENTO,
      torres: ['Torre B'],
      fechaPublicacion: hora(2, '08:00'),
      fechaExpiracion: null,
      estado: EstadoComunicado.PROGRAMADO,
    },
    {
      titulo: 'Simulacro de evacuación',
      contenido: 'Gracias por participar en el simulacro de evacuación del mes pasado.',
      categoria: CategoriaComunicado.SEGURIDAD,
      torres: ['Torre A'],
      fechaPublicacion: hora(-20, '10:00'),
      fechaExpiracion: hora(-10, '10:00'),
      estado: EstadoComunicado.EXPIRADO,
    },
    // H14: con "Corte de agua" quedan 3 publicados (2 para todos y 1 para la
    // Torre B) y 1 expirado. Residente Dos (A-102, Torre A) no ve el de la
    // Torre B; Residente Uno sí, porque también tiene B-205.
    {
      titulo: 'Asamblea general de propietarios',
      contenido: 'La asamblea general será el próximo jueves a las 19:00 en el salón social. Se tratará el presupuesto 2027.',
      categoria: CategoriaComunicado.AVISO_GENERAL,
      torres: [] as string[],
      fechaPublicacion: hora(-3, '18:00'),
      fechaExpiracion: null,
      estado: EstadoComunicado.PUBLICADO,
    },
    {
      titulo: 'Fumigación en la Torre B',
      contenido: 'El miércoles se fumigarán los pasillos de la Torre B de 7:00 a 10:00. Mantener puertas cerradas.',
      categoria: CategoriaComunicado.MANTENIMIENTO,
      torres: ['Torre B'],
      fechaPublicacion: hora(-2, '10:00'),
      fechaExpiracion: hora(10, '10:00'),
      estado: EstadoComunicado.PUBLICADO,
    },
  ];
  // Borrar el comunicado borra en cascada sus destinos y lecturas.
  await prisma.comunicado.deleteMany({ where: { titulo: { in: comunicadosSeed.map((c) => c.titulo) } } });
  const comunicadoIds = new Map<string, string>();
  for (const { torres, ...c } of comunicadosSeed) {
    const creado = await prisma.comunicado.create({
      data: {
        ...c,
        paraTodos: torres.length === 0,
        autorId: admin.id,
        destinos: { create: torres.map((t) => ({ torreId: torreIds.get(t)! })) },
      },
    });
    comunicadoIds.set(c.titulo, creado.id);
  }

  // Lecturas (H14): el residente de A-101 ya leyó "Corte de agua programado".
  const residenteUno = await prisma.user.findUniqueOrThrow({ where: { email: 'residente1@example.com' } });
  await prisma.lecturaComunicado.create({
    data: { comunicadoId: comunicadoIds.get('Corte de agua programado')!, residenteId: residenteUno.id },
  });

  // Perfil de directorio (H15): Residente Uno visible con nombre y unidad;
  // Residente Dos oculto (estado por defecto). Los demás no tienen fila y se
  // ven ocultos hasta que guarden su configuración.
  // Hotfix 1.0.1: Residente Uno también registra teléfono (ficticio) y lo
  // muestra, para probar la búsqueda de vecinos (H16) entrando como Residente Dos.
  const perfilesSeed = [
    { email: 'residente1@example.com', visible: true, mostrarNombre: true, mostrarUnidad: true, telefono: '7000-0101' },
    { email: 'residente2@example.com', visible: false, mostrarNombre: false, mostrarUnidad: false, telefono: null },
  ];
  for (const p of perfilesSeed) {
    const residenteId = (
      await prisma.user.update({ where: { email: p.email }, data: { telefono: p.telefono }, select: { id: true } })
    ).id;
    const datos = {
      visible: p.visible,
      mostrarNombre: p.mostrarNombre,
      mostrarUnidad: p.mostrarUnidad,
      mostrarTelefono: p.telefono !== null,
      mostrarCorreo: false,
    };
    await prisma.perfilDirectorio.upsert({
      where: { residenteId },
      update: datos,
      create: { residenteId, ...datos },
    });
  }

  // ---------------------------------------------------------------------------
  // Datos para recorrer el resto de módulos. Todo con ids/códigos fijos y upsert
  // (o createMany con skipDuplicates) para que se pueda correr varias veces.
  // ---------------------------------------------------------------------------
  const ahora = new Date();
  const enHoras = (h: number) => new Date(ahora.getTime() + h * 3_600_000);
  const residenteDos = await prisma.user.findUniqueOrThrow({ where: { email: 'residente2@example.com' } });
  const fechaDia = (dias: number) => new Date(`${sumarDias(hoy, dias)}T00:00:00.000Z`);
  const tiempo = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

  // Asambleas (H11/H12): una abierta, una cerrada con votos y un borrador.
  // El trigger de `voto` impide UPDATE/DELETE: los votos solo se insertan.
  const asambleasSeed = [
    {
      clave: 'abierta',
      titulo: 'Asamblea ordinaria 2027',
      descripcion: 'Votación abierta del presupuesto y de la renovación del contrato de vigilancia.',
      estado: EstadoAsamblea.ABIERTA,
      apertura: enHoras(-24),
      cierre: enHoras(72),
      publicada: enHoras(-96),
      temas: [
        { titulo: 'Aprobación del presupuesto 2027', opciones: ['A favor', 'En contra', 'Abstención'] },
        { titulo: 'Renovación del contrato de vigilancia', opciones: ['Renovar', 'Cambiar de empresa'] },
      ],
    },
    {
      clave: 'cerrada',
      titulo: 'Asamblea extraordinaria: cuota de mantenimiento',
      descripcion: 'Votación ya cerrada sobre el ajuste de la cuota mensual y el uso del fondo de reserva.',
      estado: EstadoAsamblea.CERRADA,
      apertura: enHoras(-24 * 12),
      cierre: enHoras(-24 * 10),
      publicada: enHoras(-24 * 15),
      temas: [
        { titulo: 'Ajuste de la cuota mensual a 45 dólares', opciones: ['A favor', 'En contra'] },
        { titulo: 'Uso del fondo de reserva para la fachada', opciones: ['A favor', 'En contra', 'Abstención'] },
      ],
    },
    {
      clave: 'borrador',
      titulo: 'Asamblea de cierre de año (borrador)',
      descripcion: 'Borrador: informe de gestión y elección de la nueva junta directiva.',
      estado: EstadoAsamblea.BORRADOR,
      apertura: enHoras(24 * 10),
      cierre: enHoras(24 * 12),
      publicada: null,
      temas: [{ titulo: 'Elección de la junta directiva', opciones: ['Planilla A', 'Planilla B'] }],
    },
  ];
  const temasCerrada: { temaId: string; opcionIds: string[] }[] = [];
  for (const a of asambleasSeed) {
    const asambleaId = idFijo(`asamblea:${a.clave}`);
    const datos = {
      titulo: a.titulo,
      descripcion: a.descripcion,
      fechaApertura: a.apertura,
      fechaCierre: a.cierre,
      estado: a.estado,
      publicadaEn: a.publicada,
      creadaPorId: admin.id,
    };
    await prisma.asamblea.upsert({ where: { id: asambleaId }, update: datos, create: { id: asambleaId, ...datos } });
    for (const [t, tema] of a.temas.entries()) {
      const temaId = idFijo(`tema:${a.clave}:${t}`);
      await prisma.temaVotacion.upsert({
        where: { id: temaId },
        update: { titulo: tema.titulo, orden: t + 1 },
        create: { id: temaId, asambleaId, titulo: tema.titulo, orden: t + 1 },
      });
      const opcionIds: string[] = [];
      for (const [o, texto] of tema.opciones.entries()) {
        const opcionId = idFijo(`opcion:${a.clave}:${t}:${o}`);
        opcionIds.push(opcionId);
        await prisma.opcionTema.upsert({
          where: { id: opcionId },
          update: { texto, orden: o + 1 },
          create: { id: opcionId, temaId, texto, orden: o + 1 },
        });
      }
      if (a.clave === 'cerrada') temasCerrada.push({ temaId, opcionIds });
    }
  }
  // Votos de la asamblea cerrada: un voto por unidad y tema (A-101 y B-205 las
  // representa Residente Uno; A-102, Residente Dos).
  const votantes = [
    { unidad: 'A-101', residenteId: residenteUno.id },
    { unidad: 'B-205', residenteId: residenteUno.id },
    { unidad: 'A-102', residenteId: residenteDos.id },
  ];
  const asambleaCerradaId = idFijo('asamblea:cerrada');
  await prisma.voto.createMany({
    skipDuplicates: true,
    data: temasCerrada.flatMap(({ temaId, opcionIds }, t) =>
      votantes.map((v, i) => ({
        id: idFijo(`voto:${t}:${v.unidad}`),
        asambleaId: asambleaCerradaId,
        temaId,
        opcionId: opcionIds[(t + i) % 2 === 0 ? 0 : 1],
        unidadId: unidadIds.get(v.unidad)!,
        residenteId: v.residenteId,
        codigoVerificacion: idFijo(`codigo-voto:${t}:${v.unidad}`).slice(0, 8).toUpperCase(),
      })),
    ),
  });

  // Reportes / incidencias (H05/H06): varios estados y prioridades, sin fotos.
  const reportesSeed = [
    {
      clave: 'fuga',
      residenteId: residenteUno.id,
      titulo: 'Fuga de agua en el pasillo del piso 2',
      categoria: CategoriaReporte.FUGA,
      ubicacion: 'Torre A, piso 2',
      descripcion: 'Hay agua goteando del techo cerca del ascensor desde la mañana.',
      estado: EstadoReporte.ABIERTO,
      prioridad: PrioridadReporte.ALTA,
      responsable: null,
      horasAtras: 20,
      historial: [{ estado: EstadoReporte.ABIERTO, comentario: null, por: residenteUno.id, horasAtras: 20 }],
    },
    {
      clave: 'luminaria',
      residenteId: residenteDos.id,
      titulo: 'Luminaria quemada en el parqueo',
      categoria: CategoriaReporte.LUMINARIA,
      ubicacion: 'Parqueo, nivel 1',
      descripcion: 'Dos lámparas del parqueo no encienden y la zona queda muy oscura de noche.',
      estado: EstadoReporte.EN_PROCESO,
      prioridad: PrioridadReporte.MEDIA,
      responsable: 'Mantenimiento - Pedro Ruiz',
      horasAtras: 72,
      historial: [
        { estado: EstadoReporte.ABIERTO, comentario: null, por: residenteDos.id, horasAtras: 72 },
        { estado: EstadoReporte.EN_PROCESO, comentario: 'Se pidieron las lámparas de repuesto.', por: admin.id, horasAtras: 48 },
      ],
    },
    {
      clave: 'ascensor',
      residenteId: residenteUno.id,
      titulo: 'Ascensor de la Torre B se detiene entre pisos',
      categoria: CategoriaReporte.ASCENSOR,
      ubicacion: 'Torre B, ascensor principal',
      descripcion: 'El ascensor se queda detenido unos segundos entre el piso 3 y el 4.',
      estado: EstadoReporte.RESUELTO,
      prioridad: PrioridadReporte.ALTA,
      responsable: 'Técnico externo - Ascensores SA',
      horasAtras: 24 * 10,
      historial: [
        { estado: EstadoReporte.ABIERTO, comentario: null, por: residenteUno.id, horasAtras: 24 * 10 },
        { estado: EstadoReporte.EN_PROCESO, comentario: 'Visita del técnico programada.', por: admin.id, horasAtras: 24 * 8 },
        { estado: EstadoReporte.RESUELTO, comentario: 'Se reemplazó el sensor de nivel y se probó el ascensor.', por: admin.id, horasAtras: 24 * 6 },
      ],
    },
    {
      clave: 'limpieza',
      residenteId: residenteUno.id,
      titulo: 'Basura acumulada en el cuarto de desechos',
      categoria: CategoriaReporte.LIMPIEZA,
      ubicacion: 'Torre A, sótano',
      descripcion: 'El cuarto de desechos está lleno y hay mal olor desde hace dos días.',
      estado: EstadoReporte.ABIERTO,
      prioridad: PrioridadReporte.BAJA,
      responsable: null,
      horasAtras: 5,
      historial: [{ estado: EstadoReporte.ABIERTO, comentario: null, por: residenteUno.id, horasAtras: 5 }],
    },
    {
      clave: 'otro',
      residenteId: residenteDos.id,
      titulo: 'Portón peatonal no cierra bien',
      categoria: CategoriaReporte.OTRO,
      ubicacion: 'Entrada principal',
      descripcion: 'El portón peatonal queda entreabierto si no se empuja con fuerza.',
      estado: EstadoReporte.ABIERTO,
      prioridad: null,
      responsable: null,
      horasAtras: 2,
      historial: [{ estado: EstadoReporte.ABIERTO, comentario: null, por: residenteDos.id, horasAtras: 2 }],
    },
  ];
  for (const r of reportesSeed) {
    const reporteId = idFijo(`reporte:${r.clave}`);
    const resuelto = r.estado === EstadoReporte.RESUELTO;
    const ultimo = r.historial[r.historial.length - 1];
    const datos = {
      residenteId: r.residenteId,
      titulo: r.titulo,
      categoria: r.categoria,
      ubicacion: r.ubicacion,
      descripcion: r.descripcion,
      prioridad: r.prioridad,
      responsable: r.responsable,
      estado: r.estado,
      resueltoEn: resuelto ? enHoras(-ultimo.horasAtras) : null,
      comentarioCierre: resuelto ? ultimo.comentario : null,
      createdAt: enHoras(-r.horasAtras),
    };
    await prisma.reporte.upsert({ where: { id: reporteId }, update: datos, create: { id: reporteId, ...datos } });
    for (const [i, h] of r.historial.entries()) {
      const historialId = idFijo(`historial:${r.clave}:${i}`);
      const datosH = { reporteId, estado: h.estado, comentario: h.comentario, cambiadoPorId: h.por, createdAt: enHoras(-h.horasAtras) };
      await prisma.historialReporte.upsert({ where: { id: historialId }, update: datosH, create: { id: historialId, ...datosH } });
    }
  }

  // Reservas de áreas comunes (H04): dentro del horario de cada área y sin
  // cruces entre las confirmadas. Los códigos RES-9000xx no chocan con la secuencia real.
  const reservasSeed = [
    { codigo: 'RES-900001', area: 'Salón de eventos', unidad: 'A-101', residenteId: residenteUno.id, dias: 3, inicio: '18:00', fin: '21:00', asistentes: 25, estado: EstadoReserva.CONFIRMADA },
    { codigo: 'RES-900002', area: 'Alberca', unidad: 'A-101', residenteId: residenteUno.id, dias: 1, inicio: '10:00', fin: '12:00', asistentes: 6, estado: EstadoReserva.CONFIRMADA },
    { codigo: 'RES-900003', area: 'Gimnasio', unidad: 'A-102', residenteId: residenteDos.id, dias: 2, inicio: '06:00', fin: '07:00', asistentes: 2, estado: EstadoReserva.CONFIRMADA },
    { codigo: 'RES-900004', area: 'Asador', unidad: 'A-101', residenteId: residenteUno.id, dias: 5, inicio: '12:00', fin: '15:00', asistentes: 12, estado: EstadoReserva.CANCELADA },
    { codigo: 'RES-900005', area: 'Alberca', unidad: 'A-102', residenteId: residenteDos.id, dias: -7, inicio: '15:00', fin: '17:00', asistentes: 4, estado: EstadoReserva.FINALIZADA },
  ];
  for (const r of reservasSeed) {
    const areaId = (await prisma.areaComun.findUniqueOrThrow({ where: { nombre: r.area } })).id;
    const datos = {
      areaId,
      unidadId: unidadIds.get(r.unidad)!,
      residenteId: r.residenteId,
      fecha: fechaDia(r.dias),
      horaInicio: tiempo(r.inicio),
      horaFin: tiempo(r.fin),
      asistentes: r.asistentes,
      estado: r.estado,
      canceladaEn: r.estado === EstadoReserva.CANCELADA ? enHoras(-2) : null,
    };
    await prisma.reserva.upsert({ where: { codigo: r.codigo }, update: datos, create: { codigo: r.codigo, ...datos } });
  }

  // Pagos de cuotas (H21): A-101 pagó 2026-07 y 2026-08 en un solo pago y B-205
  // pagó 2026-09; quedan además un pago rechazado y cuotas vencidas/pendientes
  // para el estado de cuenta y la morosidad.
  const pagosSeed = [
    { clave: 'a101-ago', tx: 'TX-20260805-900001', unidad: 'A-101', residenteId: residenteUno.id, monto: 90, ultimos4: '4242', titular: 'Residente Uno', periodos: ['2026-07', '2026-08'], pagadoEn: '2026-08-05T12:00:00.000Z' },
    { clave: 'b205-sep', tx: 'TX-20260905-900002', unidad: 'B-205', residenteId: residenteUno.id, monto: 60, ultimos4: '4242', titular: 'Residente Uno', periodos: ['2026-09'], pagadoEn: '2026-09-05T12:00:00.000Z' },
  ];
  for (const p of pagosSeed) {
    const unidadId = unidadIds.get(p.unidad)!;
    const pagoId = idFijo(`pago:${p.clave}`);
    const datos = {
      numeroTransaccion: p.tx,
      unidadId,
      residenteId: p.residenteId,
      monto: p.monto,
      estado: EstadoPago.APROBADO,
      motivo: null,
      ultimos4: p.ultimos4,
      titular: p.titular,
      createdAt: new Date(p.pagadoEn),
    };
    await prisma.pago.upsert({
      where: { id: pagoId },
      update: datos,
      create: { id: pagoId, idempotencyKey: idFijo(`pago-key:${p.clave}`), ...datos },
    });
    for (const periodo of p.periodos) {
      const cuota = await prisma.cuota.findUniqueOrThrow({ where: { unidadId_periodo: { unidadId, periodo } } });
      await prisma.pagoCuota.upsert({
        where: { pagoId_cuotaId: { pagoId, cuotaId: cuota.id } },
        update: { monto: cuota.monto },
        create: { pagoId, cuotaId: cuota.id, monto: cuota.monto },
      });
    }
  }
  const pagoRechazadoId = idFijo('pago:rechazado');
  const datosRechazado = {
    numeroTransaccion: null,
    unidadId: unidadIds.get('A-102')!,
    residenteId: residenteDos.id,
    monto: 45,
    estado: EstadoPago.RECHAZADO,
    motivo: 'Fondos insuficientes',
    ultimos4: '0002',
    titular: 'Residente Dos',
    createdAt: enHoras(-30),
  };
  await prisma.pago.upsert({
    where: { id: pagoRechazadoId },
    update: datosRechazado,
    create: { id: pagoRechazadoId, idempotencyKey: idFijo('pago-key:rechazado'), ...datosRechazado },
  });

  // Notificaciones (H18) para Residente Uno: leídas y no leídas.
  const notificacionesSeed = [
    { clave: 'cuota', modulo: 'PAGOS', titulo: 'Tu cuota está por vencer', mensaje: 'La cuota de 2026-11 de la unidad A-101 vence el día 10.', referencia: '/cuotas', horasAtras: 2, leida: false },
    { clave: 'paquete', modulo: 'PAQUETERIA', titulo: 'Tienes un paquete en portería', mensaje: 'Amazon · PAQ-000001', referencia: '/paquetes', horasAtras: 6, leida: false },
    { clave: 'asamblea', modulo: 'VOTACIONES', titulo: 'Votación abierta', mensaje: 'Ya puedes votar en la Asamblea ordinaria 2027.', referencia: `/asambleas/${idFijo('asamblea:abierta')}`, horasAtras: 24, leida: false },
    { clave: 'reserva', modulo: 'RESERVAS', titulo: 'Reserva confirmada', mensaje: 'Alberca · RES-900002', referencia: null, horasAtras: 48, leida: true },
    { clave: 'reporte', modulo: 'INCIDENCIAS', titulo: 'Tu reporte cambió de estado', mensaje: 'Ascensor de la Torre B se detiene entre pisos: Resuelto.', referencia: null, horasAtras: 24 * 6, leida: true },
    { clave: 'comunicado', modulo: 'COMUNICADOS', titulo: 'Nuevo comunicado', mensaje: 'Corte de agua programado.', referencia: null, horasAtras: 24, leida: true },
  ];
  for (const n of notificacionesSeed) {
    const notificacionId = idFijo(`notificacion:${n.clave}`);
    const datos = {
      moduloOrigen: n.modulo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      referencia: n.referencia,
      destinoTipo: 'USUARIO',
      destinoId: residenteUno.id,
      createdAt: enHoras(-n.horasAtras),
    };
    await prisma.notificacion.upsert({ where: { id: notificacionId }, update: datos, create: { id: notificacionId, ...datos } });
    const estadoLectura = { leida: n.leida, leidaEn: n.leida ? enHoras(-n.horasAtras + 1) : null };
    await prisma.notificacionDestinatario.upsert({
      where: { notificacionId_residenteId: { notificacionId, residenteId: residenteUno.id } },
      update: estadoLectura,
      create: { notificacionId, residenteId: residenteUno.id, ...estadoLectura },
    });
  }

  // Registros de acceso de visitantes (H08): uno dentro y uno que ya salió.
  const accesosSeed = [
    { clave: 'dentro', nombre: 'Jorge Menjívar', doc: '02222222-2', unidad: 'A-101', motivo: 'Visita familiar', estado: EstadoAcceso.DENTRO, entradaHoras: -1, salidaHoras: null },
    { clave: 'salio', nombre: 'Marta Quintanilla', doc: '06666666-6', unidad: 'A-102', motivo: 'Entrega de muebles', estado: EstadoAcceso.SALIO, entradaHoras: -5, salidaHoras: -4 },
  ];
  for (const a of accesosSeed) {
    const accesoId = idFijo(`acceso:${a.clave}`);
    const salio = a.salidaHoras !== null;
    const datos = {
      unidadId: unidadIds.get(a.unidad)!,
      nombre: a.nombre,
      tipoDocumento: TipoDocumento.DUI,
      numeroDocumento: a.doc,
      motivo: a.motivo,
      preautorizado: false,
      estado: a.estado,
      horaEntrada: enHoras(a.entradaHoras),
      horaSalida: salio ? enHoras(a.salidaHoras) : null,
      entradaPorId: guardia.id,
      salidaPorId: salio ? guardia.id : null,
    };
    await prisma.registroAcceso.upsert({ where: { id: accesoId }, update: datos, create: { id: accesoId, ...datos } });
  }

  console.log('Seed listo. Las contraseñas salen de SEED_PASSWORD_ADMIN / SEED_PASSWORD_RESIDENTE / SEED_PASSWORD_SEGURIDAD (.env).');
  console.log('Usuarios:');
  for (const { email, rol, unidades } of USUARIOS) {
    console.log(`  ${email}  [${rol}]  unidades: ${unidades.join(', ') || '-'}`);
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
