# Problemas conocidos

| Problema | Cómo se reproduce | Impacto | Historia relacionada |
|---|---|---|---|
| `npm run build` falla en `develop`: `tsconfig.build.json` redefine `paths` y le faltan los alias `@Areas`, `@Paquetes`, `@Archivos`, `@Notificaciones` y `@Reportes`; la imagen Docker no arranca (`Invalid module "@Areas"`). | `npm run build && npm run start:prod` | Alto: bloquea el despliegue. Corrección en el PR [#13](https://github.com/david-galdamez/gestion_condominios_backend_fresquitop/pull/13) (el build hereda los alias de `tsconfig.json`). | H03, H05, H09 |
| Los avisos no llegan a los residentes: `NotificacionService` usa una versión temporal que valida el aviso y lo escribe en el log. | Registrar un paquete (H09) o publicar un comunicado (H13) y revisar el log de la API. | Medio | H18 |
| El backend no configura CORS. Hoy no afecta porque el frontend llama a la API desde el servidor, pero la guía pide permitir la URL del frontend desplegado. | Llamar a la API desde un navegador en otro origen. | Bajo | — |
| `POST /api/v1/users` es público: cualquiera puede registrarse (queda como Residente sin unidades). | `POST /api/v1/users` sin token. | Medio | — |
| El seed imprime y usa una contraseña común para todos los usuarios de prueba; en producción se debe correr con contraseñas distintas que se entregan por Moodle. | `npm run db:seed` | Medio | — |
| H25 (visitas dentro) tiene pantalla en el frontend pero aún no tiene endpoint en el backend. (H16 se resolvió en el hotfix 1.0.1.) | Abrir `/porteria/dentro`. | Medio | H08, H25 |
