# Tiempos

Un solo cronómetro para Mauro y Florencia: lo de la familia y lo de Casa Verde.
App instalable, sin build, servida tal cual por GitHub Pages.

| | |
|---|---|
| App | https://maurogasta-crypto.github.io/tiempos/ |
| Base | Firebase `tiempos-71d42` (la de la familia) · y `casaverde-20` por el código de Casa Verde |
| Publicación | `.github/workflows/pages.yml` — Settings → Pages → Source: **GitHub Actions** |
| Banco | `node pruebas.mjs` (sin npm, sin red) |

## Qué hace (app-1)

- **Ahora**: un solo cronómetro. Se elige una tarea de la familia o de Casa
  Verde y corre. Mientras corre uno, no arranca otro en ninguna de las dos
  bases. En Casa Verde se puede «Parar» o «Parar y terminé la tarea», que es
  cerrar la tarea allá, con sus honorarios, igual que en el panel de Casa Verde.
- **Tareas**: las de la familia, en árbol. La raíz lleva el tipo (producción,
  mantenimiento, chicos, casa y comida, personal) y las hijas lo heredan. Una
  tarea es «de los dos» o «sólo mía».
- **Semana**: las horas de cada uno por tipo, con Casa Verde contada como
  producción, y la **carga** (producción + mantenimiento + chicos).

## Casa Verde entra por su propio código

`firebase-init.js` importa `firebase-init.js` y `actividades-core.js` del sitio
de Casa Verde. Arrancar y frenar son `Core.iniciar` y `Core.finalizar`: los
mismos que usa el panel de Casa Verde, no una copia. La app **no escribe nada
de Casa Verde por su cuenta** (el banco lo comprueba).

Consecuencia a saber: si Casa Verde cambia la versión del SDK de Firebase, hay
que cambiarla acá en la misma tanda; si no, anda igual pero con dos SDK.

## El reparto

La regla está escrita y probada en `nucleo.js` (`repartir`), con las palabras
de Mauro al lado. **Todavía no se muestra**: se muestra cuando Mauro y
Florencia la acuerden.

## Primer ingreso

1. Entrar con el mail y la contraseña (los mismos de Casa Verde).
2. La primera vez pide acceso: deja una solicitud.
3. El agente la aprueba creando `miembros/{uid}`. Desde ahí, adentro.
