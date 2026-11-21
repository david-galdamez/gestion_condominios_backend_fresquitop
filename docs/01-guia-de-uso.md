# Guía de uso

El sistema se usa desde el frontend
([gestion_condominios_frontend_fresquitop](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop)).
Esta página resume qué puede hacer cada rol y los flujos principales. Las
credenciales de prueba se entregan por Moodle, nunca en el repositorio.

## Roles

El rol es global por usuario (un solo condominio en el sistema) y lo valida el
backend en cada petición con `RolesGuard`. Si un usuario intenta una acción que
no le corresponde ve “No tienes permiso para esta acción”.

| Rol | Qué puede hacer |
|---|---|
| Residente | Consultar el estado de cuenta de sus unidades (H01), pre-autorizar, editar y cancelar visitas (H07, H07b), reportar problemas con fotos y ver sus reportes (H05), ver las áreas comunes activas (H03), leer los comunicados de su condominio y de su torre (H14). |
| Administrador | Configurar áreas comunes (H03), consultar unidades morosas (H22), publicar y programar comunicados para todo el condominio o por torre (H13). |
| Seguridad | Registrar la llegada de paquetes con foto y avisar a la unidad (H09), consultar los paquetes en portería. |

## Flujos principales

### Módulo 1: Cuotas y pagos de mantenimiento

#### Consultar el estado de cuenta (Residente)

1. Iniciar sesión y abrir **Estado de cuenta**.
2. Si el residente tiene varias unidades, elegir la unidad.
3. Ver el saldo pendiente (Pendientes + Vencidas) y la tabla de cuotas, 20 por página.
4. Filtrar por estado o por rango de fechas de vencimiento.

Una tarea diaria (00:05, hora de El Salvador) pasa a **Vencida** las cuotas
pendientes cuya fecha de vencimiento ya pasó.

### Módulo 1: Cuotas y pagos (morosidad)

#### Consultar morosidad (Administrador)

Abrir **Morosidad** para ver el total en mora, las unidades morosas y la cuota
vencida más antigua de cada una. Se puede filtrar por torre.

### Módulo 2: Reservas de áreas comunes

#### Configurar un área (Administrador)

1. Abrir **Áreas comunes → Nueva área**.
2. Indicar nombre único, capacidad (1–200), horario en punto y duración máxima de una reserva (1–8 h).
3. Desde la lista se puede editar o activar/desactivar un área.

### Módulo 3: Incidencias y mantenimiento

#### Reportar un problema (Residente)

1. Abrir **Mis reportes → Nuevo reporte**.
2. Indicar título, categoría, ubicación (torre o área común), descripción y de 0 a 5 fotos.
3. El reporte queda **Abierto** con número `REP-000123` y aparece en la lista.

### Módulo 4: Control de acceso de visitas

#### Pre-autorizar una visita (Residente)

1. Abrir **Visitas → Nueva visita**.
2. Llenar nombre, tipo y número de documento (DUI `00000000-0` o pasaporte), placa opcional, fecha (hoy a 30 días) y hora estimada.
3. Al guardar se muestra un código de 6 dígitos válido solo ese día, con botón para copiarlo.

#### Editar una visita (Residente, H07b)

1. En **Mis visitas**, pulsar **Editar** en una autorización Vigente.
2. Cambiar nombre, documento, placa, hora o fecha. La unidad no se puede cambiar.
3. Si cambia la fecha se genera un código nuevo y el anterior deja de funcionar; si no, el código se conserva.

#### Cancelar una visita (Residente)

En **Mis visitas**, pulsar **Cancelar** en una autorización Vigente y confirmar.

### Módulo 5: Paquetería

#### Registrar un paquete (Seguridad)

1. Abrir **Paquetes → Registrar paquete**.
2. Elegir la unidad, escribir el destinatario, la mensajería, la guía opcional y tomar o subir una foto (máx. 5 MB).
3. Al guardar se genera el código `PAQ-000123` y se avisa a la unidad.

### Módulo 7: Comunicados

#### Publicar o programar un comunicado (Administrador, H13)

1. Abrir **Comunicados → Nuevo comunicado**.
2. Escribir título (5–100), contenido (10–2000) y categoría.
3. Elegir destinatarios: todo el condominio o una o más torres.
4. Dejar la fecha de publicación en “ahora” para publicar, o poner una fecha futura para programarlo. Opcionalmente, una fecha de expiración posterior.
5. Confirmar el diálogo “Se avisará a N torres. ¿Continuar?”.

Cada 5 minutos una tarea publica los programados (y envía el aviso “Nuevo
comunicado: {título}”) y pasa a **Expirado** los que llegaron a su expiración.

#### Ver mis comunicados (Residente, H14)

1. Abrir **Comunicados**. El contador muestra cuántos no se han leído; se
   actualiza al abrir la pantalla y cada 30 segundos.
2. La pestaña principal lista los comunicados vigentes para todo el condominio
   y para la torre del residente, del más reciente al más antiguo, 20 por
   página. Los no leídos llevan una marca.
3. Abrir un comunicado muestra su contenido y lo marca como leído.
4. La pestaña **Archivo** lista los comunicados expirados.
5. Un comunicado de otra torre no aparece; si se abre por su enlace se ve
   “Comunicado no encontrado”.

### Módulo 10: Reportes financieros y analíticos

#### Exportar el reporte para la mesa directiva (Administrador, H20)

1. Abrir **Panel** y elegir el periodo.
2. Pulsar **Exportar**. En el diálogo elegir el formato (PDF o Excel, por defecto PDF) y la versión
   (Resumida o Detallada, por defecto Resumida). La resumida solo trae totales, sin unidades ni nombres;
   la detallada agrega la morosidad por unidad.
3. Pulsar **Descargar**. Mientras se genera el botón queda deshabilitado; al terminar se descarga
   `reporte-condominio-AAAA-MM-DD` y se cierra el diálogo.
4. El archivo muestra los mismos valores que el panel para ese periodo y lleva periodo, fecha y hora de
   generación y nombre del administrador.
