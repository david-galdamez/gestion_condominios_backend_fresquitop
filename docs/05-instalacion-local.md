# Instalación local

## Requisitos

- Docker y docker-compose (Compose v2; Docker Desktop en Windows con la integración WSL activa).
- Node.js 24 y npm (solo si la API corre fuera de Docker, que es lo recomendado para desarrollar).
- El frontend está en otro repositorio: [gestion_condominios_frontend_fresquitop](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop).

## Pasos

### Opción A: Postgres en Docker y API en el host (desarrollo)

1. Clonar el repositorio.
2. Copiar el archivo de variables: `cp .env.example .env` y completar `JWT_SECRET` (`openssl rand -base64 32`).
3. Levantar solo la base: `docker compose up -d postgres`
4. Instalar dependencias (el `postinstall` genera el cliente de Prisma): `npm install`
5. Aplicar las migraciones: `npm run prisma:deploy`
6. Cargar los datos semilla: `npm run db:seed`
7. Arrancar la API en modo watch: `npm run start:dev`
8. Abrir <http://localhost:3000/api/docs> (Swagger).

### Opción B: todo en Docker

1. `cp .env.example .env` y completar `JWT_SECRET`.
2. `docker compose up -d --build` (la API aplica las migraciones al arrancar).
3. Cargar los datos semilla desde el host: `npm install && npm run db:seed`
   (con `DATABASE_URL` apuntando a `localhost:5432`).
4. Abrir <http://localhost:3000/api/docs>.

### Datos semilla

`prisma/seed.ts` es idempotente (usa `upsert`) y es el mismo script en local y en
producción (`npm run db:seed` con la `DATABASE_URL` correspondiente). Crea:

- Las torres A y B y las unidades A-101, A-102 y B-205.
- Un usuario por rol (Residente, Administrador, Seguridad) y residentes con una y con varias unidades.
- Cuotas Pagadas, Vencidas y Pendientes para recorrer el estado de cuenta y la morosidad.
- Autorizaciones de visita, paquetes, áreas comunes y comunicados (publicado, programado y expirado).

Las credenciales de prueba se entregan por Moodle.

`npm run db:reset` borra la base, vuelve a aplicar las migraciones y corre el seed.

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `development` |
| `PORT` | Puerto HTTP de la API | `3000` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Inicializan el contenedor de Postgres (solo docker-compose) | `postgres` / `postgres` / `si_be_boilerplate` / `5432` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://postgres:postgres@localhost:5432/si_be_boilerplate?schema=public` |
| `JWT_SECRET` | Secreto para firmar los access tokens | (cadena aleatoria larga) |
| `JWT_EXPIRES_IN` | Duración del access token | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Duración del refresh token | `7` |
| `BCRYPT_SALT_ROUNDS` | Costo de bcrypt | `12` |
| `UPLOAD_DIR` | Carpeta de fotos subidas (paquetes, reportes) | `uploads` |

## Pruebas automatizadas

```
npm test           # unitarias (Vitest), sin base de datos
npm run test:e2e   # integración: levanta la app real contra PostgreSQL
npm run lint       # oxlint con reglas de tipos
```

- Las pruebas unitarias viven junto al código: `src/**/*.spec.ts`.
- Las e2e están en `test/*.e2e-spec.ts` y usan una base separada: copiar
  `.env.test.example` a `.env.test`. El setup crea la base si no existe, aplica las
  migraciones y aborta si el nombre de la base no termina en `_test` (cada
  prueba hace `TRUNCATE`).
