-- Esquema para el portal del alumno (rominagarino.com)
-- Correr esto entero en Supabase → SQL Editor de tu proyecto.

create extension if not exists pgcrypto;

-- ── Tablas ──────────────────────────────────────────────

create table plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level text not null,
  weeks int not null,
  summary text,
  blocks jsonb not null default '[]', -- [{ name, items:[{ exercise, sets, note }] }]
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,       -- formato: 549 + código de área + número, sin espacios
  access_code text not null,        -- 4 dígitos, la coach lo define al dar de alta
  plan_id uuid references plans(id),
  plan_assigned_at timestamptz not null default now(), -- para calcular "semana N de M"; actualizar a mano si se reasigna el plan
  fee numeric,                      -- cuota mensual, ej. 40000
  due_date date,                    -- próximo vencimiento
  created_at timestamptz not null default now()
);

create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  log_date date not null default current_date,
  day_label text,
  completed_items jsonb not null default '[]', -- nombres de ejercicios marcados
  rpe text,                                     -- 'facil' | 'justo' | 'duro'
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  amount numeric,
  method text not null check (method in ('transfer', 'mercadopago', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  date date not null default current_date,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  sender text not null check (sender in ('coach', 'student')),
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz -- se completa cuando la coach lee el mensaje del alumno (o viceversa)
);

-- guarda (hasheada) la contraseña que protege el alta rápida de alumnas
-- (admin_create_student más abajo). Nunca se guarda en texto plano.
create table admin_secret (
  id int primary key default 1,
  code_hash text not null,
  check (id = 1)
);

-- ── Seguridad ───────────────────────────────────────────
-- El anon key queda expuesto en el HTML, así que las tablas NO se leen
-- directo: todo pasa por funciones (security definer) que reciben el
-- id de sesión guardado en el navegador tras el login.

alter table students enable row level security;
alter table plans enable row level security;
alter table workout_logs enable row level security;
alter table payments enable row level security;
alter table messages enable row level security;
alter table admin_secret enable row level security;
-- Sin policies para anon => bloqueado por defecto en las 6 tablas.

-- login: valida teléfono + código, devuelve el alumno (sin el código)
create or replace function login_student(p_phone text, p_code text)
returns table (id uuid, name text, plan_id uuid)
language sql security definer
as $$
  select s.id, s.name, s.plan_id
  from students s
  where s.phone = p_phone and s.access_code = p_code;
$$;

-- trae el plan asignado a un alumno ya logueado (por su id de sesión)
create or replace function get_my_plan(p_student_id uuid)
returns table (id uuid, title text, level text, weeks int, summary text, blocks jsonb)
language sql security definer
as $$
  select p.id, p.title, p.level, p.weeks, p.summary, p.blocks
  from plans p
  join students s on s.plan_id = p.id
  where s.id = p_student_id;
$$;

-- cabecera común de la app: plan, semana actual y estado de cuota
create or replace function get_my_status(p_student_id uuid)
returns table (
  plan_title text, plan_level text, plan_weeks int,
  week_number int, fee numeric, due_date date, payment_status text
)
language sql security definer
as $$
  select
    p.title, p.level, p.weeks,
    least(
      coalesce(p.weeks, 1),
      greatest(1, floor(extract(day from now() - s.plan_assigned_at) / 7)::int + 1)
    ) as week_number,
    s.fee, s.due_date,
    case
      when s.due_date is null then 'ok'
      when s.due_date < current_date then 'late'
      when s.due_date <= current_date + 7 then 'soon'
      else 'ok'
    end as payment_status
  from students s
  left join plans p on p.id = s.plan_id
  where s.id = p_student_id;
$$;

-- guarda el entrenamiento del día marcado por el alumno
create or replace function save_workout_log(
  p_student_id uuid, p_day_label text, p_completed jsonb, p_rpe text
)
returns void
language sql security definer
as $$
  insert into workout_logs (student_id, day_label, completed_items, rpe)
  values (p_student_id, p_day_label, p_completed, p_rpe);
$$;

-- historial reciente del alumno, para la pantalla de Progreso
create or replace function get_my_logs(p_student_id uuid)
returns setof workout_logs
language sql security definer
as $$
  select * from workout_logs
  where student_id = p_student_id
  order by log_date desc
  limit 60;
$$;

-- avisa un pago por transferencia o efectivo (queda "pending" hasta que
-- la coach lo confirme a mano desde el SQL Editor; ver más abajo)
create or replace function notify_transfer_payment(p_student_id uuid)
returns void
language sql security definer
as $$
  insert into payments (student_id, amount, method, status)
  select id, fee, 'transfer', 'pending' from students where id = p_student_id;
$$;

-- hilo de mensajes del alumno con la coach
create or replace function get_my_thread(p_student_id uuid)
returns setof messages
language sql security definer
as $$
  select * from messages
  where student_id = p_student_id
  order by sent_at asc
  limit 200;
$$;

-- el alumno envía un mensaje
create or replace function send_my_message(p_student_id uuid, p_body text)
returns void
language sql security definer
as $$
  insert into messages (student_id, sender, body) values (p_student_id, 'student', p_body);
$$;

-- marca como leídos los mensajes de la coach al abrir el chat
create or replace function mark_thread_read(p_student_id uuid)
returns void
language sql security definer
as $$
  update messages set read_at = now()
  where student_id = p_student_id and sender = 'coach' and read_at is null;
$$;

-- alta rápida de alumnas: genera el código de 4 dígitos sola y crea la
-- fila en students. Requiere la contraseña de administración (ver abajo
-- "Cómo activar el alta rápida") para que no quede abierto a cualquiera
-- que lea este archivo (es un repo público).
create or replace function admin_create_student(
  p_admin_pass text, p_name text, p_phone text,
  p_plan_id uuid default null, p_fee numeric default null, p_due_date date default null
)
returns table (id uuid, access_code text)
language plpgsql security definer
as $$
declare
  v_code text;
  v_id uuid;
begin
  if not exists (select 1 from admin_secret where code_hash = crypt(p_admin_pass, code_hash)) then
    raise exception 'No autorizado';
  end if;

  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
  insert into students (name, phone, access_code, plan_id, fee, due_date)
  values (p_name, p_phone, v_code, p_plan_id, p_fee, p_due_date)
  returning students.id into v_id;

  return query select v_id, v_code;
end;
$$;

grant execute on function login_student(text, text) to anon;
grant execute on function admin_create_student(text, text, text, uuid, numeric, date) to anon;
grant execute on function get_my_plan(uuid) to anon;
grant execute on function get_my_status(uuid) to anon;
grant execute on function save_workout_log(uuid, text, jsonb, text) to anon;
grant execute on function get_my_logs(uuid) to anon;
grant execute on function notify_transfer_payment(uuid) to anon;
grant execute on function get_my_thread(uuid) to anon;
grant execute on function send_my_message(uuid, text) to anon;
grant execute on function mark_thread_read(uuid) to anon;

-- ── Cómo activar el alta rápida (admin_create_student) ──
-- Corré esto UNA sola vez, cambiando 'CAMBIAME-2026' por tu propia
-- contraseña (no hace falta que sea complejísima, solo que no esté en
-- este archivo público). A partir de ahí, para dar de alta a una
-- alumna alcanza con llamar a admin_create_student con esa contraseña,
-- nombre y teléfono — el código de 4 dígitos se genera solo.
-- insert into admin_secret (id, code_hash) values (1, crypt('CAMBIAME-2026', gen_salt('bf')));

-- ── Cómo dar de alta a un alumno (a mano, desde el SQL Editor) ──
-- (alternativa a admin_create_student, por si alguna vez hace falta)
-- insert into plans (title, level, weeks, summary, blocks) values (
--   'Full Body 3 días', 'Intermedio', 8, 'Fuerza general, 3 sesiones semanales',
--   '[{"name":"Bloque A","items":[{"exercise":"Sentadilla","sets":"4 x 8","note":"RIR 2 · descanso 90\""}]}]'
-- );
-- insert into students (name, phone, access_code, plan_id, fee, due_date) values (
--   'Camila Ferreyra', '5491122334455', '4821',
--   (select id from plans where title = 'Full Body 3 días'),
--   40000, current_date + 30
-- );

-- ── Cómo confirmar un pago avisado por transferencia/efectivo ──
-- update payments set status = 'confirmed', confirmed_at = now()
--   where id = '<id del pago>';
-- update students set due_date = current_date + 30
--   where id = '<id del alumno>';

-- ── Cómo responderle a un alumno desde el chat ──
-- insert into messages (student_id, sender, body) values
--   ('<id del alumno>', 'coach', 'Dale, seguimos así 💪');
