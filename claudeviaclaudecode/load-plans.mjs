#!/usr/bin/env node
// Sube planes_parsed.json a Supabase vía admin_upsert_plan.
// Uso: ADMIN_PASS=tu-contraseña node load-plans.mjs [planes_parsed.json]
//
// Lee supabaseUrl / supabaseAnonKey de ../app.js (no hace falta pegarlos
// acá). La contraseña de administración NUNCA va en este archivo —
// se pasa por variable de entorno para poder commitear este script.
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_PASS) {
  console.error('Falta ADMIN_PASS. Uso: ADMIN_PASS=tu-contraseña node load-plans.mjs [archivo.json]');
  process.exit(1);
}

const appJs = readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const url = appJs.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const key = appJs.match(/supabaseAnonKey:\s*'([^']+)'/)?.[1];
if (!url || !key) {
  console.error('No pude leer supabaseUrl/supabaseAnonKey desde app.js');
  process.exit(1);
}

const jsonPath = process.argv[2] || path.join(__dirname, 'planes_parsed.json');
const plans = JSON.parse(readFileSync(jsonPath, 'utf8'));

async function rpc(fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

for (const p of plans) {
  const { status, body } = await rpc('admin_upsert_plan', {
    p_admin_pass: ADMIN_PASS,
    p_title: p.title,
    p_level: p.level,
    p_weeks: p.weeks,
    p_summary: p.summary,
    p_days: p.days,
  });
  console.log(`${p.title}: HTTP ${status} → ${body}`);
}
