import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';

// Se ejecuta en cada worker antes de importar la app. dotenv no pisa variables
// ya definidas, así que .env.test debe cargarse primero: el `.env` de
// desarrollo que lee ConfigModule después ya no puede cambiar DATABASE_URL.
config({ path: '.env.test', quiet: true });

// Las fotos de los e2e van a una carpeta temporal, no a uploads/ del proyecto.
process.env.UPLOAD_DIR ??= join(tmpdir(), 'condominios-e2e-uploads');
