import { Module } from '@nestjs/common';
import { CuotasController } from '@Cuotas/controllers';
import {
  ConfiguracionCuotaRepository,
  GeneracionCuotaRepository,
} from '@Cuotas/repositories';
import {
  AvisoCuotasService,
  CuotasService,
  GeneracionAutomaticaService,
} from '@Cuotas/services';
import { NotificacionesModule } from '@Notificaciones';

/** H02: configuración de la cuota, generación por periodo (manual y día 1) y aviso por vencer. */
@Module({
  imports: [NotificacionesModule],
  controllers: [CuotasController],
  providers: [
    CuotasService,
    GeneracionAutomaticaService,
    AvisoCuotasService,
    ConfiguracionCuotaRepository,
    GeneracionCuotaRepository,
  ],
})
export class CuotasModule {}
