import { Module } from '@nestjs/common';
import { AreasController } from '@Areas/controllers';
import { AreaRepository, DisponibilidadRepository } from '@Areas/repositories';
import { AreasService, DisponibilidadService } from '@Areas/services';

@Module({
  controllers: [AreasController],
  providers: [AreasService, AreaRepository, DisponibilidadService, DisponibilidadRepository],
  // Disponibilidad (H23) y reservas (H04) leen las áreas desde acá.
  exports: [AreaRepository],
})
export class AreasModule {}
