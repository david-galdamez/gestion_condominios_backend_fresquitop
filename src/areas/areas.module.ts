import { Module } from '@nestjs/common';
import { AreasController } from '@Areas/controllers';
import { AreaRepository } from '@Areas/repositories';
import { AreasService } from '@Areas/services';

@Module({
  controllers: [AreasController],
  providers: [AreasService, AreaRepository],
  // Disponibilidad (H23) y reservas (H04) leen las áreas desde acá.
  exports: [AreaRepository],
})
export class AreasModule {}
