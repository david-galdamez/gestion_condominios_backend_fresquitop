import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from '@Auth/guards';
import { Rol } from '@PrismaClient';
import { AdminReportesController } from './admin-reportes.controller.js';
import { ReportesController } from './reportes.controller.js';

function crearContexto(
  controllerClass: unknown,
  handler: (...args: never[]) => unknown,
  rol: Rol,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'u-1', rol } }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminReportesController — control de acceso por rol (H06 y H24)', () => {
  const guard = new RolesGuard(new Reflector());
  const handlers = [
    ['listar', AdminReportesController.prototype.listar],
    ['obtenerDetalle', AdminReportesController.prototype.obtenerDetalle],
    ['asignar', AdminReportesController.prototype.asignar],
    ['resolver', AdminReportesController.prototype.resolver],
  ] as const;

  it.each(handlers)('permite acceso a ADMINISTRADOR en %s', (_nombre, handler) => {
    expect(guard.canActivate(crearContexto(AdminReportesController, handler, Rol.ADMINISTRADOR))).toBe(true);
  });

  it.each(handlers)('rechaza con 403 a RESIDENTE en %s', (_nombre, handler) => {
    expect(() =>
      guard.canActivate(crearContexto(AdminReportesController, handler, Rol.RESIDENTE)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(crearContexto(AdminReportesController, handler, Rol.RESIDENTE)),
    ).toThrow('No tienes permiso para esta acción');
  });

  it.each(handlers)('rechaza con 403 a SEGURIDAD en %s', (_nombre, handler) => {
    expect(() =>
      guard.canActivate(crearContexto(AdminReportesController, handler, Rol.SEGURIDAD)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(crearContexto(AdminReportesController, handler, Rol.SEGURIDAD)),
    ).toThrow('No tienes permiso para esta acción');
  });
});

describe('ReportesController — control de acceso por rol en detalle/historial (BE-24.2)', () => {
  const guard = new RolesGuard(new Reflector());

  it('permite acceso a RESIDENTE en obtener', () => {
    expect(
      guard.canActivate(
        crearContexto(ReportesController, ReportesController.prototype.obtener, Rol.RESIDENTE),
      ),
    ).toBe(true);
  });

  it.each([Rol.ADMINISTRADOR, Rol.SEGURIDAD])('rechaza con 403 a %s en obtener', (rol) => {
    expect(() =>
      guard.canActivate(crearContexto(ReportesController, ReportesController.prototype.obtener, rol)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(crearContexto(ReportesController, ReportesController.prototype.obtener, rol)),
    ).toThrow('No tienes permiso para esta acción');
  });
});