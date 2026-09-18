# Portal del alumno — Romina Garino

Sitio estático (HTML + CSS + JS, sin build) que se conecta a Supabase.
Pensado para vivir en un subdominio, ej. `app.rominagarino.com`, separado
del sitio principal (`export/`, que sigue siendo solo landing + pago).

Cuatro pestañas, tema oscuro, siguiendo los tokens de
`design_handoff_romina_garino_app/`:

- **Hoy** (`hoy.html`) — entrenamiento del día: marcar ejercicios, sensación (RPE), guardar.
- **Progreso** (`progreso.html`) — sesiones por semana (últimas 8), racha e historial.
- **Mi plan** (`mi-plan.html`) — resumen del plan asignado y estado de la cuota.
- **Chat** (`chat.html`) — mensajes con la coach.

## 1. Crear el proyecto en Supabase

1. [supabase.com](https://supabase.com) → New project (plan gratis alcanza para <50 alumnos).
2. Una vez creado, andá a **SQL Editor** y pegá y ejecutá todo el contenido
   de `supabase-schema.sql` de esta carpeta.
3. Andá a **Project Settings → API** y copiá:
   - `Project URL`
   - `anon public key`
4. Pegalos en `app.js`, arriba de todo, en el objeto `CONFIG`:
   ```js
   const CONFIG = {
     supabaseUrl: 'https://tu-proyecto.supabase.co',
     supabaseAnonKey: 'ey...',
     coachName: 'Romina Garino',
     mercadoPagoLink: 'https://mpago.la/tu-link-de-cobro',
   };
   ```

## 2. Cargar planes y alumnos

Por ahora se cargan a mano desde el **SQL Editor** de Supabase (no hay
todavía un panel para que Romina lo haga sola — ver "Próximos pasos").

Ejemplo, un plan y una alumna con cuota:

```sql
insert into plans (title, level, weeks, summary, blocks) values (
  'Full Body 3 días', 'Intermedio', 8, 'Fuerza general, 3 sesiones semanales',
  '[{"name":"Bloque A","items":[
    {"exercise":"Sentadilla","sets":"4 x 8","note":"RIR 2 · descanso 90\""},
    {"exercise":"Press banca","sets":"4 x 8","note":"RIR 2"}
  ]}]'
);

insert into students (name, phone, access_code, plan_id, fee, due_date) values (
  'Camila Ferreyra', '5491122334455', '4821',
  (select id from plans where title = 'Full Body 3 días'),
  40000, current_date + 30
);
```

El `access_code` (4 dígitos) se lo pasás vos a la alumna por WhatsApp,
como ya hacen con el link de pago.

## 3. Confirmar pagos y responder mensajes

Todavía no hay panel para la coach, así que estas dos acciones también
se hacen desde el **SQL Editor** (ver el pie de `supabase-schema.sql`
para los comandos exactos):

- **Confirmar un pago** (avisado por transferencia/efectivo, o cobrado
  en persona): marcar el pago como `confirmed` y actualizar `due_date`
  del alumno +30 días.
- **Responder un mensaje**: insertar una fila en `messages` con
  `sender = 'coach'`.

## 4. Ver el sitio en local

Abrí `index.html` con la extensión **Live Server** de VS Code (clic
derecho → *Open with Live Server*). No necesita `npm install` ni build.

Ingresá el teléfono (`1122334455`, sin el `549`, o completo — se
normaliza) y el código que cargaste en el paso 2.

## 5. Publicar

Cualquier hosting estático: Netlify (arrastrar la carpeta), Vercel, o
un repo de GitHub nuevo con GitHub Pages.

Para colgarlo de `app.rominagarino.com`:
1. En el hosting elegido, agregá el dominio custom `app.rominagarino.com`.
2. En el DNS del dominio (donde esté comprado `rominagarino.com`),
   agregá un registro **CNAME**: `app` → lo que te indique el hosting.
   (Esto es aparte del CNAME que ya usa GitHub Pages para el sitio
   principal en el apex `rominagarino.com`.)

## 6. Enlazar desde el sitio principal

Ya está hecho: `export/index.html` tiene un link "Mi plan" en el nav y
una sección debajo de los planes con el botón "Entrar a mi plan", que
apuntan a `CONFIG.portalUrl` en `export/app.js`. Actualizar esa URL
cuando el portal esté publicado en su subdominio real.

## Próximos pasos (no incluidos en esta base)

- **Panel para Romina**: hoy los planes, alumnos, pagos y mensajes se
  cargan/confirman a mano por SQL. El siguiente paso natural es la
  parte "APP DE LA COACH" del handoff
  (`design_handoff_romina_garino_app/README.md`) para que ella misma
  cree alumnos, arme planes, confirme cobros y responda el chat sin
  tocar Supabase.
- **Mercado Pago personalizado**: el botón "Pagar con Mercado Pago" hoy
  usa un único link fijo (`CONFIG.mercadoPagoLink`), no genera un cobro
  por el monto exacto de cada alumna. Pasar a Checkout Pro o
  suscripciones de Mercado Pago (requiere backend) para automatizarlo
  del todo, incluyendo marcar el pago como confirmado solo.
- **"Tu semana" con días asignados**: el plan guarda bloques de
  ejercicios pero no qué día de la semana corresponde cada uno; para
  mostrar una vista semanal (Lun–Dom con estado Hecho/Hoy/Pendiente)
  hace falta sumar ese dato al modelo de `plans.blocks`.
- **Cargas (PRs) y % de adherencia**: no hay todavía un lugar para
  cargar el peso levantado por ejercicio, así que Progreso no puede
  mostrar "Sentadilla +12 kg" ni un % de adherencia real — hoy solo
  muestra sesiones por semana, racha e historial, que sí salen de los
  datos que ya se registran.
- **Aviso de no leídos**: `messages.read_at` ya existe y `chat.html`
  marca como leídos los mensajes de la coach al abrirse, pero ninguna
  pantalla muestra todavía un contador de mensajes sin leer.
- **Seguridad**: el login actual es teléfono + código de 4 dígitos
  fijo (sin expiración), y una vez logueada la sesión queda guardada
  en `localStorage` sin volver a validarse contra el servidor.
  Alcanza para el volumen actual; si crece, migrar a Supabase Auth con
  OTP por SMS real (requiere conectar un proveedor como Twilio, que
  tiene costo por mensaje).
