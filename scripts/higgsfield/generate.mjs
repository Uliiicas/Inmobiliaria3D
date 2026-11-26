#!/usr/bin/env node
/**
 * Generador de recursos fotorrealistas con la API oficial de Higgsfield.
 * Documentación: https://docs.higgsfield.ai  (API REST en https://api.higgsfield.ai)
 *
 * ⚠️ Se ejecuta SOLO en su máquina o en CI. Las credenciales nunca llegan al navegador:
 *    el sitio sólo lee los archivos estáticos resultantes y public/higgsfield/manifest.json.
 *
 * Uso:
 *   HF_API_KEY_ID=... HF_API_KEY_SECRET=... npm run higgsfield:generate
 *   npm run higgsfield:generate -- --only living,piscina      # sólo algunos recursos
 *   npm run higgsfield:generate -- --dry-run                  # muestra las solicitudes sin enviarlas
 *   npm run higgsfield:generate -- --force                    # regenera aunque ya existan
 *   npm run higgsfield:generate -- --textures                 # también genera texturas tileables
 *   npm run higgsfield:generate -- --scan                     # sin API: indexa archivos exportados a mano
 *   npm run higgsfield:status                                 # estado del manifiesto actual
 *
 * Flujo de la API (según la documentación oficial):
 *   POST https://api.higgsfield.ai/<model>               Authorization: Key <id>:<secret>
 *     → { status: "queued", request_id, status_url, cancel_url }
 *   GET  <status_url> hasta status ∈ completed | failed | nsfw | canceled
 *     → imágenes: { images: [{ url }] } · video: { video: { url } }
 *   Las URLs de resultado caducan (7 días por defecto): este script las descarga a public/higgsfield/.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'public/higgsfield')
const MANIFEST = join(OUT, 'manifest.json')
const API = process.env.HF_API_BASE ?? 'https://api.higgsfield.ai'
const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : undefined
}

loadDotEnv()
const config = JSON.parse(readFileSync(join(ROOT, 'scripts/higgsfield/prompts.json'), 'utf8'))
mkdirSync(OUT, { recursive: true })
const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { version: 1, generator: 'higgsfield', assets: [], textures: {} }
manifest.textures ??= {}

if (flag('--status')) {
  console.log(`Manifiesto: ${manifest.assets.length} recursos, ${Object.keys(manifest.textures).length} texturas`)
  for (const a of manifest.assets) console.log(` · ${a.id.padEnd(22)} ${a.kind.padEnd(6)} ${a.src}`)
  process.exit(0)
}

if (flag('--scan')) {
  scanManualExports()
  process.exit(0)
}

const KEY_ID = process.env.HF_API_KEY_ID
const KEY_SECRET = process.env.HF_API_KEY_SECRET
const dry = flag('--dry-run')
if (!dry && (!KEY_ID || !KEY_SECRET)) {
  console.error(
    '\nFaltan credenciales. Cree una clave en https://console.higgsfield.ai y defina HF_API_KEY_ID y HF_API_KEY_SECRET\n' +
      '(en .env o en el entorno). Mientras tanto, la web funciona con materiales procedurales.\n' +
      'Alternativa sin API: exporte imágenes desde higgsfield.ai a public/higgsfield/<id>.jpg y ejecute --scan.\n',
  )
  process.exit(1)
}

const only = opt('--only')?.split(',')
const force = flag('--force')
const remoteUrls = new Map() // id → URL remota vigente (para encadenar imagen → video)

const queue = config.assets.filter((a) => !only || only.includes(a.id))
// primero imágenes, luego videos que las referencian
queue.sort((a, b) => (a.kind === 'video') - (b.kind === 'video'))

for (const asset of queue) {
  const existing = manifest.assets.find((a) => a.id === asset.id)
  if (existing && !force && existsSync(join(ROOT, 'public', existing.src))) {
    console.log(`↷ ${asset.id}: ya existe (use --force para regenerar)`)
    continue
  }
  const def = config.defaults[asset.kind]
  const model = asset.model ?? def.model
  const body = { prompt: `${asset.prompt}. ${config.style}`, ...def.params, ...(asset.params ?? {}) }
  if (asset.kind === 'video') {
    const refs = (asset.fromImages ?? []).map((id) => remoteUrls.get(id)).filter(Boolean)
    if (!refs.length && !dry) {
      console.warn(`! ${asset.id}: el modelo de video necesita URLs públicas de referencia; genere antes ${asset.fromImages?.join(', ')} en esta misma ejecución`)
      continue
    }
    body.image_urls = refs.length ? refs : ['<url de la imagen generada>']
  }
  try {
    const result = await run(model, body, asset.id)
    if (!result) continue
    const url = asset.kind === 'video' ? result.video?.url : result.images?.[0]?.url
    if (!url) throw new Error('respuesta sin URL de resultado')
    remoteUrls.set(asset.id, url)
    const ext = extFromUrl(url, asset.kind === 'video' ? '.mp4' : '.jpg')
    const file = `higgsfield/${asset.id}${ext}`
    await download(url, join(ROOT, 'public', file))
    upsert({
      id: asset.id,
      room: asset.room,
      kind: asset.kind,
      src: file,
      poster: asset.kind === 'video' ? manifest.assets.find((a) => a.id === asset.fromImages?.[0])?.src : undefined,
      title: asset.title,
      prompt: asset.prompt,
      model,
      createdAt: new Date().toISOString(),
    })
    console.log(`✓ ${asset.id} → public/${file}`)
  } catch (e) {
    console.error(`✗ ${asset.id}: ${e.message}`)
  }
}

if (flag('--textures')) {
  for (const [key, t] of Object.entries(config.textures)) {
    if (key.startsWith('$')) continue
    if (manifest.textures[key] && !force) continue
    try {
      const def = config.defaults.image
      const result = await run(t.model ?? def.model, { prompt: t.prompt, ...def.params, ...(t.params ?? {}) }, `texture-${key}`)
      const url = result?.images?.[0]?.url
      if (!url) continue
      const file = `higgsfield/texture-${key}${extFromUrl(url, '.jpg')}`
      await download(url, join(ROOT, 'public', file))
      manifest.textures[key] = file
      save()
      console.log(`✓ textura ${key} → public/${file}`)
    } catch (e) {
      console.error(`✗ textura ${key}: ${e.message}`)
    }
  }
}

save()
console.log(`\nManifiesto actualizado: public/higgsfield/manifest.json (${manifest.assets.length} recursos)`)

// ───────────────────────────── utilidades ─────────────────────────────

async function run(model, body, id) {
  const url = `${API}/${model.replace(/^\//, '')}`
  if (dry) {
    console.log(`\n[dry-run] POST ${url}\n${JSON.stringify(body, null, 2)}`)
    return null
  }
  const headers = {
    Authorization: `Key ${KEY_ID}:${KEY_SECRET}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Idempotency-Key': createHash('sha256').update(`${id}:${model}:${JSON.stringify(body)}`).digest('hex').slice(0, 40),
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`HTTP ${res.status} ${json.detail ? JSON.stringify(json.detail) : ''}`.trim())
  console.log(`… ${id}: en cola (${json.request_id})`)
  const statusUrl = json.status_url ?? `${API}/requests/${json.request_id}/status`
  const started = Date.now()
  let delay = 3000
  while (Date.now() - started < 20 * 60 * 1000) {
    await sleep(delay)
    delay = Math.min(delay * 1.4, 15000)
    const s = await fetch(statusUrl, { headers })
    const st = await s.json().catch(() => ({}))
    if (!s.ok) throw new Error(`estado HTTP ${s.status}`)
    if (st.status === 'completed') return st
    if (['failed', 'nsfw', 'canceled'].includes(st.status)) throw new Error(`terminó con estado "${st.status}" ${st.error ?? ''}`)
  }
  throw new Error('tiempo de espera agotado (20 min)')
}

async function download(url, dest) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`descarga HTTP ${r.status}`)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

function upsert(entry) {
  const i = manifest.assets.findIndex((a) => a.id === entry.id)
  if (i >= 0) manifest.assets[i] = entry
  else manifest.assets.push(entry)
  save()
}

function save() {
  manifest.version = 1
  manifest.generator = 'higgsfield'
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
}

/** Indexa archivos exportados a mano desde higgsfield.ai: public/higgsfield/<id>.(jpg|png|webp|mp4) */
function scanManualExports() {
  const byId = Object.fromEntries(config.assets.map((a) => [a.id, a]))
  let n = 0
  for (const f of readdirSync(OUT)) {
    const ext = extname(f).toLowerCase()
    const id = f.slice(0, -ext.length)
    if (!['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'].includes(ext)) continue
    if (id.startsWith('texture-')) {
      manifest.textures[id.slice(8)] = `higgsfield/${f}`
      n++
      continue
    }
    const a = byId[id]
    upsert({
      id,
      room: a?.room,
      kind: ['.mp4', '.webm'].includes(ext) ? 'video' : 'image',
      src: `higgsfield/${f}`,
      title: a?.title ?? id,
      prompt: a?.prompt,
      createdAt: new Date().toISOString(),
    })
    n++
  }
  save()
  console.log(`Indexados ${n} archivos en public/higgsfield/manifest.json`)
}

function extFromUrl(u, fallback) {
  const e = extname(new URL(u).pathname).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm', '.mov'].includes(e) ? e : fallback
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function loadDotEnv() {
  const p = join(ROOT, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
