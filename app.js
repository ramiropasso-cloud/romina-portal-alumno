// ── Config: completar con los datos de tu proyecto Supabase ──
// (Project Settings → API, en supabase.com)
const CONFIG = {
  supabaseUrl: 'https://yreszdtnksnlxkzuakrs.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZXN6ZHRua3NubHhrenVha3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDUzMjUsImV4cCI6MjEwNTMyMTMyNX0.19DjEYrhOLW6LjyRHJ1P1sZh7fiJYvpHaFmKwuHMaMk',
  coachName: 'Romina Garino',
  // Link de cobro de Mercado Pago. Por ahora es genérico (no personalizado
  // por alumno/a ni por monto) — ver README → "Próximos pasos".
  mercadoPagoLink: 'https://mpago.la/TU-LINK-DE-COBRO',
};

const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

const session = {
  get id() { return localStorage.getItem('student_id'); },
  set id(v) { localStorage.setItem('student_id', v); },
  get name() { return localStorage.getItem('student_name'); },
  set name(v) { localStorage.setItem('student_name', v); },
  clear() { localStorage.removeItem('student_id'); localStorage.removeItem('student_name'); },
};

function normalizePhone(raw) {
  return raw.replace(/\D/g, '');
}

function requireSession() {
  if (!session.id) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2800);
}

function dueLabel(status, dueDate) {
  if (!dueDate) return 'Sin fecha de vencimiento';
  const days = Math.round((new Date(dueDate) - new Date(new Date().toDateString())) / 86400000);
  if (status === 'late') return `Vencido hace ${Math.abs(days)} d`;
  if (status === 'soon') return `Vence en ${days} d`;
  return 'Cuota al día';
}

function statusTagClass(status) {
  if (status === 'late') return 'tag-accent';
  if (status === 'soon') return 'tag-outline';
  return 'tag-neutral';
}

function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function formatLongDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

function rpeLabel(rpe) {
  return rpe === 'facil' ? 'Fácil' : rpe === 'duro' ? 'Duro' : rpe === 'justo' ? 'Justo' : '—';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Cabecera compartida (hoy / progreso / mi-plan / chat) ──
async function initHeader() {
  if (!requireSession()) return null;

  const logout = document.getElementById('btn-logout');
  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      session.clear();
      window.location.href = 'index.html';
    });
  }

  const { data, error } = await sb.rpc('get_my_status', { p_student_id: session.id });
  if (error || !data || data.length === 0) return null;
  const s = data[0];

  const weekEl = document.getElementById('header-week');
  const titleEl = document.getElementById('header-plan-title');
  const statusEl = document.getElementById('header-status');
  if (weekEl) weekEl.textContent = s.plan_weeks ? `SEMANA ${s.week_number} DE ${s.plan_weeks}` : 'SIN PLAN ASIGNADO';
  if (titleEl) titleEl.textContent = s.plan_title || 'Todavía no tenés un plan';
  if (statusEl) statusEl.textContent = `Con ${CONFIG.coachName} · ${dueLabel(s.payment_status, s.due_date)}`;

  return s;
}

// ── Página de login (index.html) ──
function initLogin() {
  let phase = 'phone';
  const phoneInput = document.getElementById('phone');
  const codeInput = document.getElementById('code');
  const stepPhone = document.getElementById('step-phone');
  const stepCode = document.getElementById('step-code');
  const btnNext = document.getElementById('btn-next');
  const btnBack = document.getElementById('btn-back');
  const phoneError = document.getElementById('phone-error');
  const codeError = document.getElementById('code-error');
  const codeSub = document.getElementById('code-sub');

  if (session.id) {
    window.location.href = 'hoy.html';
    return;
  }

  btnNext.addEventListener('click', async () => {
    if (phase === 'phone') {
      const phone = normalizePhone(phoneInput.value);
      if (phone.length < 8) {
        phoneError.textContent = 'Revisá el número, parece incompleto.';
        return;
      }
      phoneError.textContent = '';
      phase = 'code';
      stepPhone.hidden = true;
      stepCode.hidden = false;
      btnBack.hidden = false;
      codeSub.textContent = `Te lo pasó Romina por WhatsApp al ${phoneInput.value}.`;
      codeInput.focus();
    } else {
      const phone = normalizePhone(phoneInput.value);
      const code = codeInput.value.trim();
      if (code.length !== 4) {
        codeError.textContent = 'El código tiene 4 dígitos.';
        return;
      }
      btnNext.disabled = true;
      const { data, error } = await sb.rpc('login_student', { p_phone: phone, p_code: code });
      btnNext.disabled = false;
      if (error || !data || data.length === 0) {
        codeError.textContent = 'Teléfono o código incorrecto.';
        return;
      }
      const student = data[0];
      session.id = student.id;
      session.name = student.name;
      window.location.href = 'hoy.html';
    }
  });

  btnBack.addEventListener('click', () => {
    phase = 'phone';
    stepCode.hidden = true;
    stepPhone.hidden = false;
    btnBack.hidden = true;
  });
}

