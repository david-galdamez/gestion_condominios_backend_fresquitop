import { Module } from '@nestjs/common';
import { NotificacionesModule } from '@Notificaciones';
import { UnidadesModule } from '@Unidades';
import { AsambleaController } from './controllers/index.js';
import { AsambleaRepository } from './repositories/index.js';
import { AsambleaService } from './services/index.js';

@Module({
  imports: [NotificacionesModule, UnidadesModule],
  controllers: [AsambleaController],
  providers: [AsambleaService, AsambleaRepository],
})
export class AsambleasModule {}