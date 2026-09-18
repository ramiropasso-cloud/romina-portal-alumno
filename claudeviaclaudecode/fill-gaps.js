#!/usr/bin/env node
// Completa los bloques de calentamiento/vuelta a la calma que el
// documento fuente dejó vacíos, reutilizando el bloque equivalente
// (mismo tipo de día) de Home Básico, que sí está completo.
// Corré parse-planes.js antes que este script.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'planes_parsed.json');
const plans = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const basico = plans.find((p) => p.title === 'Home Básico');
function basicoBlock(dayIdx, nameStartsWith) {
  const day = basico.days[dayIdx];
  const block = day.blocks.find((b) => b.name.startsWith(nameStartsWith));
  if (!block) throw new Error(`No encontré "${nameStartsWith}" en Home Básico día ${dayIdx + 1}`);
  return JSON.parse(JSON.stringify(block.items)); // clon
}

// mapa: [plan, día, nombre del bloque vacío o "igual que Plan 1"] → de qué
// día de Home Básico tomar los ítems (0=Día1 Fuerza, 1=Día2 Aeróbico, 2=Día3 Fullbody)
const fills = [
  ['Home Pro', 'DÍA 1', 'Entrada en calor', 0, 'Entrada en calor'],
  ['Home Pro', 'DÍA 2', 'Entrada en calor', 1, 'Entrada en calor'],
  ['Home Pro', 'DÍA 2', 'Vuelta a la calma', 1, 'Vuelta a la calma'],
  ['Home Pro', 'DÍA 3', 'Entrada en calor', 2, 'Entrada en calor'],
  ['Home Pro', 'DÍA 3', 'Vuelta a la calma', 2, 'Vuelta a la calma'],
  ['Home Pro', 'DÍA 4', 'Vuelta a la calma', 2, 'Vuelta a la calma'],
  ['Battle Fox Online', 'DÍA 1', 'Vuelta a la calma', 0, 'Vuelta a la calma'],
  ['Battle Fox Online', 'DÍA 2', 'Entrada en calor', 1, 'Entrada en calor'],
  ['Battle Fox Online', 'DÍA 2', 'Vuelta a la calma', 1, 'Vuelta a la calma'],
  ['Battle Fox Online', 'DÍA 3', 'Vuelta a la calma', 2, 'Vuelta a la calma'],
  ['Battle Fox Online', 'DÍA 5', 'Entrada en calor', 2, 'Entrada en calor'],
  ['Battle Fox Online', 'DÍA 5', 'Vuelta a la calma', 2, 'Vuelta a la calma'],
  ['Battle Fox Online', 'DÍA 6', 'Entrada en calor', 1, 'Entrada en calor'],
];

function needsFill(items) {
  return items.length === 0 || items.some((i) => /^Igual que/i.test(i.exercise));
}

let filled = 0;
fills.forEach(([planTitle, dayPrefix, blockPrefix, basicoDayIdx, basicoBlockPrefix]) => {
  const plan = plans.find((p) => p.title === planTitle);
  const day = plan.days.find((d) => d.day_label.startsWith(dayPrefix));
  const block = day.blocks.find((b) => b.name.startsWith(blockPrefix));
  if (!needsFill(block.items)) {
    console.log(`(ya tenía contenido, no toco) ${planTitle} — ${day.day_label} — ${block.name}`);
    return;
  }
  block.items = basicoBlock(basicoDayIdx, basicoBlockPrefix);
  block.name = block.name.replace(/\s*—\s*igual que plan 1\s*$/i, '');
  filled++;
  console.log(`Completado: ${planTitle} — ${day.day_label} — ${block.name} (${block.items.length} ítems, de Home Básico Día ${basicoDayIdx + 1})`);
});

fs.writeFileSync(FILE, JSON.stringify(plans, null, 2), 'utf8');
console.log(`\nOK — ${filled} bloques completados. Guardado en ${FILE}`);
