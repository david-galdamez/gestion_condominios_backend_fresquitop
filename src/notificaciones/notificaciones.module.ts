import { Module } from '@nestjs/common';
import { NotificacionRepository } from './repositories/index.js';
import { NotificacionService } from './services/index.js';
import { NotificacionesController } from './controllers/index.js';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionRepository, NotificacionService],
  exports: [NotificacionService],
})
export class NotificacionesModule {}