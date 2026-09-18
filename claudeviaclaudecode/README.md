# Carga de planes desde `planes_entrenamiento.md`

Este es el puente entre el contenido de entrenamiento (generado aparte,
fuera de este repo) y la base de datos del portal.

`planes_entrenamiento.md` y `planes_parsed.json` **no se versionan**
(ver `.gitignore` en la raíz) porque contienen el programa completo de
entrenamiento y este repo es público. Viven solo en esta computadora.

## Flujo

1. `planes_entrenamiento.md` se actualiza (a mano, o por la tarea
   programada de Romina que genera/ajusta los planes cada semana).
2. `node parse-planes.js` — lo convierte a `planes_parsed.json` con la
   forma que espera Supabase (planes → días → bloques → ejercicios).
3. `node fill-gaps.js` — completa los bloques de calentamiento/vuelta a
   la calma que el documento fuente deja vacíos en algunos días,
   reutilizando el equivalente de Home Básico. Si el documento fuente
   cambia y dejan de faltar esos bloques, este paso no toca nada.
4. `ADMIN_PASS=tu-contraseña node load-plans.mjs` — sube los 3 planes a
   Supabase (crea o actualiza por título, vía `admin_upsert_plan`).

Repetir los pasos 2-4 cada vez que cambie el `.md` actualiza los planes
ya asignados a las alumnas sin tocarlas a ellas (se actualiza el plan,
no la asignación).

## `entrenamientos.sh`

Script previo que arma un prompt con el contenido de un plan y lo
manda a `claude` (Claude Code) por stdin. Sigue sirviendo si querés
pedirle a Claude que ajuste/revise un plan puntual antes de correr
`parse-planes.js`.
