#!/usr/bin/env node
// Convierte planes_entrenamiento.md al formato JSON que espera
// admin_upsert_plan (plans.days). Uso: node parse-planes.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'planes_entrenamiento.md');
const raw = fs.readFileSync(SRC, 'utf8');

const TITLES = {
  1: 'Home Básico',
  2: 'Home Pro',
  3: 'Battle Fox Online',
};
const DEFAULT_WEEKS = 12;

function levelFromMeta(meta) {
  const m = meta.match(/Nivel\s+(\w+)/i);
  if (!m) return 'Intermedio';
  const w = m[1].toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function parseItemLine(line) {
  // saca marcadores de lista: "- ", "1. ", "2. ", etc.
  let text = line.replace(/^-\s+/, '').replace(/^\d+\.\s+/, '').trim();

  // slot tipo "MIN 1 → ...", "Estación 1 → ...", "A → ...", "B → ..."
  let slot = null;
  const slotMatch = text.match(/^(MIN\s+\d+|Estación\s+\d+|[A-B])\s*→\s*(.+)$/i);
  if (slotMatch) {
    slot = slotMatch[1];
    text = slotMatch[2].trim();
  }

  // cantidad al inicio: "10 Sentadillas (nota)", "30\" Trote...", "2 min Soga..."
  const qtyMatch = text.match(/^(\d+(?:["'])?(?:\s+min)?)\s+(.+)$/);
  let sets = '';
  let exercise = text;
  let note = '';
  if (qtyMatch) {
    sets = qtyMatch[1];
    exercise = qtyMatch[2];
  }
  const parenMatch = exercise.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    exercise = parenMatch[1].trim();
    note = parenMatch[2].trim();
  }

  if (slot) exercise = `${slot} · ${exercise}`;
  return { exercise, sets, note };
}

const MARKER_RE = /^(-\s+|\d+\.\s+|(MIN\s+\d+|Estación\s+\d+|[A-B])\s*→)/i;

function parseDayBody(rawLines) {
  const lines = rawLines.map((l) => l.trim()).filter((l) => l && l !== '---');
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (boldMatch) {
      let label = boldMatch[1].trim();
      if (label.endsWith(':')) label = label.slice(0, -1).trim();
      const rest = boldMatch[2].trim();

      let name = label;
      let inlineItemText = null;

      if (rest.startsWith('(')) {
        name = `${label} ${rest}`;
        // solo "extraemos" la parte después del guion como ítem propio
        // cuando es una referencia cruzada tipo "igual que Plan 1"; si no,
        // queda como parte del nombre del bloque y las líneas siguientes
        // (bullets/números) completan los ítems normalmente.
        const crossRefMatch = rest.match(/—\s*(igual que[^)]*)\)?\s*$/i);
        if (crossRefMatch) {
          const note = crossRefMatch[1].trim();
          current = { name, items: [{ exercise: note.charAt(0).toUpperCase() + note.slice(1), sets: '', note: '' }] };
          blocks.push(current);
          continue;
        }
      } else if (rest) {
        inlineItemText = rest;
      }

      current = { name, items: [] };
      blocks.push(current);
      if (inlineItemText) current.items.push(parseItemLine(inlineItemText));
      continue;
    }

    // clarificador itálico standalone: *(Cada minuto, al minuto. 5 rondas completas.)*
    const italicMatch = line.match(/^\*\(([^)]+)\)\*$/);
    if (italicMatch && current && current.items.length === 0) {
      current.name = `${current.name} — ${italicMatch[1].trim()}`;
      continue;
    }

    if (!current) continue;

    // frase suelta (sin -, N. ni slot) justo después del header, seguida
    // de una lista real: es una aclaración del formato, no un ejercicio
    // → se pliega en el nombre del bloque en vez de quedar como ítem.
    if (current.items.length === 0 && !MARKER_RE.test(line)) {
      const next = lines[i + 1];
      if (next && MARKER_RE.test(next)) {
        current.name = `${current.name} — ${line}`;
        continue;
      }
    }

    current.items.push(parseItemLine(line));
  }

  return blocks;
}

function parsePlan(num, section) {
  const lines = section.split('\n');
  // primera línea no vacía = metadata en negrita (resumen)
  let metaIdx = lines.findIndex((l) => l.trim().startsWith('**'));
  const meta = metaIdx !== -1 ? lines[metaIdx].replace(/\*\*/g, '').trim() : '';
  const level = levelFromMeta(meta);

  // días: "### DÍA N — ..."
  const dayHeaderRe = /^###\s+DÍA\s+\d+\s*—\s*(.+)$/i;
  const dayIndices = [];
  lines.forEach((l, i) => {
    if (dayHeaderRe.test(l.trim())) dayIndices.push(i);
  });

  const days = dayIndices.map((startIdx, i) => {
    const endIdx = i + 1 < dayIndices.length ? dayIndices[i + 1] : lines.length;
    const headerText = lines[startIdx].trim().replace(/^###\s+/, '');
    const bodyLines = lines.slice(startIdx + 1, endIdx);
    return {
      day_label: headerText,
      blocks: parseDayBody(bodyLines),
    };
  });

  return {
    title: TITLES[num],
    level,
    weeks: DEFAULT_WEEKS,
    summary: meta,
    days,
  };
}

// separar por "## PLAN N —"
const planHeaderRe = /^##\s+PLAN\s+(\d+)\s*—/gm;
const matches = [...raw.matchAll(planHeaderRe)];
const plans = matches.map((m, i) => {
  const num = Number(m[1]);
  const start = m.index;
  const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
  return parsePlan(num, raw.slice(start, end));
});

const outPath = path.join(__dirname, 'planes_parsed.json');
fs.writeFileSync(outPath, JSON.stringify(plans, null, 2), 'utf8');
console.log(`OK — ${plans.length} planes escritos en ${outPath}`);
plans.forEach((p) => {
  const totalItems = p.days.reduce((a, d) => a + d.blocks.reduce((b, bl) => b + bl.items.length, 0), 0);
  console.log(`  ${p.title}: ${p.days.length} días, ${totalItems} ejercicios en total`);
});
