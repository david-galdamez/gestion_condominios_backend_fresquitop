import { Module } from '@nestjs/common';
import { AdminReportesController, ReportesController } from '@Reportes/controllers';
import { AdminReportesService, EvidenciaStorageService, ReportesService } from '@Reportes/services';
import { ReporteRepository } from '@Reportes/repositories';

@Module({
  controllers: [ReportesController, AdminReportesController],
  providers: [ReportesService, AdminReportesService, EvidenciaStorageService, ReporteRepository],
})
export class ReportesModule {}