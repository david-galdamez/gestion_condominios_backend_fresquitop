import { Module } from '@nestjs/common';
import { AreasModule } from '@Areas';
import { UnidadesModule } from '@Unidades';
import { ReservasController } from '@Reservas/controllers';
import { ReservaRepository } from '@Reservas/repositories';
import { ReservasService } from '@Reservas/services';

@Module({
  imports: [AreasModule, UnidadesModule],
  controllers: [ReservasController],
  providers: [ReservasService, ReservaRepository],
})
export class ReservasModule {}
