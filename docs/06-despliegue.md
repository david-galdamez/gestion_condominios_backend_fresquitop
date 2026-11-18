# Despliegue

> Estado: el sistema todavía no está desplegado. Esta página describe el plan;
> se completarán las URL cuando se publique la versión 1.0.0.

## Dónde está desplegado

| Componente | Plataforma | URL | Rama |
|---|---|---|---|
| Frontend | Vercel | Pendiente | main |
| Backend | Render (Docker) | Pendiente | main |
| Base de datos | Neon (PostgreSQL) | (privada) | |

La documentación de la API queda publicada en `https://<url-del-backend>/api/docs`.

En los planes gratuitos el backend se apaga tras un rato sin uso y la primera
petición tarda en responder: abrir el sistema unos minutos antes de una revisión.

## Cómo se publica una nueva versión

1. Con las historias en `develop`, crear `release/X.Y.Z` desde `develop`. En esa rama solo van ajustes finales (versión en `package.json`, correcciones menores).
2. Abrir un PR de `release/X.Y.Z` hacia `main`, aprobado por otro integrante, y fusionarlo. Después fusionar `release/X.Y.Z` de vuelta a `develop`.
3. Etiquetar el commit de `main` con `vX.Y.Z` desde GitHub → Releases, con una lista corta de lo que incluye (ambos repositorios llevan su release).
4. La plataforma despliega automáticamente al detectar el cambio en `main`. El contenedor ejecuta `npx prisma migrate deploy` antes de arrancar, así que las migraciones nuevas se aplican solas.
5. Si hay datos semilla nuevos, correr `npm run db:seed` una vez con la `DATABASE_URL` de producción.
6. Un defecto en producción se corrige con `hotfix/<descripcion>` desde `main`, que se fusiona a `main` y a `develop` y sube la versión de parche (`v1.0.1`).

## Variables de entorno en producción

Solo los nombres; los valores se configuran en la plataforma y nunca en el repositorio.

| Variable | Dónde se configura |
|---|---|
| `NODE_ENV` (`production`) | Render → Environment |
| `PORT` | Render (la asigna la plataforma) |
| `DATABASE_URL` | Render → Environment (cadena de Neon con `sslmode=require`) |
| `JWT_SECRET` | Render → Environment |
| `JWT_EXPIRES_IN` | Render → Environment |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Render → Environment |
| `BCRYPT_SALT_ROUNDS` | Render → Environment |
| `UPLOAD_DIR` | Render → Environment (disco persistente) |
| `API_URL` (frontend) | Vercel → Environment Variables |
