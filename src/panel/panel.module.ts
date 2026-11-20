import { Module } from '@nestjs/common';
import { MorosidadModule } from '@Morosidad';
import { PanelController } from './controllers/index.js';
import { PanelRepository } from './repositories/index.js';
import { PanelService } from './services/index.js';

@Module({
  imports: [MorosidadModule],
  controllers: [PanelController],
  providers: [PanelService, PanelRepository],
})
export class PanelModule {}
