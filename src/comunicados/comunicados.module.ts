import { Module } from '@nestjs/common';
import { ComunicadosController, MisComunicadosController } from '@Comunicados/controllers';
import { ComunicadoRepository } from '@Comunicados/repositories';
import { ComunicadosPublicacionService, ComunicadosService, MisComunicadosService } from '@Comunicados/services';
import { NotificacionesModule } from '@Notificaciones';

@Module({
  imports: [NotificacionesModule],
  controllers: [ComunicadosController, MisComunicadosController],
  providers: [ComunicadosService, ComunicadosPublicacionService, MisComunicadosService, ComunicadoRepository],
  exports: [ComunicadoRepository],
})
export class ComunicadosModule {}
