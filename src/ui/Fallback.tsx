import { useEffect, useState } from 'react'
import { PROPERTY, ROOMS, roomArea } from '../data/rooms'
import { PlanSvg } from './PlanSvg'
import { useStore } from '../state/store'
import { loadHiggsfieldManifest, type HiggsfieldManifest } from '../lib/higgsfield'

/**
 * Versión alternativa para dispositivos sin WebGL: ficha editorial con plano interactivo
 * y, si existen, los renders pre-generados.
 */
export function Fallback() {
  const set = useStore((s) => s.set)
  const [m, setM] = useState<HiggsfieldManifest | null>(null)
  const [floor, setFloor] = useState<0 | 1>(0)
  const [sel, setSel] = useState('living')
  useEffect(() => {
    loadHiggsfieldManifest().then(setM)
  }, [])
  const room = ROOMS.find((r) => r.id === sel)!
  const img = m?.assets.find((a) => a.room === sel && a.kind === 'image')
  return (
    <main className="min-h-screen px-6 py-16 md:px-16">
      <p className="eyebrow">{PROPERTY.location}</p>
      <h1 className="display mt-4 max-w-[14ch] text-[clamp(48px,9vw,120px)]">{PROPERTY.headline}</h1>
      <p className="caption mt-6 max-w-[48ch] !text-[16px]">{PROPERTY.subtitle}</p>
      <p className="mt-4 text-[12px] text-ivory/45">Su navegador no permite gráficos 3D. Le mostramos la versión editorial de la residencia.</p>
      <dl className="mt-10 grid max-w-[900px] grid-cols-3 gap-6 sm:grid-cols-6">
        {PROPERTY.stats.map((s) => (
          <div key={s.l} className="border-t border-[var(--hair-strong)] pt-3">
            <dt className="display text-[34px]">
              {s.v}
              <span className="text-[0.55em]">{s.u}</span>
            </dt>
            <dd className="text-[10px] tracking-[0.18em] text-ivory/60 uppercase">{s.l}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-16 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-4 flex">
            {([0, 1] as const).map((f) => (
              <button key={f} className="chip !h-10" aria-pressed={floor === f} onClick={() => setFloor(f)}>
                {f === 0 ? 'Planta baja' : 'Planta alta'}
              </button>
            ))}
          </div>
          <PlanSvg floor={floor} activeId={sel} onSelect={setSel} showCamera={false} className="w-full" />
        </div>
        <div>
          {img && <img src={img.src} alt={room.name} className="mb-6 aspect-[4/3] w-full object-cover" />}
          <p className="eyebrow">{room.mood}</p>
          <h2 className="display mt-3 text-[52px]">{room.name}</h2>
          <p className="caption mt-3">{room.description}</p>
          {!room.exterior && <p className="mt-4 text-[12px] tracking-[0.16em] text-ivory/60 uppercase">{Math.round(roomArea(room))} m²</p>}
          <button className="btn btn-solid mt-8" onClick={() => set({ contactOpen: true })}>
            Solicitar visita privada
          </button>
        </div>
      </section>
    </main>
  )
}