// ── Hoy (hoy.html): entrenamiento del día ──
function initHoy() {
  if (!requireSession()) return;
  initHeader();

  const doneToday = new Set();
  let selectedRpe = null;

  async function load() {
    const { data, error } = await sb.rpc('get_my_plan', { p_student_id: session.id });
    const blocksEl = document.getElementById('blocks');
    if (error || !data || data.length === 0) {
      blocksEl.innerHTML = '<p class="sub" style="padding:0 18px;">Todavía no tenés un plan asignado. Escribile a Romina desde el Chat.</p>';
      return;
    }
    renderBlocks(data[0].blocks || []);
    document.getElementById('sensation').hidden = false;
  }

  function renderBlocks(blocks) {
    const container = document.getElementById('blocks');
    container.innerHTML = '';
    blocks.forEach((block) => {
      const head = document.createElement('div');
      head.className = 'block-head';
      head.textContent = `${block.name} · ${block.items.length} ejercicios`;
      container.appendChild(head);

      block.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = `
          <div class="item-check" role="button" aria-label="Marcar ${item.exercise}"></div>
          <div class="item-body">
            <div class="item-name">${item.exercise}</div>
            ${item.note ? `<div class="item-note">${item.note}</div>` : ''}
          </div>
          <div class="item-sets">${item.sets || ''}</div>
        `;
        const check = row.querySelector('.item-check');
        check.addEventListener('click', () => {
          const isDone = row.classList.toggle('done');
          check.classList.toggle('done', isDone);
          check.textContent = isDone ? '✓' : '';
          if (isDone) doneToday.add(item.exercise);
          else doneToday.delete(item.exercise);
        });
        container.appendChild(row);
      });
    });
  }

  document.querySelectorAll('#rpe-group button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#rpe-group button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRpe = btn.dataset.rpe;
    });
  });

  document.getElementById('btn-done').addEventListener('click', async () => {
    const btn = document.getElementById('btn-done');
    btn.disabled = true;
    const { error } = await sb.rpc('save_workout_log', {
      p_student_id: session.id,
      p_day_label: document.getElementById('header-plan-title').textContent,
      p_completed: Array.from(doneToday),
      p_rpe: selectedRpe,
    });
    if (error) {
      btn.disabled = false;
      showToast('No pudimos guardar, probá de nuevo.');
      return;
    }
    btn.textContent = 'Entrenamiento registrado ✓';
    showToast('Listo — Romina ya lo ve en tu ficha');
  });

  load();
}

// ── Progreso (progreso.html) ──
function initProgreso() {
  if (!requireSession()) return;
  initHeader();

  function startOfWeek(d) {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // lunes = 0
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async function load() {
    const { data, error } = await sb.rpc('get_my_logs', { p_student_id: session.id });
    if (error) { showToast('No pudimos cargar tu progreso.'); return; }
    const logs = data || [];

    const weeks = [];
    const thisWeekStart = startOfWeek(new Date());
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisWeekStart);
      start.setDate(start.getDate() - i * 7);
      weeks.push({ start, count: 0 });
    }
    logs.forEach((log) => {
      const ws = startOfWeek(new Date(log.log_date)).getTime();
      const bucket = weeks.find((w) => w.start.getTime() === ws);
      if (bucket) bucket.count++;
    });

    const max = Math.max(1, ...weeks.map((w) => w.count));
    document.getElementById('week-bars').innerHTML = weeks.map((w, i) => `
      <div class="bar-col">
        <div class="bar${i === 7 ? ' is-current' : ''}" style="height:${w.count ? Math.round((w.count / max) * 100) : 3}%"></div>
        <span class="bar-label">${i === 7 ? 'Hoy' : `S${i + 1}`}</span>
      </div>`).join('');

    let racha = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i].count > 0) racha++; else break;
    }
    document.getElementById('stat-racha').textContent = `${racha} semana${racha === 1 ? '' : 's'}`;
    document.getElementById('stat-sesiones').textContent = String(logs.length);

    const historyEl = document.getElementById('history-list');
    if (logs.length === 0) {
      historyEl.innerHTML = '<p class="sub" style="padding:0 18px;">Todavía no registraste entrenamientos.</p>';
    } else {
      historyEl.innerHTML = logs.slice(0, 20).map((log) => `
        <div class="history-row">
          <span class="history-date">${formatShortDate(log.log_date)}</span>
          <span class="history-body">
            <span class="history-title">${escapeHtml(log.day_label || 'Entrenamiento')}</span>
            <span class="history-meta">${(log.completed_items || []).length} ejercicios</span>
          </span>
          <span class="history-rpe${log.rpe === 'duro' ? ' is-hard' : ''}">${rpeLabel(log.rpe)}</span>
        </div>`).join('');
    }
  }

  load();
}

