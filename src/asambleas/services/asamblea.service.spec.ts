import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesGuard } from '@Auth/guards';
import type { NotificacionService } from '@Notificaciones/services';
import type { PrismaService } from '@Prisma/services';
import { EstadoAsamblea, Prisma, Rol } from '@PrismaClient';
import type { UnidadRepository } from '@Unidades/repositories';
import { AsambleaController } from '../controllers/asamblea.controller.js';
import { EmitirVotosDto } from '../dto/emitir-votos.dto.js';
import { CodigoVerificacionColisionError, UnidadYaVotoError } from '../errors/index.js';
import { AsambleaRepository, type DatosVotoNuevo } from '../repositories/asamblea.repository.js';
import { AsambleaService } from './asamblea.service.js';

const ASAMBLEA_ID = '11111111-1111-4111-8111-111111111111';
const TEMA_1_ID = '22222222-2222-4222-8222-222222222221';
const TEMA_2_ID = '22222222-2222-4222-8222-222222222222';
const TEMA_AJENO_ID = '22222222-2222-4222-8222-222222222299';
const OPCION_1A_ID = '33333333-3333-4333-8333-333333333311';
const OPCION_1B_ID = '33333333-3333-4333-8333-333333333312';
const OPCION_2A_ID = '33333333-3333-4333-8333-333333333321';
const OPCION_2B_ID = '33333333-3333-4333-8333-333333333322';
const RESIDENTE_1_ID = '44444444-4444-4444-8444-444444444441';
const RESIDENTE_2_ID = '44444444-4444-4444-8444-444444444442';
const UNIDAD_ID = '55555555-5555-4555-8555-555555555555';

const AHORA = new Date('2026-11-20T14:30:00.000Z');
const APERTURA = new Date('2026-11-20T12:00:00.000Z');
const CIERRE = new Date('2026-11-20T20:00:00.000Z');

function crearAsambleaMock(
  estado: EstadoAsamblea = EstadoAsamblea.ABIERTA,
  fechaApertura = APERTURA,
  fechaCierre = CIERRE,
) {
  return {
    id: ASAMBLEA_ID,
    titulo: 'Asamblea Ordinaria Noviembre 2026',
    descripcion: 'Aprobación de presupuesto y mantenimiento',
    fechaApertura,
    fechaCierre,
    estado,
    publicadaEn: new Date('2026-11-18T10:00:00.000Z'),
    creadaPorId: '66666666-6666-4666-8666-666666666666',
    createdAt: new Date('2026-11-17T10:00:00.000Z'),
    updatedAt: new Date('2026-11-18T10:00:00.000Z'),
    temas: [
      {
        id: TEMA_1_ID,
        asambleaId: ASAMBLEA_ID,
        titulo: '¿Aprueba el presupuesto anual?',
        orden: 1,
        opciones: [
          { id: OPCION_1A_ID, temaId: TEMA_1_ID, texto: 'A favor', orden: 1 },
          { id: OPCION_1B_ID, temaId: TEMA_1_ID, texto: 'En contra', orden: 2 },
        ],
      },
      {
        id: TEMA_2_ID,
        asambleaId: ASAMBLEA_ID,
        titulo: '¿Renovar contrato de jardinería?',
        orden: 2,
        opciones: [
          { id: OPCION_2A_ID, temaId: TEMA_2_ID, texto: 'Sí', orden: 1 },
          { id: OPCION_2B_ID, temaId: TEMA_2_ID, texto: 'No', orden: 2 },
        ],
      },
    ],
  };
}

