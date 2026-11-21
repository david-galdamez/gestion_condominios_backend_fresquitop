import { config } from 'dotenv';

// Se ejecuta en cada worker antes de importar la app. dotenv no pisa variables
// ya definidas, así que .env.test debe cargarse primero: el `.env` de
// desarrollo que lee ConfigModule después ya no puede cambiar DATABASE_URL.
config({ path: '.env.test', quiet: true });

// La pasarela simulada espera 2 s por pago (H21); en los e2e se responde al instante.
process.env.PASARELA_ESPERA_MS ??= '0';
