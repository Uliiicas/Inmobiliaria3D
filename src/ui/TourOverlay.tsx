import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CHAPTERS, SHOTS, shotToProgress } from '../data/tour'
import { PROPERTY } from '../data/rooms'
import { useStore } from '../state/store'
import { IconArrow, IconPano } from './Icons'
import { loadHiggsfieldManifest, type HiggsfieldAsset } from '../lib/higgsfield'

const ease = [0.22, 1, 0.36, 1] as const

export function scrollToProgress(p: number, smooth = true) {
  const max = document.documentElement.scrollHeight - innerHeight
  const reduced = useStore.getState().reducedMotion
  window.scrollTo({ top: p * max, behavior: smooth && !reduced ? 'smooth' : 'auto' })
}

/** Portada: el titular aparece sobre la escena 3D de la fachada */
export function Hero({ onExplore }: { onExplore: () => void }) {
  const progress = useStore((s) => s.tourProgress)
  const ready = useStore((s) => s.ready)
  const visible = progress < 0.012
  return (
    <AnimatePresence>
      {visible && ready && (
        <motion.section
          className="pointer-events-none fixed inset-0 z-[30] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 1.6, ease, delay: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease } }}
          aria-label="Portada"
        >
          <div className="scrim-bottom px-5 pt-40 pb-10 md:px-10 md:pb-14">
            <motion.p
              className="eyebrow mb-5 [@media(max-height:780px)]:hidden"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 1.2, ease, delay: 0.6 } }}
            >
              Residencia contemporánea · {PROPERTY.location}
            </motion.p>
            <h1 className="display max-w-[16ch] text-[clamp(42px,min(8.4vw,11vh),132px)]">
              {['Where architecture', 'meets the ocean'].map((l, i) => (
                <span key={l} className="block overflow-hidden pb-[0.06em]">
                  <motion.span
                    className="block"
                    initial={{ y: '105%' }}
                    animate={{ y: 0, transition: { duration: 1.6, ease, delay: 0.7 + i * 0.14 } }}
                  >
                    {i === 1 ? (
                      <>
                        meets the <em className="font-normal italic">ocean</em>
                      </>
                    ) : (
                      l
                    )}
                  </motion.span>
                </span>
              ))}
            </h1>
            <div className="mt-8 flex flex-col gap-8 md:mt-10 lg:flex-row lg:items-end lg:justify-between">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 1.4, delay: 1.2 } }}>
                <p className="caption max-w-[44ch] !text-[15px]">{PROPERTY.subtitle}</p>
                <div className="pointer-events-auto mt-7 flex flex-wrap gap-3">
                  <button className="btn btn-solid" onClick={() => scrollToProgress(shotToProgress(3.2))}>
                    Descubrir propiedad <IconArrow width={15} height={15} />
                  </button>
                  <button className="btn btn-line" onClick={onExplore}>
                    <IconPano width={16} height={16} /> Explorar en 360°
                  </button>
                </div>
              </motion.div>
              <motion.dl
                className="grid grid-cols-3 gap-x-8 gap-y-5 sm:grid-cols-6 lg:gap-x-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 1.4, ease, delay: 1.4 } }}
              >
                {PROPERTY.stats.map((s) => (
                  <div key={s.l} className="border-t border-[var(--hair-strong)] pt-3">
                    <dt className="display text-[30px] leading-none md:text-[38px]">
                      {s.v}
                      <span className="ml-0.5 text-[0.55em]">{s.u}</span>
                    </dt>
                    <dd className="mt-1.5 text-[10px] tracking-[0.18em] text-ivory/60 uppercase">{s.l}</dd>
                  </div>
                ))}
              </motion.dl>
            </div>
          </div>
          <div className="absolute top-1/2 right-6 hidden -translate-y-1/2 flex-col items-center gap-4 md:flex">
            <span className="eyebrow [writing-mode:vertical-rl]">Scroll</span>
            <span className="scroll-line" />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

