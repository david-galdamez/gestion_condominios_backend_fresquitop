import { Module } from '@nestjs/common';
import { MorosidadController } from '@Morosidad/controllers';
import { MorosidadService } from '@Morosidad/services';
import { MorosidadRepository } from '@Morosidad/repositories';

@Module({
  controllers: [MorosidadController],
  providers: [MorosidadService, MorosidadRepository],
  exports: [MorosidadService, MorosidadRepository],
})
export class MorosidadModule {}
