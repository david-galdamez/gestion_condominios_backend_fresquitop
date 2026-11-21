import { Module } from '@nestjs/common';
import { PerfilDirectorioModule } from '@PerfilDirectorio';
import { DirectorioController } from './controllers/index.js';
import { DirectorioService } from './services/index.js';

/** H16 · Buscar el contacto de un vecino. Reutiliza la privacidad de H15. */
@Module({
  imports: [PerfilDirectorioModule],
  controllers: [DirectorioController],
  providers: [DirectorioService],
})
export class DirectorioModule {}
