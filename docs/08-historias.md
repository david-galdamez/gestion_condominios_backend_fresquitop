# Historias por módulo

Estados:

- **En develop**: PR aprobado y fusionado a `develop`; entra en la versión 1.0.0.
- **En revisión**: implementada, con PR hacia `develop` esperando aprobación.
- **Parcial**: solo una parte (frontend o backend) está fusionada.
- **Pendiente**: no terminada, con el motivo.

PR: `BE` = [backend](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pulls),
`FE` = [frontend](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pulls).
Tablero: <https://trello.com/b/taNV3ODs/condominiosfresquitop>.

## Módulo 1: Cuotas y pagos de mantenimiento

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H01 | Consultar el estado de cuenta de mi unidad | David Galdamez | [card](https://trello.com/c/Awu1dn2Z) | [BE #1](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/1), [BE #2](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/2), [FE #1](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/1), [FE #2](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/2) | En develop |
| H02 | Generar las cuotas mensuales automáticamente | Pablo Castellón | [card](https://trello.com/c/tJNwfiZg) | — | Pendiente: aún en desarrollo por el responsable |
| H21 | Pagar cuotas pendientes con tarjeta | Jaime Jiménez | [card](https://trello.com/c/rbCWsh79) | — | Pendiente: aún en desarrollo por el responsable |
| H22 | Ver qué unidades están morosas y desde cuándo | Omar Quintanilla | [card](https://trello.com/c/EE7qCbVj) | [BE #8](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/8), [FE #10](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/10) | En develop (la card aún no se movió a Done) |

## Módulo 2: Reservas de áreas comunes

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H03 | Configurar las áreas comunes | Jaime Jiménez | [card](https://trello.com/c/5WYI8xVm) | [BE #5](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/5), [FE #7](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/7) | En develop |
| H04 | Reservar un área común sin cruces de horario | Edwin Guzmán | [card](https://trello.com/c/AWI4QhLa) | — | Pendiente: aún en desarrollo por el responsable |
| H23 | Ver qué áreas están disponibles antes de reservar | Jaime Jiménez | [card](https://trello.com/c/sUphKwax) | — | Pendiente: aún en desarrollo por el responsable |

## Módulo 3: Incidencias y mantenimiento

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H05 | Reportar un problema con evidencia | Gabriel Aguilar | [card](https://trello.com/c/OqPoGO0M) | [BE #7](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/7), [FE #9](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/9) | En develop |
| H06 | Priorizar y asignar los reportes | Omar Quintanilla | [card](https://trello.com/c/oEHbXXwf) | — | Pendiente: aún en desarrollo por el responsable |
| H24 | Enterarme cuando mi reporte se resuelva | Omar Quintanilla | [card](https://trello.com/c/AqzRCnXC) | — | Pendiente: depende de H06 y H18 |

## Módulo 4: Control de acceso de visitas

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H07 | Pre-autorizar a un visitante | David Galdamez | [card](https://trello.com/c/gczn8vll) | [BE #4](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/4), [FE #4](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/4) | En develop |
| H07b | Editar una autorización de visita | David Galdamez | [card](https://trello.com/c/HHeyUT65) | [BE #11](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/11), [FE #13](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/13) | En revisión |
| H08 | Registrar entradas y salidas de visitantes | Pablo Castellón | [card](https://trello.com/c/pYKhBeSC) | — | Pendiente: aún en desarrollo por el responsable |
| H25 | Ver quién está dentro del condominio como visita | Edwin Guzmán | [card](https://trello.com/c/HRnOJClp) | [FE #6](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/6) | Parcial: solo frontend, falta backend (depende de H08) |

## Módulo 5: Paquetería

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H09 | Registrar la llegada de un paquete | Jaime Jiménez | [card](https://trello.com/c/BoQ5UJq6) | [BE #6](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/6), [FE #8](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/8) | En develop |
| H10 | Entregar el paquete a la persona correcta | Edwin Guzmán | [card](https://trello.com/c/cqwQP7DQ) | — | Pendiente: aún en desarrollo por el responsable |
| H26 | Ver el historial de paquetes de mi unidad | Gabriel Aguilar | [card](https://trello.com/c/CZN1bIlV) | — | Pendiente: aún en desarrollo por el responsable |

## Módulo 6: Asambleas y votaciones

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H11 | Convocar una asamblea con temas a votar | Gabriel Aguilar | [card](https://trello.com/c/BhQUfGDn) | — | Pendiente: aún en desarrollo por el responsable |
| H12 | Votar una sola vez por unidad | Omar Quintanilla | [card](https://trello.com/c/BUdvXPIu) | — | Pendiente: depende de H11 |
| H27 | Ver el resultado de una votación de forma auditable | Gabriel Aguilar | [card](https://trello.com/c/eJK8LatL) | — | Pendiente: depende de H11 y H12 |

## Módulo 7: Anuncios y comunicados

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H13 | Publicar un comunicado para todos o para una torre | David Galdamez | [card](https://trello.com/c/Z8275TmM) | [BE #12](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/12), [FE #14](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/14) | En revisión (el aviso usa el servicio temporal de notificaciones hasta H18) |
| H14 | Ver solo los comunicados que me aplican | Pablo Castellón | [card](https://trello.com/c/HjoPHQAB) | — | Pendiente: depende de H13 |

## Módulo 8: Directorio de residentes

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H15 | Decidir qué datos muestra el directorio | Jaime Jiménez | [card](https://trello.com/c/OaWUp3DU) | — | Pendiente: aún en desarrollo por el responsable |
| H16 | Buscar el contacto de un vecino | Edwin Guzmán | [card](https://trello.com/c/7xf0QxKi) | [FE #5](https://github.com/david-galdamez/gestion_condominios_frontend_fresquitop/pull/5) | Parcial: solo frontend, falta backend (depende de H15) |

## Módulo 9: Notificaciones

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H17 | Ver todos mis avisos en un solo lugar | Gabriel Aguilar | [card](https://trello.com/c/JWW02E0L) | — | Pendiente: depende de H18 |
| H18 | Avisar a los residentes mediante un servicio común | Omar Quintanilla | [card](https://trello.com/c/7i0qSire) | — | Pendiente: existe el contrato `NotificacionService` con una versión temporal que solo escribe en el log |

## Módulo 10: Reportes financieros y analíticos

| ID | Historia | Responsable | Card | PR | Estado |
|---|---|---|---|---|---|
| H19 | Ver la salud del condominio en un panel | David Galdamez | [card](https://trello.com/c/SRTcy34I) | — | Pendiente: depende de H04 (reservas) y H11/H27 (asambleas), que aún no existen |
| H20 | Exportar el reporte para la mesa directiva | Pablo Castellón | [card](https://trello.com/c/ZfXrgdHI) | — | Pendiente: depende de H19 |
