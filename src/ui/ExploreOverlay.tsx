import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ROOMS, ROOM_BY_ID, roomArea, roomAt, roomDims, type FloorId } from '../data/rooms'
import { useStore } from '../state/store'
import { PlanSvg } from './PlanSvg'
import { IconArrow, IconClose, IconDrag, IconInfo, IconPlan, IconRuler, IconZoom } from './Icons'
import { assetsForRoom, loadHiggsfieldManifest, type HiggsfieldManifest } from '../lib/higgsfield'

const ease = [0.22, 1, 0.36, 1] as const

/** Interfaz del modo de exploración libre 360° */
export function ExploreOverlay({ onExit }: { onExit: () => void }) {
  const roomId = useStore((s) => s.roomId)
  const planOpen = useStore((s) => s.planOpen)
  const planFloor = useStore((s) => s.planFloor)
  const showInfo = useStore((s) => s.showInfo)
  const showMeasures = useStore((s) => s.showMeasures)
  const transitioning = useStore((s) => s.transitioning)
  const set = useStore((s) => s.set)
  const goRoom = useStore((s) => s.goRoom)
  const room = ROOM_BY_ID[roomId]
  const [hint, setHint] = useState(true)
  const [manifest, setManifest] = useState<HiggsfieldManifest | null>(null)
  const [refOpen, setRefOpen] = useState(false)
  useEffect(() => {
    loadHiggsfieldManifest().then(setManifest)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => setRefOpen(false), [roomId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useStore.getState().planOpen) set({ planOpen: false })
        else onExit()
      }
      if (e.key.toLowerCase() === 'p') set({ planOpen: !useStore.getState().planOpen })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [set, onExit])

  const idx = ROOMS.findIndex((r) => r.id === roomId)
  const step = (d: number) => goRoom(ROOMS[(idx + d + ROOMS.length) % ROOMS.length].id)
  const refs = assetsForRoom(manifest, roomId)
  const dims = room ? roomDims(room) : null

  return (
    <>
      {/* ficha del ambiente */}
      <AnimatePresence mode="wait">
        {room && !planOpen && !transitioning && (
          <motion.aside
            key={room.id}
            className="pointer-events-none fixed top-24 left-5 z-[35] max-w-[min(88vw,360px)] md:top-28 md:left-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 1, ease, delay: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <p className="eyebrow mb-3">
              {room.floor === 0 ? 'Planta baja' : 'Planta alta'} · {room.mood}
            </p>
            <h2 className="display text-[clamp(38px,4.6vw,62px)] [text-shadow:0_2px_30px_rgba(0,0,0,.4)]">{room.name}</h2>
            {showInfo && (
              <>
                <p className="caption mt-3 [text-shadow:0_1px_14px_rgba(0,0,0,.55)]">{room.description}</p>
                {!room.exterior && dims && (
                  <dl className="mt-5 flex gap-7 text-[11px] tracking-[0.16em] uppercase">
                    <div>
                      <dt className="text-ivory/50">Superficie</dt>
                      <dd className="display mt-1 text-[24px] tracking-normal normal-case">{Math.round(roomArea(room))} m²</dd>
                    </div>
                    <div>
                      <dt className="text-ivory/50">Medidas</dt>
                      <dd className="display mt-1 text-[24px] tracking-normal normal-case">
                        {dims.w.toFixed(1).replace('.', ',')} × {dims.d.toFixed(1).replace('.', ',')}
                      </dd>
                    </div>
                    {room.ceiling && (
                      <div>
                        <dt className="text-ivory/50">Altura</dt>
                        <dd className="display mt-1 text-[24px] tracking-normal normal-case">{room.ceiling.toFixed(1).replace('.', ',')} m</dd>
                      </div>
                    )}
                  </dl>
                )}
                {refs.length > 0 && (
                  <button className="pointer-events-auto mt-5 flex items-center gap-3 text-left" onClick={() => setRefOpen(true)}>
                    <img src={refs[0].poster ?? refs[0].src} alt="" className="h-14 w-20 object-cover" />
                    <span className="eyebrow">Ver render fotorrealista</span>
                  </button>
                )}
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* barra de controles */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex flex-col items-center gap-3 px-4 pb-5 md:pb-7">
        <AnimatePresence>
          {hint && !planOpen && (
            <motion.div
              className="panel flex items-center gap-5 px-5 py-3 text-[11px] tracking-[0.14em] text-ivory/80 uppercase"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="flex items-center gap-2">
                <IconDrag width={15} height={15} /> Arrastrar para mirar
              </span>
              <span className="flex items-center gap-2 max-sm:hidden">
                <IconZoom width={15} height={15} /> Rueda para acercar
              </span>
              <span className="flex items-center gap-2 sm:hidden">
                <IconZoom width={15} height={15} /> Pellizcar para acercar
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="panel pointer-events-auto flex items-center">
          <button className="flex h-12 items-center gap-2 px-3.5 text-ivory/80 hover:text-ivory" onClick={() => step(-1)} aria-label="Ambiente anterior">
            <IconArrow className="rotate-180" width={16} height={16} />
          </button>
          <button
            className="flex h-12 items-center gap-2.5 border-x border-[var(--hair)] px-4 text-[10.5px] tracking-[0.24em] uppercase"
            onClick={() => set({ planOpen: !planOpen, planFloor: room?.floor ?? 0 })}
            aria-pressed={planOpen}
          >
            <IconPlan width={16} height={16} /> Plano
          </button>
          <button className="flex h-12 items-center gap-2 px-3.5 text-ivory/80 hover:text-ivory" onClick={() => step(1)} aria-label="Ambiente siguiente">
            <IconArrow width={16} height={16} />
          </button>
          <span className="h-6 w-px bg-[var(--hair)]" />
          <button
            className={`grid h-12 w-12 place-items-center ${showInfo ? 'text-ivory' : 'text-ivory/45'}`}
            onClick={() => set({ showInfo: !showInfo })}
            aria-pressed={showInfo}
            aria-label="Puntos de información"
            title="Puntos de información"
          >
            <IconInfo width={17} height={17} />
          </button>
          <button
            className={`grid h-12 w-12 place-items-center ${showMeasures ? 'text-ivory' : 'text-ivory/45'}`}
            onClick={() => set({ showMeasures: !showMeasures })}
            aria-pressed={showMeasures}
            aria-label="Mostrar medidas"
            title="Mostrar medidas"
          >
            <IconRuler width={17} height={17} />
          </button>
          <span className="h-6 w-px bg-[var(--hair)]" />
          <button className="flex h-12 items-center gap-2 px-4 text-[10.5px] tracking-[0.24em] uppercase" onClick={onExit}>
            <IconClose width={14} height={14} /> <span className="max-sm:hidden">Salir 360°</span>
          </button>
        </div>
      </div>

      {/* plano interactivo de las dos plantas */}
      <AnimatePresence>
        {planOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-md md:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.6, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            onClick={(e) => e.target === e.currentTarget && set({ planOpen: false })}
          >
            <motion.div
              className="panel-strong relative flex max-h-full w-full max-w-[1180px] flex-col overflow-hidden md:flex-row"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { duration: 0.9, ease } }}
              role="dialog"
              aria-label="Plano interactivo"
            >
              <div className="flex flex-col justify-between gap-6 border-b border-[var(--hair)] p-6 md:w-[320px] md:border-r md:border-b-0 md:p-9">
                <div>
                  <p className="eyebrow mb-3">Plano interactivo</p>
                  <h2 className="display text-[44px]">Elija un ambiente</h2>
                  <p className="caption mt-3">Seleccione una habitación para viajar a ella y explorarla libremente en 360°.</p>
                  <div className="mt-6 flex">
                    {([0, 1] as FloorId[]).map((f) => (
                      <button key={f} className="chip !h-10 !px-4" aria-pressed={planFloor === f} onClick={() => set({ planFloor: f })}>
                        {f === 0 ? 'Planta baja' : 'Planta alta'}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="hidden max-h-[38vh] overflow-y-auto pr-2 md:block">
                  {ROOMS.filter((r) => r.floor === planFloor).map((r, i) => (
                    <li key={r.id}>
                      <button
                        className={`flex w-full items-baseline gap-3 border-b border-[var(--hair)] py-2.5 text-left text-[13px] transition-colors ${r.id === roomId ? 'text-ivory' : 'text-ivory/60 hover:text-ivory'}`}
                        onClick={() => goRoom(r.id)}
                      >
                        <span className="w-5 text-[10px] text-ivory/40 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative min-h-0 flex-1 p-4 md:p-8">
                <PlanSvg floor={planFloor} activeId={roomId} onSelect={goRoom} className="mx-auto h-[min(64vh,720px)] w-full" />
                <p className="absolute right-6 bottom-5 text-[10px] tracking-[0.2em] text-ivory/40 uppercase">Océano ↓</p>
              </div>
              <button className="icon-btn absolute top-4 right-4" onClick={() => set({ planOpen: false })} aria-label="Cerrar plano">
                <IconClose />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* render de referencia (Higgsfield) a pantalla completa */}
      <AnimatePresence>
        {refOpen && refs[0] && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRefOpen(false)}
          >
            {refs[0].kind === 'video' ? (
              <video src={refs[0].src} poster={refs[0].poster} autoPlay muted loop playsInline className="max-h-full max-w-full" />
            ) : (
              <img src={refs[0].src} alt={refs[0].title ?? room?.name} className="max-h-full max-w-full object-contain" />
            )}
            <p className="eyebrow absolute bottom-6 left-1/2 -translate-x-1/2">Referencia fotorrealista generada con Higgsfield AI</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Minimapa: ubicación actual dentro de la propiedad en ambos modos */
export function Minimap() {
  const cam = useStore((s) => s.cam)
  const mode = useStore((s) => s.mode)
  const progress = useStore((s) => s.tourProgress)
  const set = useStore((s) => s.set)
  const floor: FloorId = cam.y > 3.4 ? 1 : 0
  const here = roomAt(cam.x, cam.y, cam.z)
  const visible = mode === 'explore' || progress > 0.04
  return (
    <div
      className={`panel fixed z-[34] hidden w-[200px] transition-opacity duration-700 md:block ${mode === 'explore' ? 'right-10 bottom-7' : 'right-10 bottom-[118px]'} ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <button
        className="block w-full p-3 text-left"
        onClick={() => mode === 'explore' && set({ planOpen: true, planFloor: floor })}
        aria-label="Abrir plano"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow !text-[9px]">{floor === 0 ? 'Planta baja' : 'Planta alta'}</span>
          <span className="text-[9px] tracking-[0.16em] text-ivory/50 uppercase">N ↑</span>
        </div>
        <PlanSvg floor={floor} activeId={here?.id} showLabels={false} compact className="h-[150px] w-full" />
        <p className="mt-1 truncate text-[11px] text-ivory/75">{here?.name ?? 'Exterior'}</p>
      </button>
    </div>
  )
}
