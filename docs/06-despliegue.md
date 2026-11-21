# Despliegue

> Estado: preparado para desplegar (Neon + Render + Vercel). Se completarán las
> URL cuando se publique.

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
| `NODE_ENV` (`production`) | Render → Environment (ya viene en `render.yaml`) |
| `PORT` | Render (la asigna la plataforma; la API la lee sola) |
| `DATABASE_URL` | Render → Environment (cadena **directa** de Neon, ver abajo) |
| `JWT_SECRET` | Render (`render.yaml` lo genera; mínimo 32 caracteres) |
| `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN_DAYS`, `BCRYPT_SALT_ROUNDS` | Render (valores por defecto en `render.yaml`) |
| `FRONTEND_URL` | Render → Environment (URL de Vercel, sin barra final; es el origen que permite CORS) |
| `API_URL` (frontend) | Vercel → Environment Variables (`https://<backend>.onrender.com/api/v1`) |

Las fotos y archivos se guardan en la tabla `archivo` de Postgres, así que **no
hace falta disco persistente** (no existe `UPLOAD_DIR`).

## Primer despliegue (orden)

### 1. Base de datos en Neon
1. Crear un proyecto en [neon.tech](https://neon.tech) (misma región que Render, p. ej. AWS us-west-2 / Oregon).
2. En **Connect**, desactivar "Connection pooling" y copiar la cadena **directa** (el host no lleva `-pooler`). `prisma migrate` usa locks que el pooler (pgbouncer) no soporta.
3. Quitar `&channel_binding=require` si aparece: el driver `pg` no lo necesita. Debe quedar así:
   `postgresql://USUARIO:CLAVE@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`

### 2. Backend en Render
1. New → **Blueprint** → elegir el repo del backend (lee `render.yaml`) o New → Web Service → Docker con la misma configuración.
2. Cuando lo pida, pegar `DATABASE_URL` (paso 1). `FRONTEND_URL` se puede dejar provisional y completarlo tras el paso 3.
3. Al desplegar, el contenedor aplica las migraciones solo. Verificar `https://<backend>.onrender.com/api/v1` (responde `Hello World!`) y `/api/docs`.

### 3. Frontend en Vercel
1. Import Project → repo del frontend (Next.js se detecta solo; sin ajustes de build).
2. Variable `API_URL` = `https://<backend>.onrender.com/api/v1` (incluye `/api/v1`, sin barra final). Elegir la región de Functions cercana a Render.
3. Desplegar y copiar la URL de producción.
4. Volver a Render y poner `FRONTEND_URL` = esa URL (sin barra final); Render redespliega.

### 4. Datos iniciales (seed)
Se corre **una vez desde tu máquina** apuntando a Neon (Render free no tiene shell).
Con `NODE_ENV=production` el seed exige las tres contraseñas y no usa las de ejemplo:

```bash
cd gestion_condominios_backend
NODE_ENV=production \
DATABASE_URL='<cadena directa de Neon>' \
SEED_PASSWORD_ADMIN='<clave fuerte>' \
SEED_PASSWORD_RESIDENTE='<clave fuerte>' \
SEED_PASSWORD_SEGURIDAD='<clave fuerte>' \
npm run db:seed
```

El seed crea también datos de demostración (unidades, residentes, cuotas, etc.).
Si se quiere producción limpia, crear al admin y las unidades a mano en lugar de
sembrar. El seed es idempotente pero **no cambia contraseñas de usuarios que ya existen**.

## Limitaciones conocidas de esta plataforma
- **Render free** se duerme tras ~15 min sin tráfico: la primera petición tarda ~50 s. Neon free también suspende el cómputo y la primera consulta añade un instante.
- **Vercel** limita el cuerpo de una petición a ~4.5 MB. Por eso el frontend reduce las fotos en el navegador (máx. 1600 px, JPEG, ~700 KB cada una) antes de subirlas, y rechaza un envío de fotos de reporte que en conjunto supere 4 MB.
- **Mantener despierto el backend:** un monitor (p. ej. UptimeRobot, cada 5 min) sobre `GET https://<backend>.onrender.com/api/v1` evita que Render lo duerma. Es un endpoint público que responde 200.
