import { Module } from '@nestjs/common';
import { ComunicadosController } from '@Comunicados/controllers';
import { ComunicadoRepository } from '@Comunicados/repositories';
import { ComunicadosPublicacionService, ComunicadosService } from '@Comunicados/services';
import { NotificacionesModule } from '@Notificaciones';

@Module({
  imports: [NotificacionesModule],
  controllers: [ComunicadosController],
  providers: [ComunicadosService, ComunicadosPublicacionService, ComunicadoRepository],
  // H14 (ver mis comunicados) reutiliza las consultas.
  exports: [ComunicadoRepository],
})
export class ComunicadosModule {}
