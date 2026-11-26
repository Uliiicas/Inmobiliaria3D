import { useEffect, useRef, useState } from 'react'
import { formatHour, labelFor, PRESETS, sunDirection } from '../lib/daylight'
import { useStore, type InteriorLights } from '../state/store'
import { runtime } from '../lib/runtime'
import { IconBulb, IconMoon, IconSun } from './Icons'

/**
 * Control de la hora del día (06:00 → 21:00). Modifica la posición real del sol,
 * la intensidad, la temperatura de color, el cielo, las sombras y las luces artificiales.
 */
export function TimeControl() {
  const hour = useStore((s) => s.hour)
  const lights = useStore((s) => s.interiorLights)
  const set = useStore((s) => s.set)
  const [open, setOpen] = useState(false)
  const shown = useDisplayedHour()
  const night = shown >= 19.9

  // arco solar: posición del sol para el pequeño diagrama
  const d = sunDirection(Math.min(shown, 19.75))
  const t = (shown - 6) / 15
  const arcX = 8 + t * 104
  const arcY = 36 - Math.max(0, d.y) * 30

  return (
    <div className="panel pointer-events-auto w-[min(94vw,560px)] select-none">
      {open && (
        <div className="border-b border-[var(--hair)] px-4 pt-3 pb-3">
          <div className="-mx-1 flex flex-wrap gap-0.5">
            {PRESETS.map((p) => (
              <button key={p.h} className="chip" aria-pressed={Math.abs(hour - p.h) < 0.26} onClick={() => set({ hour: p.h })}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-ivory/70">
              <IconBulb width={15} height={15} />
            </span>
            <span className="eyebrow !text-[9.5px] !tracking-[0.22em]">Luces interiores</span>
            <div className="ml-auto flex">
              {(['auto', 'on', 'off'] as InteriorLights[]).map((m) => (
                <button key={m} className="chip !px-2.5" aria-pressed={lights === m} onClick={() => set({ interiorLights: m })}>
                  {m === 'auto' ? 'Auto' : m === 'on' ? 'On' : 'Off'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="text-sand">{night ? <IconMoon width={16} height={16} /> : <IconSun width={16} height={16} />}</span>
        <span className="display w-[62px] text-[26px] leading-none tabular-nums">{formatHour(shown)}</span>
        <span className="eyebrow hidden w-[88px] !text-[9.5px] sm:block">{labelFor(shown)}</span>
        <div className="relative min-w-[120px] flex-1">
          <svg viewBox="0 0 120 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 -top-3 h-4 w-full opacity-60" aria-hidden>
            <circle cx={arcX} cy={arcY} r={night ? 2.2 : 3} fill={night ? '#c8d2f0' : '#f6dcb0'} />
          </svg>
          <input
            className="time-range block"
            type="range"
            min={6}
            max={21}
            step={0.05}
            value={hour}
            aria-label="Hora del día"
            aria-valuetext={formatHour(hour)}
            onChange={(e) => set({ hour: parseFloat(e.target.value) })}
          />
        </div>
        <button
          className="grid h-8 w-8 place-items-center text-ivory/70 hover:text-ivory"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Ambientes de luz"
          title="Ambientes de luz"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** Hora efectivamente renderizada (interpolada), para que el reloj acompañe la transición */
function useDisplayedHour() {
  const [h, setH] = useState(runtime.hour)
  const raf = useRef(0)
  useEffect(() => {
    let last = -1
    const tick = () => {
      const v = Math.round(runtime.hour * 60) / 60
      if (v !== last) {
        last = v
        setH(v)
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  return h
}
