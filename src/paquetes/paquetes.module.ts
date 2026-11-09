import { Module } from '@nestjs/common';
import { ArchivosModule } from '@Archivos';
import { NotificacionesModule } from '@Notificaciones';
import { PaquetesController } from '@Paquetes/controllers';
import { PaqueteRepository } from '@Paquetes/repositories';
import { PaquetesService } from '@Paquetes/services';
import { UnidadesModule } from '@Unidades';

@Module({
  imports: [UnidadesModule, ArchivosModule, NotificacionesModule],
  controllers: [PaquetesController],
  providers: [PaquetesService, PaqueteRepository],
  // H10 (entrega) y H26 (mis paquetes) reutilizan las consultas.
  exports: [PaqueteRepository],
})
export class PaquetesModule {}
