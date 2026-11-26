import { ROOMS, type FloorId } from '../data/rooms'
import { useStore } from '../state/store'

interface Props {
  floor: FloorId
  activeId?: string
  onSelect?: (id: string) => void
  showLabels?: boolean
  showCamera?: boolean
  className?: string
  compact?: boolean
}

/**
 * Plano arquitectónico generado a partir de los mismos datos que la geometría 3D.
 * Coordenadas del SVG = metros del mundo (X → derecha, Z → abajo, el océano queda abajo).
 */
export function PlanSvg({ floor, activeId, onSelect, showLabels = true, showCamera = true, className, compact }: Props) {
  const cam = useStore((s) => s.cam)
  const rooms = ROOMS.filter((r) => r.floor === floor && !(compact && r.id === 'acceso'))
  const vb = compact ? '-15.5 -9.5 31 30.5' : '-16 -17.5 32 38'
  const camFloor: FloorId = cam.y > 3.4 ? 1 : 0
  return (
    <svg viewBox={vb} className={className} role="img" aria-label={`Plano ${floor === 0 ? 'planta baja' : 'planta alta'}`}>
      {/* océano y borde del acantilado */}
      <rect x={-17} y={20.2} width={34} height={20} fill="rgba(120,150,160,0.12)" />
      <path d="M-17 20.2H17" stroke="rgba(233,225,212,0.35)" strokeWidth={0.05} />
      {floor === 0 && (
        <>
          <rect x={-11} y={13.5} width={22} height={4.5} fill="rgba(140,190,190,0.22)" stroke="rgba(233,225,212,0.35)" strokeWidth={0.05} />
          {!compact && <rect x={-4.5} y={-17} width={13} height={8.7} fill="rgba(140,170,180,0.1)" />}
        </>
      )}
      {/* huella de la casa */}
      <rect x={-14.3} y={-8.3} width={28.6} height={floor === 0 ? 16.45 : 17.95} fill="none" stroke="rgba(233,225,212,0.85)" strokeWidth={0.22} />
      {floor === 1 && <rect x={-2} y={0} width={10} height={8} fill="rgba(233,225,212,0.03)" stroke="rgba(233,225,212,0.25)" strokeWidth={0.05} strokeDasharray="0.3 0.2" />}
      {rooms.map((r) => (
        <g key={r.id}>
          {r.rects.map((q, i) => (
            <rect
              key={i}
              x={q.x0}
              y={q.z0}
              width={q.x1 - q.x0}
              height={q.z1 - q.z0}
              className={`plan-room${r.id === activeId ? ' is-active' : ''}${r.exterior ? ' is-ext' : ''}`}
              onClick={onSelect ? () => onSelect(r.id) : undefined}
              tabIndex={onSelect && i === 0 ? 0 : undefined}
              role={onSelect ? 'button' : undefined}
              aria-label={onSelect && i === 0 ? r.name : undefined}
              onKeyDown={(e) => {
                if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onSelect(r.id)
                }
              }}
            >
              <title>{r.name}</title>
            </rect>
          ))}
          {showLabels && (
            <text
              x={(r.rects[0].x0 + r.rects[0].x1) / 2}
              y={(r.rects[0].z0 + r.rects[0].z1) / 2}
              fontSize={r.rects[0].x1 - r.rects[0].x0 < 4.5 ? 0.42 : 0.55}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(244,239,231,0.85)"
              style={{ pointerEvents: 'none', fontFamily: 'Manrope Variable, sans-serif', letterSpacing: '0.06em' }}
            >
              {labelLines(r.name).map((l, i, a) => (
                <tspan key={i} x={(r.rects[0].x0 + r.rects[0].x1) / 2} dy={i === 0 ? `${-(a.length - 1) * 0.55}em` : '1.1em'}>
                  {l}
                </tspan>
              ))}
            </text>
          )}
        </g>
      ))}
      {/* escalera */}
      {Array.from({ length: 17 }).map((_, i) => (
        <line key={i} x1={-1.9} x2={-0.3} y1={-2.25 - i * 0.27} y2={-2.25 - i * 0.27} stroke="rgba(233,225,212,0.4)" strokeWidth={0.04} />
      ))}
      {showCamera && camFloor === floor && (
        <g transform={`translate(${cam.x} ${cam.z}) rotate(${(-cam.yaw * 180) / Math.PI})`}>
          <path d="M0 0 L-1.6 3.2 A3.6 3.6 0 0 0 1.6 3.2 Z" fill="rgba(244,239,231,0.22)" />
          <circle r={0.38} fill="#f4efe7" />
          <circle r={0.75} fill="none" stroke="#f4efe7" strokeWidth={0.06} opacity={0.6} />
        </g>
      )}
    </svg>
  )
}

function labelLines(name: string) {
  const words = name.split(' ')
  if (name.length < 14 || words.length < 2) return [name]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}
