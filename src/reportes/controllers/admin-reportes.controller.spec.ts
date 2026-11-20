import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from '@Auth/guards';
import { Rol } from '@PrismaClient';
import { AdminReportesController } from './admin-reportes.controller.js';

function crearContexto(handler: (...args: never[]) => unknown, rol: Rol): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => AdminReportesController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'u-1', rol } }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminReportesController — control de acceso por rol (H06)', () => {
  const guard = new RolesGuard(new Reflector());
  const handlers = [
    ['listar', AdminReportesController.prototype.listar],
    ['obtenerDetalle', AdminReportesController.prototype.obtenerDetalle],
    ['asignar', AdminReportesController.prototype.asignar],
  ] as const;

  it.each(handlers)('permite acceso a ADMINISTRADOR en %s', (_nombre, handler) => {
    expect(guard.canActivate(crearContexto(handler, Rol.ADMINISTRADOR))).toBe(true);
  });

  it.each(handlers)('rechaza con 403 a RESIDENTE en %s', (_nombre, handler) => {
    expect(() => guard.canActivate(crearContexto(handler, Rol.RESIDENTE))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(crearContexto(handler, Rol.RESIDENTE))).toThrow(
      'No tienes permiso para esta acción',
    );
  });

  it.each(handlers)('rechaza con 403 a SEGURIDAD en %s', (_nombre, handler) => {
    expect(() => guard.canActivate(crearContexto(handler, Rol.SEGURIDAD))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(crearContexto(handler, Rol.SEGURIDAD))).toThrow(
      'No tienes permiso para esta acción',
    );
  });
});