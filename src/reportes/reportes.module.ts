import { Module } from '@nestjs/common';
import { ReportesController } from '@Reportes/controllers';
import { EvidenciaStorageService, ReportesService } from '@Reportes/services';
import { ReporteRepository } from '@Reportes/repositories';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, EvidenciaStorageService, ReporteRepository],
})
export class ReportesModule {}
