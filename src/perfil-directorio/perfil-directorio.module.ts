import { Module } from '@nestjs/common';
import { PerfilDirectorioController } from '@PerfilDirectorio/controllers';
import { PerfilDirectorioRepository } from '@PerfilDirectorio/repositories';
import { PerfilDirectorioService } from '@PerfilDirectorio/services';

/**
 * H15: cada residente decide si aparece en el directorio y qué datos muestra.
 * La búsqueda de vecinos (H16, GET /directorio) va en su propio módulo y
 * reutiliza el repositorio y `aplicarPrivacidad` de acá.
 */
@Module({
  controllers: [PerfilDirectorioController],
  providers: [PerfilDirectorioService, PerfilDirectorioRepository],
  exports: [PerfilDirectorioRepository],
})
export class PerfilDirectorioModule {}
