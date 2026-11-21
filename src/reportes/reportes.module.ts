import { Module } from '@nestjs/common';
import { NotificacionesModule } from '@Notificaciones';
import { AdminReportesController, ReportesController } from '@Reportes/controllers';
import { AdminReportesService, EvidenciaStorageService, ReportesService } from '@Reportes/services';
import { ReporteRepository } from '@Reportes/repositories';

@Module({
  imports: [NotificacionesModule],
  controllers: [ReportesController, AdminReportesController],
  providers: [ReportesService, AdminReportesService, EvidenciaStorageService, ReporteRepository],
})
export class ReportesModule {}