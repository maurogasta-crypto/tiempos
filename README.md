# Tiempos

Un solo cronómetro para Mauro y Florencia: lo de la familia y lo de Casa Verde.
App instalable, sin build, servida tal cual por GitHub Pages.

| | |
|---|---|
| App | https://maurogasta-crypto.github.io/tiempos/ |
| Base | Firebase `tiempos-71d42` (la de la familia) · y `casaverde-20` por el código de Casa Verde |
| Publicación | `.github/workflows/pages.yml` — Settings → Pages → Source: **GitHub Actions** |
| Banco | `node pruebas.mjs` (49 casos, sin npm, sin red) |

## Qué hace (app-3)

Seis solapas. Lo de arriba de todo —el cronómetro y «Estoy con»— está en todas.

- **Ahora**: un solo cronómetro de tarea. Se elige una tarea de la familia o de
  Casa Verde y corre; mientras corre uno no arranca otro en ninguna de las dos
  bases. Se para con «queda pendiente» o «terminé». Aparte, y **en paralelo**,
  «Estoy con» un chico o los dos: ese reloj no frena ni bloquea el de la tarea.
  Arriba lo que **te pidieron**, después lo que tomaste, lo de los dos sin
  encargado, y Casa Verde. Cada tarea se despliega con «⋯».
- **Ficha de una tarea de la familia**: «Me ocupo yo» (un clic), «Pedírsela al
  otro» (con una nota), «Meta de la semana», «A mi agenda», el detalle y para
  cuándo. Quien recibe un pedido lo acepta («Me ocupo») o lo devuelve («No
  puedo»); al aceptar, pasa a ser suya y deja de ser de quien la pidió.
- **Ficha de una tarea de Casa Verde**: el detalle, las fechas, la hora, cada
  cuánto se repite, el monto, quiénes la hacen, la última vez, y **los
  registros**: quién le dedicó tiempo, cuándo y cuánto, con el total. Se puede
  dar por hecha sin cronómetro (`Core.tildar`) y abrir en Casa Verde.
- **Hoy**: lo cotidiano se **tilda**, no se cronometra —desayuno, almuerzo,
  merienda, cena, la basura, los cuartos, lavar, doblar y guardar—. Queda quién
  y a qué hora, y cada una puede llevar una observación; abajo, las del día.
- **Agenda**: mi semana, en mañana, tarde y noche, **arrastrando** del ⠿. Es de
  cada uno: el otro no la ve. Cada día muestra con quién están los chicos y
  sus actividades, que en la agenda aparecen para los dos y no se arrastran.
  Las tareas de Casa Verde van a la agenda **de Casa Verde** (ver abajo).
- **Tareas**: la **pizarra de la semana** —las metas, agrupadas por quién se
  ocupa; lo que no se terminó sigue la semana siguiente— y la lista entera.
  Una tarea tiene su ámbito (producción, mantenimiento, chicos, casa y comida,
  personal), y puede ser de los dos o sólo mía.
- **Chicos**: la semana o el mes, con un señalador por persona y por chico.
  Sale de **lo acordado** para cada día de la semana, y un día distinto se
  cambia tocándolo. Las **actividades** —básquet, kung fu, amigos, la
  psicóloga— se cargan acá, pueden repetirse cada semana, y las ven los dos
  siempre, las cargue quien las cargue.
- **Horas**: las horas de cada uno por tipo, con Casa Verde como producción, y
  la **carga**: producción + mantenimiento + **la mitad** del tiempo con los
  chicos («cuando me dedico a los niños paso a estar contado en mitad de lo
  productivo»). El número está en `TIPOS.ninos.peso`.

Los nombres de los chicos **no están en el código**: viven en la base
(`familia/config`). Este repositorio es público.

## Casa Verde entra por su propio código

`firebase-init.js` importa `firebase-init.js` y `actividades-core.js` del sitio
de Casa Verde. Arrancar, frenar y tildar son `Core.iniciar`, `Core.finalizar` y
`Core.tildar`: los mismos que usa el panel de Casa Verde, no una copia.

La app **no escribe nada de Casa Verde por su cuenta, salvo la agenda de cada
uno** (`estado_usuario/{uid}.agenda`), con la misma forma que usa la agenda de
Casa Verde: así lo que se ordena acá se ve igual allá, y al revés. Casa Verde
tiene sólo mañana y tarde, así que una suya soltada en «noche» queda en la
tarde. El banco comprueba que ésa sea la única escritura directa.

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

## Los archivos

| Archivo | Qué hace | Sello |
|---|---|---|
| `nucleo.js` | todas las cuentas, sin Firebase ni pantalla | `nucleo-2` |
| `estado.js` | lo que comparten las vistas | `estado-1` |
| `app.js` | entrar, los relojes, Ahora, Tareas, Horas | `app-3` |
| `agenda.js` | mi semana, arrastrando | `agenda-1` |
| `familia.js` | Hoy y Chicos | `familia-1` |
| `firebase-init.js` | el único contacto con las dos bases | `init-1` |
| `estilos.css` | | `estilos-2` |
| `sw.js` | el cascarón sin señal | `tiempos-3` |
| `firestore.rules` | las reglas; se publican desde el panel, que pone el UID del agente | v3 |
