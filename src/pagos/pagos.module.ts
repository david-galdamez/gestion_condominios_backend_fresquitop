import { Module } from '@nestjs/common';
import { PagosController } from '@Pagos/controllers';
import { PagoRepository } from '@Pagos/repositories';
import { PagosService, PasarelaSimuladaService } from '@Pagos/services';
import { UnidadesModule } from '@Unidades';

@Module({
  imports: [UnidadesModule],
  controllers: [PagosController],
  providers: [PagosService, PasarelaSimuladaService, PagoRepository],
})
export class PagosModule {}
