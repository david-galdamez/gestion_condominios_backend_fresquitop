import { Module } from '@nestjs/common';
import { MorosidadModule } from '@Morosidad';
import { PanelModule } from '@Panel';
import { ExportacionesController } from './controllers/index.js';
import { ExportacionRepository } from './repositories/index.js';
import { ExportacionesService } from './services/index.js';

/** H20 · Exportar el reporte del panel (H19) para la mesa directiva. */
@Module({
  imports: [PanelModule, MorosidadModule],
  controllers: [ExportacionesController],
  providers: [ExportacionesService, ExportacionRepository],
})
export class ExportacionesModule {}
