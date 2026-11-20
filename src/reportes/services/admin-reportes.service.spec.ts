import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificacionService } from '@Notificaciones/services';
import {
  CategoriaReporte,
  EstadoReporte,
  PrioridadReporte,
  Rol,
} from '@PrismaClient';
import {
  ReporteEstadoInvalidoError,
  ReporteNotFoundError,
  ReporteYaResueltoError,
} from '@Reportes/errors';
import type {
  ReporteAdminDetalle,
  ReporteAdminItem,
  ReporteRepository,
} from '@Reportes/repositories';
import {
  MENSAJE_ASIGNACION_INCOMPLETA,
  MENSAJE_COMENTARIO_CIERRE,
  MENSAJE_REPORTE_NO_ENCONTRADO,
  MENSAJE_REPORTE_YA_RESUELTO,
  MENSAJE_SOLO_EN_PROCESO,
} from '../reportes.constants.js';
import { AdminReportesService } from './admin-reportes.service.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const REPORTE_ID = '22222222-2222-4222-8222-222222222222';
const RESIDENTE_ID = '33333333-3333-4333-8333-333333333333';

const itemAdminFalso = (over: Partial<ReporteAdminItem> = {}): ReporteAdminItem =>
  ({
    id: REPORTE_ID,
    numero: 123,
    residenteId: RESIDENTE_ID,
    titulo: 'Fuga de agua',
    categoria: CategoriaReporte.FUGA,
    ubicacion: 'Torre A',
    descripcion: 'Fuga en el pasillo del piso 3.',
    prioridad: null,
    responsable: null,
    estado: EstadoReporte.ABIERTO,
    resueltoEn: null,
    comentarioCierre: null,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    residente: {
      id: RESIDENTE_ID,
      nombre: 'Ana Gómez',
      email: 'ana@condominio.com',
      unidades: [{ unidad: { codigo: 'A-101' } }],
    },
    ...over,
  }) as unknown as ReporteAdminItem;

const detalleAdminFalso = (over: Partial<ReporteAdminDetalle> = {}): ReporteAdminDetalle =>
  ({
    ...itemAdminFalso(),
    evidencias: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        reporteId: REPORTE_ID,
        archivo: 'foto.png',
        mimeType: 'image/png',
        tamanoBytes: 1024,
        orden: 0,
        createdAt: new Date('2026-11-10T10:00:00.000Z'),
      },
    ],
    historial: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        reporteId: REPORTE_ID,
        estado: EstadoReporte.ABIERTO,
        comentario: null,
        cambiadoPorId: RESIDENTE_ID,
        createdAt: new Date('2026-11-10T10:00:00.000Z'),
        cambiadoPor: { id: RESIDENTE_ID, nombre: 'Ana Gómez', rol: Rol.RESIDENTE },
      },
    ],
    ...over,
  }) as unknown as ReporteAdminDetalle;

