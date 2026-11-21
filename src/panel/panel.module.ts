import { Module } from '@nestjs/common';
import { MorosidadModule } from '@Morosidad';
import { PanelController } from './controllers/index.js';
import { PanelRepository } from './repositories/index.js';
import { PanelService } from './services/index.js';

@Module({
  imports: [MorosidadModule],
  controllers: [PanelController],
  providers: [PanelService, PanelRepository],
  // H20 exporta el reporte con este mismo servicio, así los valores coinciden con el panel.
  exports: [PanelService],
})
export class PanelModule {}