/** Descripciones arquitectónicas discretas que acompañan cada espacio */
export function Captions() {
  const progress = useStore((s) => s.tourProgress)
  const showInfo = useStore((s) => s.showInfo)
  const f = progress * (SHOTS.length - 1)
  const ch = CHAPTERS.find((c) => f >= c.from && f <= c.to)
  return (
    <div className="pointer-events-none fixed bottom-[132px] left-5 z-[25] max-w-[min(86vw,380px)] md:bottom-14 md:left-10">
      <AnimatePresence mode="wait">
        {ch && showInfo && (
          <motion.div
            key={ch.kicker}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 1.1, ease } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.5, ease } }}
          >
            <p className="eyebrow mb-3">{ch.kicker}</p>
            <h2 className="display text-[clamp(34px,4.2vw,58px)] [text-shadow:0_2px_30px_rgba(0,0,0,.35)]">{ch.title}</h2>
            <p className="caption mt-3 max-w-[34ch] [text-shadow:0_1px_14px_rgba(0,0,0,.5)]">{ch.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Riel de progreso con capítulos; permite saltar a cualquier espacio */
export function ProgressRail() {
  const progress = useStore((s) => s.tourProgress)
  const f = progress * (SHOTS.length - 1)
  const visible = progress > 0.01
  return (
    <nav
      className={`fixed top-1/2 right-4 z-[30] hidden -translate-y-1/2 transition-opacity duration-700 md:block ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      aria-label="Capítulos del recorrido"
    >
      <div className="relative flex h-[52vh] flex-col justify-between py-1">
        <span className="absolute top-0 bottom-0 left-[3px] w-px bg-ivory/15" />
        <span className="absolute top-0 left-[3px] w-px bg-ivory transition-[height] duration-300" style={{ height: `${progress * 100}%` }} />
        {CHAPTERS.map((c) => {
          const active = f >= c.from && f <= c.to
          return (
            <button key={c.kicker} className="group relative flex items-center gap-3" onClick={() => scrollToProgress(shotToProgress((c.from + c.to) / 2))} aria-label={c.kicker}>
              <span className={`relative z-10 h-[7px] w-[7px] rounded-full border border-ivory/70 transition-colors ${active || f > c.to ? 'bg-ivory' : 'bg-ink'}`} />
              <span
                className={`absolute right-5 text-[10px] tracking-[0.2em] whitespace-nowrap uppercase transition-opacity duration-500 ${active ? 'opacity-90' : 'opacity-0 group-hover:opacity-70'}`}
              >
                {c.kicker.split(' · ')[1]}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Cierre del recorrido: invitación a la visita y galería fotorrealista opcional (Higgsfield) */
export function Finale({ onExplore }: { onExplore: () => void }) {
  const progress = useStore((s) => s.tourProgress)
  const set = useStore((s) => s.set)
  const [assets, setAssets] = useState<HiggsfieldAsset[]>([])
  useEffect(() => {
    loadHiggsfieldManifest().then((m) => setAssets(m?.assets.filter((a) => a.kind === 'image').slice(0, 6) ?? []))
  }, [])
  const visible = progress > 0.985
  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          className="pointer-events-none fixed inset-0 z-[30] flex items-center justify-center px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 1.4, ease } }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
        >
          <div className="pointer-events-auto max-w-[760px] text-center">
            <p className="eyebrow mb-6">Fin del recorrido</p>
            <h2 className="display text-[clamp(40px,6vw,92px)] [text-shadow:0_2px_40px_rgba(0,0,0,.35)]">
              El horizonte, <em className="italic">a diario</em>
            </h2>
            <p className="caption mx-auto mt-5 max-w-[46ch] !text-[15px]">
              Visitas privadas con cita previa. Le acompañamos a recorrer la residencia en persona, a la hora del día que prefiera.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <button className="btn btn-solid" onClick={() => set({ contactOpen: true })}>
                Solicitar visita privada
              </button>
              <button className="btn btn-line" onClick={onExplore}>
                <IconPano width={16} height={16} /> Explorar en 360°
              </button>
            </div>
            {assets.length > 0 && (
              <div className="mt-12">
                <p className="eyebrow mb-4">Renders fotorrealistas · Higgsfield AI</p>
                <div className="flex justify-center gap-2 overflow-x-auto">
                  {assets.map((a) => (
                    <img key={a.id} src={a.src} alt={a.title ?? 'Render'} loading="lazy" className="h-24 w-36 flex-none object-cover opacity-90" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
