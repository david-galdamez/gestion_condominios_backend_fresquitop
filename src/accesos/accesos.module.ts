import { Module } from '@nestjs/common';
import { AccesosController, PorteriaAutorizacionesController } from '@Accesos/controllers';
import { AccesoRepository } from '@Accesos/repositories';
import { AccesosService } from '@Accesos/services';
import { UnidadesModule } from '@Unidades';

/** H08: registro de entradas y salidas de visitantes en portería. */
@Module({
  imports: [UnidadesModule],
  controllers: [AccesosController, PorteriaAutorizacionesController],
  providers: [AccesosService, AccesoRepository],
})
export class AccesosModule {}
