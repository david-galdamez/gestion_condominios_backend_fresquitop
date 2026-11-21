# API

**Documentación interactiva (Swagger):** `https://<url-del-backend>/api/docs`
(pendiente de despliegue, ver [06-despliegue](06-despliegue.md)). En local:
<http://localhost:3000/api/docs>.

Todas las rutas llevan el prefijo `/api/v1`. Los cuerpos son JSON salvo los que
suben fotos (`multipart/form-data`). Los errores siguen el formato de NestJS:
`{ statusCode, message, error }`, donde `message` es un texto o una lista de
textos con los mensajes de validación que se muestran al usuario.

## Autenticación

1. `POST /api/v1/auth/login` con `{ email, password }` devuelve
   `{ accessToken, refreshToken, ... }`.
2. Cada petición protegida envía el encabezado `Authorization: Bearer <accessToken>`.
3. El access token dura `JWT_EXPIRES_IN` (15 minutos por defecto). Para renovarlo
   se llama a `POST /api/v1/auth/refresh` con el refresh token, que dura
   `REFRESH_TOKEN_EXPIRES_IN_DAYS` (7 días) y se rota en cada uso.
4. `POST /api/v1/auth/logout` revoca el refresh token.

Toda ruta exige sesión salvo las marcadas como públicas. El rol se valida con
`RolesGuard`: sin sesión responde **401**, con un rol no permitido responde
**403** “No tienes permiso para esta acción”.

## Endpoints por módulo

### Autenticación y usuarios

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | /api/v1/auth/login | Inicia sesión | Pública |
| POST | /api/v1/auth/refresh | Renueva el access token rotando el refresh token | Pública |
| POST | /api/v1/auth/logout | Revoca el refresh token | Pública |
| GET | /api/v1/auth/me | Usuario autenticado | Todos |
| POST | /api/v1/users | Registra un usuario (queda como Residente) | Pública |
| GET | /api/v1 | Health check | Pública |

### Unidades y torres

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | /api/v1/unidades | Unidades activas (selector de portería) | Seguridad, Administrador |
| GET | /api/v1/unidades/mias | Unidades del residente | Residente |
| GET | /api/v1/torres | Torres del condominio (destinatarios de comunicados) | Administrador |

### Módulo 1: Cuotas y pagos (H01)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | /api/v1/estado-cuenta?unidadId=&estado=&desde=&hasta=&pagina= | Saldo y cuotas de una unidad propia, 20 por página | Residente |

### Módulo 1: Cuotas y pagos (morosidad) (H22)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | /api/v1/admin/morosidad?torreId=&pagina= | Unidades morosas y total en mora | Administrador |

### Módulo 2: Reservas de áreas comunes (H03)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | /api/v1/areas | Lista de áreas (residente: solo activas) | Administrador, Residente |
| POST | /api/v1/areas | Registra un área | Administrador |
| PUT | /api/v1/areas/{id} | Edita un área | Administrador |
| PATCH | /api/v1/areas/{id}/estado | Activa o desactiva un área | Administrador |

### Módulo 2: Reservar un área (H04)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | /api/v1/reservas | Reserva un área en un horario libre; 201 con la reserva Confirmada (`RES-000123`) | Residente |
| GET | /api/v1/reservas/mias | Mis reservas, ordenadas por fecha y hora de inicio | Residente |
| PATCH | /api/v1/reservas/{id}/cancelar | Cancela una reserva Confirmada con 24 horas o más de anticipación | Residente |

Errores de `POST /reservas`: 400 (fecha u hora pasada, fuera del horario del área, supera la duración máxima o la
capacidad, fin no posterior al inicio, datos con formato inválido), 404 (el área no existe o está inactiva),
409 (`Ese horario ya está reservado`). La unidad y el residente salen de la sesión: se usa la primera unidad del
residente por código. Errores de `PATCH .../cancelar`: 404 (no existe o es de otro residente), 409
(`Ya no puedes cancelar esta reserva`: faltan menos de 24 horas o ya no está Confirmada).

### Módulo 3: Incidencias y mantenimiento (H05)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | /api/v1/reportes | Registra un reporte con 0 a 5 fotos (multipart) | Residente |
| GET | /api/v1/reportes | Mis reportes, 20 por página | Residente |
| GET | /api/v1/reportes/ubicaciones | Torres y áreas válidas como ubicación | Residente |
| GET | /api/v1/reportes/{numero} | Detalle de un reporte propio (`REP-000123`) | Residente |
| GET | /api/v1/reportes/{numero}/fotos/{fotoId} | Descarga una foto de un reporte propio | Residente |

### Módulo 4: Control de acceso de visitas (H07, H07b)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | /api/v1/autorizaciones | Pre-autoriza un visitante y devuelve el código de 6 dígitos | Residente |
| GET | /api/v1/autorizaciones/mias | Autorizaciones propias por fecha y hora | Residente |
| GET | /api/v1/autorizaciones/{id} | Detalle de una autorización propia | Residente |
| PATCH | /api/v1/autorizaciones/{id} | Edita una Vigente; si cambia la fecha genera un código nuevo (H07b) | Residente |
| PATCH | /api/v1/autorizaciones/{id}/cancelar | Cancela una Vigente | Residente |

Errores: 400 validación (“Elige una fecha entre hoy y los próximos 30 días”,
“El número de documento no tiene el formato correcto”), 404 “La autorización no
existe” (inexistente o ajena), 409 “Esta autorización ya no se puede editar /
cancelar”.

### Módulo 5: Paquetería (H09)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | /api/v1/paquetes | Registra un paquete con foto (multipart) y avisa a la unidad | Seguridad |
| GET | /api/v1/paquetes | Paquetes en portería y retenidos | Seguridad |

### Módulo 7: Comunicados (H13)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | /api/v1/comunicados | Publica (o programa, si la fecha es futura) un comunicado para todos o por torres | Administrador |
| GET | /api/v1/comunicados | Comunicados publicados, programados y expirados | Administrador |

Errores: 400 campos fuera de rango, “Selecciona los destinatarios” o “La
expiración debe ser posterior a la publicación”; 404 “La torre no existe”.

### Módulo 10: Reportes financieros y analíticos (H19)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | /api/v1/admin/panel?desde=&hasta= | Panel de salud: mora, ocupación por área, incidencias y participación, con variación contra el periodo anterior | Administrador |

`desde` y `hasta` son fechas `YYYY-MM-DD` obligatorias, con `desde` ≤ `hasta` y un máximo de 366 días.
Errores: 400 fechas ausentes, invertidas o rango mayor; 401 sin sesión; 403 rol sin permiso.
La mora se calcula al día de hoy con las mismas consultas que H22; la participación usa la fórmula de H27.
`cambio` es `(actual − anterior) ÷ anterior × 100` contra el periodo anterior de igual duración y es `null`
("Sin base de comparación") cuando el anterior vale 0.

