import { Module } from '@nestjs/common';
import { ArchivosService } from '@Archivos/services';

@Module({
  providers: [ArchivosService],
  exports: [ArchivosService],
})
export class ArchivosModule {}
