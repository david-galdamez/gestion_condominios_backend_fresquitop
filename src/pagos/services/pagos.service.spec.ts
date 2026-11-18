import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { UnidadRepository } from '@Unidades/repositories';
import { Prisma } from '@PrismaClient';
import type { PagarCuotasDto } from '../dto/pagar-cuotas.dto.js';
import { ClaveIdempotenciaRepetidaError } from '../errors/clave-idempotencia-repetida.error.js';
import type { PagoRepository } from '../repositories/pago.repository.js';
import { MSG_UNA_UNIDAD, MSG_YA_PAGADA, PagosService } from './pagos.service.js';
import type { PasarelaSimuladaService } from './pasarela-simulada.service.js';

const D = (n: number) => new Prisma.Decimal(n);

describe('PagosService', () => {
  const tx = {
    bloquearCuotas: vi.fn(),
    findByClave: vi.fn(),
    siguienteNumero: vi.fn(),
    crearAprobado: vi.fn(),
    crearRechazado: vi.fn(),
    marcarPagadas: vi.fn(),
  };
  const repo = {
    enTransaccion: vi.fn(async (trabajo: (t: typeof tx) => unknown) => trabajo(tx)),
    findClave: vi.fn(),
    findByNumero: vi.fn(),
    findPorPagar: vi.fn(),
  };
  const unidades = { findDeUsuario: vi.fn() };
  const pasarela = { cobrar: vi.fn() };
  const service = new PagosService(
    repo as unknown as PagoRepository,
    unidades as unknown as UnidadRepository,
    pasarela as unknown as PasarelaSimuladaService,
  );

  const dto = (ids = ['c1', 'c2']) =>
    ({ cuotaIds: ids, tarjeta: { numero: '4242424242424242', vencimiento: '12/39', cvv: '123', titular: 'Ana' } }) as PagarCuotasDto;
  const cuota = (id: string, extra: object = {}) => ({ id, unidadId: 'u1', periodo: '2026-10', monto: D(45), estado: 'VENCIDA', ...extra });
  const pago = (extra: object = {}) => ({
    id: 'p1',
    numeroTransaccion: 'TX-20261117-000001',
    estado: 'APROBADO',
    monto: D(90),
    ultimos4: '4242',
    motivo: null,
    createdAt: new Date('2026-11-17T16:00:00.000Z'),
    ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.enTransaccion.mockImplementation(async (trabajo) => trabajo(tx));
    unidades.findDeUsuario.mockResolvedValue([{ id: 'u1', codigo: 'A-101' }, { id: 'u2', codigo: 'B-205' }]);
    tx.bloquearCuotas.mockResolvedValue([cuota('c1'), cuota('c2', { periodo: '2026-11', estado: 'PENDIENTE' })]);
    tx.findByClave.mockResolvedValue(null);
    tx.siguienteNumero.mockResolvedValue('TX-20261117-000001');
    tx.crearAprobado.mockResolvedValue(pago());
    pasarela.cobrar.mockResolvedValue({ aprobado: true, ultimos4: '4242' });
  });

  describe('pagar', () => {
    it('aprobado: cobra la suma, guarda pago y marca PAGADA; solo guarda los últimos 4', async () => {
      const r = await service.pagar('r1', 'k1', dto());
      expect(pasarela.cobrar.mock.calls[0][0].toString()).toBe('90');
      const [datos, numero, cuotas] = tx.crearAprobado.mock.calls[0];
      expect(datos).toMatchObject({ unidadId: 'u1', residenteId: 'r1', ultimos4: '4242', titular: 'Ana', idempotencyKey: 'k1' });
      expect(JSON.stringify(datos)).not.toContain('4242424242424242');
      expect(JSON.stringify(datos)).not.toContain('123');
      expect(numero).toBe('TX-20261117-000001');
      expect(cuotas).toHaveLength(2);
      expect(tx.marcarPagadas).toHaveBeenCalledWith(['c1', 'c2'], expect.any(Date));
      expect(r).toEqual({
        numeroTransaccion: 'TX-20261117-000001',
        estado: 'APROBADO',
        monto: 90,
        ultimos4: '4242',
        fecha: '2026-11-17T16:00:00.000Z',
        cuotas: ['c1', 'c2'],
      });
    });

    it('rechazado: guarda RECHAZADO con motivo, no toca cuotas y responde 422', async () => {
      pasarela.cobrar.mockResolvedValue({ aprobado: false, motivo: 'Fondos insuficientes', ultimos4: '0002' });
      const error = await service.pagar('r1', 'k1', dto()).catch((e) => e);
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error.getResponse()).toMatchObject({
        estado: 'RECHAZADO',
        motivo: 'Fondos insuficientes',
        message: 'Pago rechazado: fondos insuficientes',
      });
      expect(tx.crearRechazado).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'k1' }), 'Fondos insuficientes');
      expect(tx.marcarPagadas).not.toHaveBeenCalled();
    });

    it('misma clave ya procesada: devuelve el original sin cobrar', async () => {
      tx.findByClave.mockResolvedValue(pago());
      const r = await service.pagar('r1', 'k1', dto());
      expect(r.numeroTransaccion).toBe('TX-20261117-000001');
      expect(pasarela.cobrar).not.toHaveBeenCalled();
      expect(tx.crearAprobado).not.toHaveBeenCalled();
    });

    it('misma clave ganada por otra solicitud (P2002): responde con el pago original', async () => {
      tx.crearAprobado.mockRejectedValue(new ClaveIdempotenciaRepetidaError('k1'));
      repo.findClave.mockResolvedValue(pago({ numeroTransaccion: 'TX-20261117-000009' }));
      expect((await service.pagar('r1', 'k1', dto())).numeroTransaccion).toBe('TX-20261117-000009');
    });

    it('cuota ya PAGADA -> 409 sin cobrar', async () => {
      tx.bloquearCuotas.mockResolvedValue([cuota('c1'), cuota('c2', { estado: 'PAGADA' })]);
      await expect(service.pagar('r1', 'k1', dto())).rejects.toThrow(new ConflictException(MSG_YA_PAGADA));
      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });

    it('cuota inexistente o de una unidad ajena -> 404 sin cobrar', async () => {
      tx.bloquearCuotas.mockResolvedValueOnce([cuota('c1')]);
      await expect(service.pagar('r1', 'k1', dto())).rejects.toBeInstanceOf(NotFoundException);
      tx.bloquearCuotas.mockResolvedValueOnce([cuota('c1'), cuota('c2', { unidadId: 'otra' })]);
      await expect(service.pagar('r1', 'k1', dto())).rejects.toBeInstanceOf(NotFoundException);
      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });

    it('cuotas de dos unidades propias -> 400', async () => {
      tx.bloquearCuotas.mockResolvedValue([cuota('c1'), cuota('c2', { unidadId: 'u2' })]);
      await expect(service.pagar('r1', 'k1', dto())).rejects.toThrow(new BadRequestException(MSG_UNA_UNIDAD));
    });
  });

  describe('porPagar', () => {
    it('usa la primera unidad por defecto y mapea montos y fechas', async () => {
      repo.findPorPagar.mockResolvedValue([
        { id: 'c1', periodo: '2026-10', monto: D(45), fechaVencimiento: new Date('2026-10-10T00:00:00.000Z'), estado: 'VENCIDA' },
      ]);
      const r = await service.porPagar('r1');
      expect(repo.findPorPagar).toHaveBeenCalledWith('u1');
      expect(r.cuotas).toEqual([{ id: 'c1', periodo: '2026-10', monto: 45, fechaVencimiento: '2026-10-10', estado: 'VENCIDA' }]);
    });

    it('unidad ajena -> 403; sin unidades -> lista vacía', async () => {
      await expect(service.porPagar('r1', 'otra')).rejects.toBeInstanceOf(ForbiddenException);
      unidades.findDeUsuario.mockResolvedValue([]);
      expect(await service.porPagar('r1')).toEqual({ unidad: null, unidades: [], cuotas: [] });
    });
  });

  describe('comprobante', () => {
    it('de mi unidad lo devuelve; de otra o inexistente -> 404', async () => {
      repo.findByNumero.mockResolvedValue({
        ...pago(),
        unidadId: 'u1',
        titular: 'Ana',
        unidad: { codigo: 'A-101' },
        cuotas: [{ monto: D(45), cuota: { periodo: '2026-10' } }],
      });
      expect(await service.comprobante('r1', 'TX-20261117-000001')).toMatchObject({
        unidad: 'A-101',
        monto: 90,
        cuotas: [{ periodo: '2026-10', monto: 45 }],
      });
      unidades.findDeUsuario.mockResolvedValue([{ id: 'u9', codigo: 'C-1' }]);
      await expect(service.comprobante('r1', 'TX-20261117-000001')).rejects.toBeInstanceOf(NotFoundException);
      repo.findByNumero.mockResolvedValue(null);
      await expect(service.comprobante('r1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
