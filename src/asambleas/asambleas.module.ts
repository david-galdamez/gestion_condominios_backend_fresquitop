import { Module } from '@nestjs/common';
import { AsambleaController } from './controllers/index.js';
import { AsambleaRepository } from './repositories/index.js';
import { AsambleaService } from './services/index.js';
import { NotificacionesModule } from '@Notificaciones';

@Module({
  imports: [NotificacionesModule],
  controllers: [AsambleaController],
  providers: [AsambleaService, AsambleaRepository],
})
export class AsambleasModule {}