describe('AsambleaService · H12 Votar una sola vez por unidad', () => {
  const repoMock = {
    findById: vi.fn(),
    registrarVotosEnTransaccion: vi.fn(),
    listarParaResidente: vi.fn(),
    findDetalleConVotosUnidad: vi.fn(),
  };

  const notificacionesMock = {
    enviar: vi.fn(),
  };

  const unidadesMock = {
    findDeUsuario: vi.fn(),
  };

  const service = new AsambleaService(
    repoMock as unknown as AsambleaRepository,
    notificacionesMock as unknown as NotificacionService,
    unidadesMock as unknown as UnidadRepository,
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    vi.resetAllMocks();

    repoMock.findById.mockResolvedValue(crearAsambleaMock());
    unidadesMock.findDeUsuario.mockResolvedValue([{ id: UNIDAD_ID, codigo: 'A-101' }]);
    repoMock.registrarVotosEnTransaccion.mockImplementation(
      async (_asambleaId: string, _unidadId: string, _residenteId: string, votos: DatosVotoNuevo[]) =>
        votos.map((v) => ({
          temaId: v.temaId,
          codigoVerificacion: v.codigoVerificacion,
          createdAt: AHORA,
        })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Emisión de voto válido y voto secreto', () => {
    it('registra los votos en una transacción y devuelve un comprobante por tema sin revelar la opción elegida', async () => {
      const dto: EmitirVotosDto = {
        votos: [
          { temaId: TEMA_1_ID, opcionId: OPCION_1A_ID },
          { temaId: TEMA_2_ID, opcionId: OPCION_2B_ID },
        ],
      };

      const respuesta = await service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, dto);

      expect(unidadesMock.findDeUsuario).toHaveBeenCalledWith(RESIDENTE_1_ID);
      expect(repoMock.registrarVotosEnTransaccion).toHaveBeenCalledOnce();
      expect(repoMock.registrarVotosEnTransaccion).toHaveBeenCalledWith(
        ASAMBLEA_ID,
        UNIDAD_ID,
        RESIDENTE_1_ID,
        expect.arrayContaining([
          expect.objectContaining({
            temaId: TEMA_1_ID,
            opcionId: OPCION_1A_ID,
            codigoVerificacion: expect.stringMatching(/^[A-Z0-9]{8}$/),
          }),
          expect.objectContaining({
            temaId: TEMA_2_ID,
            opcionId: OPCION_2B_ID,
            codigoVerificacion: expect.stringMatching(/^[A-Z0-9]{8}$/),
          }),
        ]),
      );

      expect(respuesta.comprobantes).toHaveLength(2);
      for (const comprobante of respuesta.comprobantes) {
        expect(comprobante.codigoVerificacion).toMatch(/^[A-Z0-9]{8}$/);
        expect(comprobante.fecha).toBe(AHORA.toISOString());
        expect(Object.keys(comprobante).sort()).toEqual(['codigoVerificacion', 'fecha', 'temaId']);
        expect(comprobante).not.toHaveProperty('opcionId');
        expect(comprobante).not.toHaveProperty('opcion');
        expect(comprobante).not.toHaveProperty('texto');
      }
      expect(respuesta.comprobantes[0].temaId).toBe(TEMA_1_ID);
      expect(respuesta.comprobantes[1].temaId).toBe(TEMA_2_ID);
    });

    it('reintenta generar códigos si ocurre colisión de unicidad en codigo_verificacion', async () => {
      repoMock.registrarVotosEnTransaccion
        .mockRejectedValueOnce(new CodigoVerificacionColisionError())
        .mockResolvedValueOnce([
          { temaId: TEMA_1_ID, codigoVerificacion: 'K7Q2M9XA', createdAt: AHORA },
        ]);

      const respuesta = await service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
        votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
      });

      expect(repoMock.registrarVotosEnTransaccion).toHaveBeenCalledTimes(2);
      expect(respuesta.comprobantes).toEqual([
        {
          temaId: TEMA_1_ID,
          codigoVerificacion: 'K7Q2M9XA',
          fecha: AHORA.toISOString(),
        },
      ]);
    });
  });

  describe('2. Voto duplicado y concurrencia (P2002)', () => {
    it('lanza 409 "Tu unidad ya votó este tema" cuando el repositorio detecta voto duplicado', async () => {
      repoMock.registrarVotosEnTransaccion.mockRejectedValueOnce(new UnidadYaVotoError());

      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
        }),
      ).rejects.toThrow(new ConflictException('Tu unidad ya votó este tema'));
    });

    it('traduce P2002 concurrente sobre (tema_id, unidad_id) en AsambleaRepository a 409 para el segundo residente', async () => {
      let primerInsertCompletado = false;

      const prismaMock = {
        $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            voto: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn(async ({ data }: { data: { temaId: string; codigoVerificacion: string } }) => {
                if (!primerInsertCompletado) {
                  primerInsertCompletado = true;
                  return {
                    temaId: data.temaId,
                    codigoVerificacion: data.codigoVerificacion,
                    createdAt: AHORA,
                  };
                }
                throw new Prisma.PrismaClientKnownRequestError(
                  'Unique constraint failed on the fields: (`tema_id`,`unidad_id`)',
                  {
                    code: 'P2002',
                    clientVersion: '7.10.0',
                    meta: { target: ['tema_id', 'unidad_id'] },
                  },
                );
              }),
            },
          };
          return cb(tx);
        }),
        asamblea: {
          findUnique: vi.fn().mockResolvedValue(crearAsambleaMock()),
        },
      };

      const repoReal = new AsambleaRepository(prismaMock as unknown as PrismaService);
      const serviceConRepoReal = new AsambleaService(
        repoReal,
        notificacionesMock as unknown as NotificacionService,
        unidadesMock as unknown as UnidadRepository,
      );

      const dto: EmitirVotosDto = {
        votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
      };

      const [res1, res2] = await Promise.allSettled([
        serviceConRepoReal.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, dto),
        serviceConRepoReal.emitirVotos(ASAMBLEA_ID, RESIDENTE_2_ID, dto),
      ]);

      expect(res1.status).toBe('fulfilled');
      expect(res2.status).toBe('rejected');
      if (res2.status === 'rejected') {
        expect(res2.reason).toBeInstanceOf(ConflictException);
        expect((res2.reason as ConflictException).message).toBe('Tu unidad ya votó este tema');
      }
    });
  });

  describe('3. Ventana y estado de la asamblea (409 / 404)', () => {
    it('lanza 409 "La votación no está abierta" si la asamblea está en estado PUBLICADA', async () => {
      repoMock.findById.mockResolvedValueOnce(crearAsambleaMock(EstadoAsamblea.PUBLICADA));

      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
        }),
      ).rejects.toThrow(new ConflictException('La votación no está abierta'));
    });

    it('lanza 409 "La votación no está abierta" si la asamblea está en estado CERRADA', async () => {
      repoMock.findById.mockResolvedValueOnce(crearAsambleaMock(EstadoAsamblea.CERRADA));

      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
        }),
      ).rejects.toThrow(new ConflictException('La votación no está abierta'));
    });

    it('lanza 409 "La votación no está abierta" si está ABIERTA pero fuera del rango [apertura, cierre]', async () => {
      vi.setSystemTime(new Date('2026-11-20T21:00:00.000Z'));

      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
        }),
      ).rejects.toThrow(new ConflictException('La votación no está abierta'));
    });

    it('lanza 404 "La asamblea no existe" si la asamblea no existe', async () => {
      repoMock.findById.mockResolvedValueOnce(null);

      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_1A_ID }],
        }),
      ).rejects.toThrow(new NotFoundException('La asamblea no existe'));
    });
  });

  describe('4. Validaciones de entrada (400)', () => {
    it('lanza 400 si se envían temas repetidos en la misma petición', async () => {
      const dtoRepetido: EmitirVotosDto = {
        votos: [
          { temaId: TEMA_1_ID, opcionId: OPCION_1A_ID },
          { temaId: TEMA_1_ID, opcionId: OPCION_1B_ID },
        ],
      };

      await expect(service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, dtoRepetido)).rejects.toThrow(
        BadRequestException,
      );

      const dtoInstancia = plainToInstance(EmitirVotosDto, dtoRepetido);
      const errores = await validate(dtoInstancia);
      expect(errores.length).toBeGreaterThan(0);
    });

    it('lanza 400 si una opcionId no pertenece al temaId indicado', async () => {
      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_1_ID, opcionId: OPCION_2A_ID }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 400 si el temaId no pertenece a la asamblea', async () => {
      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, {
          votos: [{ temaId: TEMA_AJENO_ID, opcionId: OPCION_1A_ID }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 400 si la lista de votos está vacía o supera 10 elementos', async () => {
      await expect(service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, { votos: [] })).rejects.toThrow(
        BadRequestException,
      );

      const dtoVacio = plainToInstance(EmitirVotosDto, { votos: [] });
      expect((await validate(dtoVacio)).length).toBeGreaterThan(0);

      const onceVotos = Array.from({ length: 11 }, (_, i) => ({
        temaId: `22222222-2222-4222-8222-2222222222${String(i).padStart(2, '0')}`,
        opcionId: OPCION_1A_ID,
      }));
      await expect(
        service.emitirVotos(ASAMBLEA_ID, RESIDENTE_1_ID, { votos: onceVotos }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Control de acceso por rol (403)', () => {
    const reflector = new Reflector();
    const rolesGuard = new RolesGuard(reflector);

    function crearContextoEmitirVotos(rol: Rol): ExecutionContext {
      return {
        getHandler: () => AsambleaController.prototype.emitirVotos,
        getClass: () => AsambleaController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-1', rol },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('permite el acceso únicamente al rol RESIDENTE', () => {
      expect(rolesGuard.canActivate(crearContextoEmitirVotos(Rol.RESIDENTE))).toBe(true);
    });

    it('rechaza con 403 "No tienes permiso para esta acción" a ADMINISTRADOR y SEGURIDAD', () => {
      expect(() => rolesGuard.canActivate(crearContextoEmitirVotos(Rol.ADMINISTRADOR))).toThrow(
        new ForbiddenException('No tienes permiso para esta acción'),
      );
      expect(() => rolesGuard.canActivate(crearContextoEmitirVotos(Rol.SEGURIDAD))).toThrow(
        new ForbiddenException('No tienes permiso para esta acción'),
      );
    });
  });

  describe('6. Consulta de detalle para residente sin revelar opción elegida', () => {
    it('devuelve los temas, opciones y qué temas ya votó la unidad sin exponer opcionId', async () => {
      repoMock.findDetalleConVotosUnidad.mockResolvedValueOnce({
        asamblea: crearAsambleaMock(),
        votosUnidad: [{ temaId: TEMA_1_ID, codigoVerificacion: 'K7Q2M9XA', createdAt: AHORA }],
      });

      const detalle = await service.obtenerDetalle(ASAMBLEA_ID, {
        id: RESIDENTE_1_ID,
        rol: Rol.RESIDENTE,
      });

      expect(detalle.temasVotados).toEqual([TEMA_1_ID]);
      expect(detalle.temas[0].yaVoto).toBe(true);
      expect(detalle.temas[0].codigoVerificacion).toBe('K7Q2M9XA');
      expect(detalle.temas[0]).not.toHaveProperty('opcionId');
      expect(detalle.temas[1].yaVoto).toBe(false);
      expect(detalle.temas[1].codigoVerificacion).toBeNull();
    });

    it('retorna 404 si un residente intenta consultar una asamblea en BORRADOR', async () => {
      repoMock.findDetalleConVotosUnidad.mockResolvedValueOnce({
        asamblea: crearAsambleaMock(EstadoAsamblea.BORRADOR),
        votosUnidad: [],
      });

      await expect(
        service.obtenerDetalle(ASAMBLEA_ID, { id: RESIDENTE_1_ID, rol: Rol.RESIDENTE }),
      ).rejects.toThrow(new NotFoundException('La asamblea no existe'));
    });
  });
});