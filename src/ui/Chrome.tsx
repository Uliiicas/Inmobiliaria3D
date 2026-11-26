import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, type Quality } from '../state/store'
import { PROPERTY } from '../data/rooms'
import { veil } from '../scene/ExploreRig'
import { IconFilm, IconGauge, IconInfo, IconPano } from './Icons'

/** Página del recorrido en video (video/index.html) */
export const VIDEO_URL = `${import.meta.env.BASE_URL}video/`

const ease = [0.22, 1, 0.36, 1] as const

/** Pantalla de carga con progreso real por etapas */
export function Loader() {
  const ready = useStore((s) => s.ready)
  const stage = useStore((s) => s.loadStage)
  const progress = useStore((s) => s.loadProgress)
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-ink"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.4, ease } }}
        >
          <p className="eyebrow mb-6">{PROPERTY.location}</p>
          <h1 className="display text-center text-[clamp(44px,7vw,92px)]">{PROPERTY.name}</h1>
          <div className="mt-10 h-px w-[min(60vw,280px)] bg-ivory/15">
            <motion.div className="h-px bg-ivory" animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 0.8, ease }} />
          </div>
          <p className="mt-4 text-[11px] tracking-[0.24em] text-ivory/55 uppercase" aria-live="polite">
            {stage}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Velo de transición entre ambientes (modo 360°) */
export function Veil() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (ref.current) ref.current.style.opacity = String(veil.value)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div ref={ref} className="pointer-events-none fixed inset-0 z-[40] bg-[#1a1714] opacity-0" aria-hidden />
}

export function TopBar({ onExplore, onHome }: { onExplore: () => void; onHome: () => void }) {
  const mode = useStore((s) => s.mode)
  const showInfo = useStore((s) => s.showInfo)
  const quality = useStore((s) => s.quality)
  const set = useStore((s) => s.set)
  const [qOpen, setQOpen] = useState(false)
  const labels: Record<Quality, string> = { high: 'Cinemática', medium: 'Equilibrada', low: 'Ligera' }
  return (
    <header className="scrim-top pointer-events-none fixed inset-x-0 top-0 z-[50] flex items-start justify-between px-5 pt-5 pb-10 md:px-10 md:pt-7">
      <button className="pointer-events-auto text-left" onClick={onHome} aria-label="Volver al inicio">
        <span className="display block text-[26px] leading-none md:text-[30px]">{PROPERTY.name}</span>
        <span className="eyebrow mt-1.5 block !text-[9px]">{PROPERTY.location} · Private Estates</span>
      </button>
      <nav className="pointer-events-auto flex items-center gap-2">
        {mode === 'tour' && (
          <a className="btn btn-line !h-[42px] !px-4 max-lg:!hidden" href={VIDEO_URL}>
            <IconFilm width={16} height={16} /> Ver en video
          </a>
        )}
        {mode === 'tour' && (
          <a className="icon-btn lg:!hidden" href={VIDEO_URL} aria-label="Ver el recorrido en video" title="Recorrido en video">
            <IconFilm />
          </a>
        )}
        {mode === 'tour' && (
          <button className="btn btn-line !h-[42px] !px-4 max-sm:!hidden" onClick={onExplore}>
            <IconPano width={16} height={16} /> Explorar propiedad 360°
          </button>
        )}
        {mode === 'tour' && (
          <button className="icon-btn sm:!hidden" onClick={onExplore} aria-label="Explorar propiedad 360°">
            <IconPano />
          </button>
        )}
        <button
          className="icon-btn"
          aria-pressed={showInfo}
          onClick={() => set({ showInfo: !showInfo })}
          aria-label={showInfo ? 'Ocultar información' : 'Mostrar información'}
          title="Información arquitectónica"
        >
          <IconInfo />
        </button>
        <div className="relative">
          <button className="icon-btn" aria-expanded={qOpen} onClick={() => setQOpen((o) => !o)} aria-label="Calidad gráfica" title="Calidad gráfica">
            <IconGauge />
          </button>
          {qOpen && (
            <div className="panel-strong absolute top-12 right-0 w-56 p-2">
              <p className="eyebrow px-3 pt-2 pb-2">Calidad gráfica</p>
              {(['high', 'medium', 'low'] as Quality[]).map((q) => (
                <button
                  key={q}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] ${q === quality ? 'text-ivory' : 'text-ivory/60 hover:text-ivory'}`}
                  onClick={() => {
                    set({ quality: q, qualityLocked: true })
                    setQOpen(false)
                  }}
                >
                  {labels[q]}
                  {q === quality && <span className="h-1.5 w-1.5 rounded-full bg-sand" />}
                </button>
              ))}
              <p className="px-3 pt-2 pb-2 text-[11px] leading-relaxed text-ivory/45">Se ajusta sola según el rendimiento de su dispositivo.</p>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