// ── Mi plan (mi-plan.html): resumen del plan + cuota ──
function initMiPlan() {
  if (!requireSession()) return;

  async function load() {
    const status = await initHeader();

    const { data: planData } = await sb.rpc('get_my_plan', { p_student_id: session.id });
    const boxEl = document.getElementById('plan-summary-box');
    if (!planData || planData.length === 0) {
      boxEl.innerHTML = '<p class="sub">Todavía no tenés un plan asignado.</p>';
    } else {
      const plan = planData[0];
      boxEl.innerHTML = `
        <p class="kicker">${plan.level.toUpperCase()} · ${plan.weeks} SEMANAS</p>
        <h3 class="plan-box-title">${escapeHtml(plan.title)}</h3>
        <p class="sub">${escapeHtml(plan.summary || '')}</p>
        <div class="hr"></div>
        ${(plan.blocks || []).map((b) => `
          <div class="plan-box-block">
            <span>${escapeHtml(b.name)}</span><span class="sub-inline">${b.items.length} ejercicios</span>
          </div>`).join('')}
      `;
    }

    const cuotaEl = document.getElementById('cuota-box');
    if (!status) { cuotaEl.hidden = true; return; }
    document.getElementById('cuota-amount').textContent = status.fee != null ? `$ ${Number(status.fee).toLocaleString('es-AR')}` : '—';
    const tag = document.getElementById('cuota-tag');
    tag.textContent = status.payment_status === 'late' ? 'Vencida' : status.payment_status === 'soon' ? 'Por vencer' : 'Al día';
    tag.className = `tag ${statusTagClass(status.payment_status)}`;
    document.getElementById('cuota-due').textContent = status.due_date ? `Próximo vencimiento: ${formatLongDate(status.due_date)}` : 'Sin fecha de vencimiento';
  }

  document.getElementById('btn-pay-mp').addEventListener('click', () => {
    window.open(CONFIG.mercadoPagoLink, '_blank', 'noopener');
  });

  document.getElementById('btn-notify-transfer').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const { error } = await sb.rpc('notify_transfer_payment', { p_student_id: session.id });
    if (error) {
      showToast('No pudimos avisar el pago, probá de nuevo.');
      btn.disabled = false;
      return;
    }
    showToast('Le avisamos a Romina — va a confirmar tu pago pronto.');
  });

  load();
}

// ── Chat (chat.html) ──
function initChat() {
  if (!requireSession()) return;
  initHeader();

  async function load() {
    const { data, error } = await sb.rpc('get_my_thread', { p_student_id: session.id });
    const threadEl = document.getElementById('thread');
    if (error) {
      threadEl.innerHTML = '<p class="sub" style="padding:18px;">No pudimos cargar el chat.</p>';
      return;
    }
    const msgs = data || [];
    if (msgs.length === 0) {
      threadEl.innerHTML = `<p class="sub" style="padding:18px;">Todavía no hay mensajes. Escribile a ${CONFIG.coachName.split(' ')[0]} lo que necesites.</p>`;
    } else {
      threadEl.innerHTML = msgs.map((m) => `
        <div class="bubble-row${m.sender === 'student' ? ' is-own' : ''}">
          <div class="bubble">
            <p class="bubble-meta">${m.sender === 'coach' ? CONFIG.coachName.split(' ')[0].toUpperCase() : 'VOS'} · ${formatTime(m.sent_at)}</p>
            <p class="bubble-text">${escapeHtml(m.body)}</p>
          </div>
        </div>`).join('');
      threadEl.scrollTop = threadEl.scrollHeight;
    }
    sb.rpc('mark_thread_read', { p_student_id: session.id });
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const { error } = await sb.rpc('send_my_message', { p_student_id: session.id, p_body: text });
    if (error) { showToast('No se pudo enviar, probá de nuevo.'); return; }
    load();
  }

  document.getElementById('btn-send').addEventListener('click', send);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  load();
}

// ── Bootstrap por página ──
if (document.getElementById('step-phone')) initLogin();
if (document.getElementById('blocks')) initHoy();
if (document.getElementById('week-bars')) initProgreso();
if (document.getElementById('cuota-box')) initMiPlan();
if (document.getElementById('thread')) initChat();