describe('AdminReportesService (H06 y H24)', () => {
  let repo: {
    findPaginaAdmin: ReturnType<typeof vi.fn>;
    findDetalleAdminById: ReturnType<typeof vi.fn>;
    asignar: ReturnType<typeof vi.fn>;
    resolver: ReturnType<typeof vi.fn>;
  };
  let notificaciones: {
    enviar: ReturnType<typeof vi.fn>;
  };
  let service: AdminReportesService;

  beforeEach(() => {
    repo = {
      findPaginaAdmin: vi.fn(),
      findDetalleAdminById: vi.fn(),
      asignar: vi.fn(),
      resolver: vi.fn(),
    };
    notificaciones = {
      enviar: vi.fn().mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666', destinatarios: 1 }),
    };
    service = new AdminReportesService(
      repo as unknown as ReporteRepository,
      notificaciones as unknown as NotificacionService,
    );
  });

  describe('listar', () => {
    it('ordena correctamente: ALTA -> MEDIA -> BAJA -> sin asignar, y desempata por fecha más antigua', async () => {
      const sinAsignarAntiguo = itemAdminFalso({
        id: '00000000-0000-4000-8000-000000000001',
        numero: 1,
        prioridad: null,
        createdAt: new Date('2026-11-01T08:00:00.000Z'),
      });
      const baja = itemAdminFalso({
        id: '00000000-0000-4000-8000-000000000002',
        numero: 2,
        prioridad: PrioridadReporte.BAJA,
        createdAt: new Date('2026-11-02T08:00:00.000Z'),
      });
      const mediaReciente = itemAdminFalso({
        id: '00000000-0000-4000-8000-000000000003',
        numero: 3,
        prioridad: PrioridadReporte.MEDIA,
        createdAt: new Date('2026-11-05T08:00:00.000Z'),
      });
      const mediaAntigua = itemAdminFalso({
        id: '00000000-0000-4000-8000-000000000004',
        numero: 4,
        prioridad: PrioridadReporte.MEDIA,
        createdAt: new Date('2026-11-03T08:00:00.000Z'),
      });
      const altaReciente = itemAdminFalso({
        id: '00000000-0000-4000-8000-000000000005',
        numero: 5,
        prioridad: PrioridadReporte.ALTA,
        createdAt: new Date('2026-11-06T08:00:00.000Z'),
      });
      const altaAntigua = itemAdminFalso({
        id: '00000000-0000-4000-8000-000000000006',
        numero: 6,
        prioridad: PrioridadReporte.ALTA,
        createdAt: new Date('2026-11-04T08:00:00.000Z'),
      });

      repo.findPaginaAdmin.mockResolvedValue({
        reportes: [sinAsignarAntiguo, baja, mediaReciente, altaReciente, mediaAntigua, altaAntigua],
        total: 6,
      });

      const res = await service.listar({
        estado: EstadoReporte.ABIERTO,
        categoria: CategoriaReporte.FUGA,
        pagina: 1,
      });

      expect(repo.findPaginaAdmin).toHaveBeenCalledWith({
        estado: EstadoReporte.ABIERTO,
        categoria: CategoriaReporte.FUGA,
        skip: 0,
        take: 20,
      });
      expect(res.total).toBe(6);
      expect(res.pagina).toBe(1);
      expect(res.datos.map((d) => d.numero)).toEqual([
        'REP-000006',
        'REP-000005',
        'REP-000004',
        'REP-000003',
        'REP-000002',
        'REP-000001',
      ]);
    });
  });

  describe('obtenerDetalle', () => {
    it('devuelve el detalle completo con evidencias e historial', async () => {
      repo.findDetalleAdminById.mockResolvedValue(detalleAdminFalso());

      const res = await service.obtenerDetalle(REPORTE_ID);

      expect(res.numero).toBe('REP-000123');
      expect(res.evidencias).toHaveLength(1);
      expect(res.historial).toHaveLength(1);
      expect(res.unidades).toEqual(['A-101']);
      expect(res.resueltoEn).toBeNull();
      expect(res.comentarioCierre).toBeNull();
    });

    it('lanza 404 si el reporte no existe o el id no es UUID válido', async () => {
      await expect(service.obtenerDetalle('no-es-uuid')).rejects.toThrow(NotFoundException);
      expect(repo.findDetalleAdminById).not.toHaveBeenCalled();

      repo.findDetalleAdminById.mockResolvedValue(null);
      await expect(service.obtenerDetalle(REPORTE_ID)).rejects.toThrow(MENSAJE_REPORTE_NO_ENCONTRADO);
    });
  });

  describe('asignar', () => {
    it('asigna prioridad y responsable a un reporte ABIERTO, lo pasa a EN_PROCESO y registra historial', async () => {
      repo.asignar.mockResolvedValue({
        id: REPORTE_ID,
        numero: 123,
        estado: EstadoReporte.EN_PROCESO,
        prioridad: PrioridadReporte.ALTA,
        responsable: 'Fontanería López',
      });

      const res = await service.asignar(REPORTE_ID, ADMIN_ID, {
        prioridad: PrioridadReporte.ALTA,
        responsable: 'Fontanería López',
      });

      expect(repo.asignar).toHaveBeenCalledWith({
        reporteId: REPORTE_ID,
        adminId: ADMIN_ID,
        prioridad: PrioridadReporte.ALTA,
        responsable: 'Fontanería López',
        comentario: 'Prioridad: ALTA · Responsable: Fontanería López',
      });
      expect(res).toEqual({
        id: REPORTE_ID,
        numero: 'REP-000123',
        estado: EstadoReporte.EN_PROCESO,
        prioridad: PrioridadReporte.ALTA,
        responsable: 'Fontanería López',
      });
    });

    it('reasigna prioridad y responsable en un reporte EN_PROCESO manteniendo estado EN_PROCESO y registrando historial', async () => {
      repo.asignar.mockResolvedValue({
        id: REPORTE_ID,
        numero: 123,
        estado: EstadoReporte.EN_PROCESO,
        prioridad: PrioridadReporte.MEDIA,
        responsable: 'Mantenimiento Interno',
      });

      const res = await service.asignar(REPORTE_ID, ADMIN_ID, {
        prioridad: PrioridadReporte.MEDIA,
        responsable: '  Mantenimiento Interno  ',
      });

      expect(repo.asignar).toHaveBeenCalledWith({
        reporteId: REPORTE_ID,
        adminId: ADMIN_ID,
        prioridad: PrioridadReporte.MEDIA,
        responsable: 'Mantenimiento Interno',
        comentario: 'Prioridad: MEDIA · Responsable: Mantenimiento Interno',
      });
      expect(res.estado).toBe(EstadoReporte.EN_PROCESO);
      expect(res.prioridad).toBe(PrioridadReporte.MEDIA);
      expect(res.responsable).toBe('Mantenimiento Interno');
    });

    it('lanza ConflictException (409) al intentar asignar un reporte RESUELTO', async () => {
      repo.asignar.mockRejectedValue(new ReporteYaResueltoError(REPORTE_ID));

      await expect(
        service.asignar(REPORTE_ID, ADMIN_ID, {
          prioridad: PrioridadReporte.ALTA,
          responsable: 'Fontanería López',
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.asignar(REPORTE_ID, ADMIN_ID, {
          prioridad: PrioridadReporte.ALTA,
          responsable: 'Fontanería López',
        }),
      ).rejects.toThrow(MENSAJE_REPORTE_YA_RESUELTO);
    });

    it('lanza NotFoundException (404) si el reporte no existe', async () => {
      repo.asignar.mockRejectedValue(new ReporteNotFoundError(REPORTE_ID));

      await expect(
        service.asignar(REPORTE_ID, ADMIN_ID, {
          prioridad: PrioridadReporte.ALTA,
          responsable: 'Fontanería López',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['solo prioridad sin responsable', { prioridad: PrioridadReporte.ALTA }],
      ['solo responsable sin prioridad', { responsable: 'Fontanería López' }],
      ['prioridad con responsable vacío', { prioridad: PrioridadReporte.ALTA, responsable: '   ' }],
      ['cuerpo vacío', {}],
    ])('lanza 400 con "Asigna prioridad y responsable juntos" cuando envía %s', async (_caso, body) => {
      await expect(service.asignar(REPORTE_ID, ADMIN_ID, body)).rejects.toThrow(BadRequestException);
      await expect(service.asignar(REPORTE_ID, ADMIN_ID, body)).rejects.toThrow(
        MENSAJE_ASIGNACION_INCOMPLETA,
      );
      expect(repo.asignar).not.toHaveBeenCalled();
    });
  });

  describe('resolver (H24)', () => {
    const comentarioValido = 'Se reemplazó el empaque de la tubería y se probó sin fugas.';

    it('resuelve un reporte EN_PROCESO, devuelve 200 con resueltoEn y envía exactamente 1 notificación al residente', async () => {
      const resueltoEn = new Date('2026-11-20T16:30:00.000Z');
      repo.resolver.mockResolvedValue({
        id: REPORTE_ID,
        numero: 123,
        residenteId: RESIDENTE_ID,
        estado: EstadoReporte.RESUELTO,
        resueltoEn,
        comentarioCierre: comentarioValido,
      });

      const res = await service.resolver(REPORTE_ID, ADMIN_ID, {
        comentario: `  ${comentarioValido}  `,
      });

      expect(repo.resolver).toHaveBeenCalledOnce();
      expect(repo.resolver).toHaveBeenCalledWith({
        reporteId: REPORTE_ID,
        adminId: ADMIN_ID,
        comentario: comentarioValido,
      });

      expect(notificaciones.enviar).toHaveBeenCalledOnce();
      expect(notificaciones.enviar).toHaveBeenCalledWith({
        destinatario: { tipo: 'USUARIO', id: RESIDENTE_ID },
        titulo: 'Tu reporte REP-000123 fue resuelto',
        mensaje: comentarioValido,
        moduloOrigen: 'INCIDENCIAS',
        referencia: '/reportes/REP-000123',
      });

      expect(res).toEqual({
        id: REPORTE_ID,
        numero: 'REP-000123',
        estado: EstadoReporte.RESUELTO,
        resueltoEn: '2026-11-20T16:30:00.000Z',
      });
    });

    it('lanza ConflictException (409) al intentar resolver un reporte ABIERTO y NO envía notificación', async () => {
      repo.resolver.mockRejectedValue(
        new ReporteEstadoInvalidoError(REPORTE_ID, EstadoReporte.ABIERTO),
      );

      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario: comentarioValido }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario: comentarioValido }),
      ).rejects.toThrow(MENSAJE_SOLO_EN_PROCESO);

      expect(notificaciones.enviar).not.toHaveBeenCalled();
    });

    it('lanza ConflictException (409) al intentar resolver un reporte ya RESUELTO y NO envía notificación', async () => {
      repo.resolver.mockRejectedValue(
        new ReporteEstadoInvalidoError(REPORTE_ID, EstadoReporte.RESUELTO),
      );

      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario: comentarioValido }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario: comentarioValido }),
      ).rejects.toThrow(MENSAJE_SOLO_EN_PROCESO);

      expect(notificaciones.enviar).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException (404) si el reporte no existe o el id no es UUID válido y NO envía notificación', async () => {
      await expect(
        service.resolver('id-invalido', ADMIN_ID, { comentario: comentarioValido }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.resolver).not.toHaveBeenCalled();

      repo.resolver.mockRejectedValue(new ReporteNotFoundError(REPORTE_ID));
      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario: comentarioValido }),
      ).rejects.toThrow(MENSAJE_REPORTE_NO_ENCONTRADO);

      expect(notificaciones.enviar).not.toHaveBeenCalled();
    });

    it.each([
      ['vacío', ''],
      ['solo espacios', '         '],
      ['menor a 10 caracteres', 'Muy corto'],
      ['mayor a 300 caracteres', 'x'.repeat(301)],
    ])('lanza BadRequestException (400) cuando el comentario es %s y NO envía notificación', async (_caso, comentario) => {
      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resolver(REPORTE_ID, ADMIN_ID, { comentario }),
      ).rejects.toThrow(MENSAJE_COMENTARIO_CIERRE);

      expect(repo.resolver).not.toHaveBeenCalled();
      expect(notificaciones.enviar).not.toHaveBeenCalled();
    });
  });
});