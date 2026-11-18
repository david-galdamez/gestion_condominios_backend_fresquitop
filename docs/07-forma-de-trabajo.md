# Forma de trabajo

**Tablero:** <https://trello.com/b/taNV3ODs/condominiosfresquitop>

Columnas: **To do → Doing → Reviewing → Done**. Cada card es una historia (H01,
H07b, …) con su responsable, criterios de aceptación, tasks y el diseño técnico
en un comentario. Al abrir el PR la card pasa a Reviewing con el enlace al PR; al
fusionarse a `develop` y verificarse, pasa a Done.

## Ramas (Git Flow)

- `main`: código en producción. Recibe cambios desde `release/*` y `hotfix/*`.
- `develop`: rama de integración.
- `feature/<ID>-<descripcion>`: una rama por historia, por ejemplo `feature/H07b-editar-autorizacion`.
- `bugfix/<ID>-<descripcion>`: correcciones de defectos encontrados en las pruebas.
- `release/<version>` y `hotfix/<descripcion>`: publicación y correcciones de producción.

Si una historia toca backend y frontend, la rama lleva el mismo nombre en ambos repositorios.

## Commits

Formato `<tipo>(<ID>): <descripción>` en español, breve y en presente, por
ejemplo `feat(H13): agrega publicación y programación de comunicados`.

Tipos que usamos:

| Tipo | Uso |
|---|---|
| `feat` | Funcionalidad nueva de una historia |
| `fix` | Corrección de un defecto |
| `test` | Solo pruebas |
| `docs` | Documentación |
| `chore` | Configuración, dependencias, datos semilla |
| `refactor` | Cambio interno sin cambiar el comportamiento |

## Pull requests

- **Título:** `<ID>: <descripción>`, por ejemplo `H07b: Editar una autorización de visita`.
- **Descripción:** enlace a la card de Trello, qué cambia, cómo se probó (pruebas
  unitarias, e2e y verificación manual) y, si aplica, el PR del otro repositorio.
- **Destino:** `develop` (salvo `release/*` y `hotfix/*`, que van a `main`).
- **Aprobación:** al menos un integrante distinto del autor revisa y aprueba.
- **Fusión:** cuando está aprobado y las pruebas pasan; la rama se borra después
  de fusionar y la card se mueve a Done con el enlace al PR.
