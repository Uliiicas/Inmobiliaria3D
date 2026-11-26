import { Html, Line } from '@react-three/drei'
import { FLOOR_2, ROOM_BY_ID, roomDims } from '../data/rooms'
import { useStore } from '../state/store'

/** Indicadores de paso entre ambientes, puntos de información de materiales y cotas */
export function Markers() {
  const mode = useStore((s) => s.mode)
  const roomId = useStore((s) => s.roomId)
  const showInfo = useStore((s) => s.showInfo)
  const showMeasures = useStore((s) => s.showMeasures)
  const transitioning = useStore((s) => s.transitioning)
  const active = useStore((s) => s.activeHotspot)
  const goRoom = useStore((s) => s.goRoom)
  const set = useStore((s) => s.set)
  if (mode !== 'explore') return null
  const room = ROOM_BY_ID[roomId]
  if (!room) return null
  const hidden = transitioning ? ' is-hidden' : ''
  const q = room.rects[0]
  const fy = (room.floor === 1 ? FLOOR_2 : 0) + 0.03
  const { w, d } = roomDims(room)

  return (
    <group>
      {room.links.map((l) => {
        const to = ROOM_BY_ID[l.to]
        if (!to) return null
        return (
          <Html key={l.to} position={l.p} center zIndexRange={[20, 0]}>
            <button className={`marker-link${hidden}`} onClick={() => goRoom(l.to)} aria-label={`Ir a ${to.name}`}>
              <span className="marker-ring" />
              <span className="marker-label">{to.name}</span>
            </button>
          </Html>
        )
      })}
      {showInfo &&
        room.hotspots?.map((h) => {
          const id = `${room.id}:${h.title}`
          const open = active === id
          return (
            <Html key={id} position={h.p} center zIndexRange={[30, 0]}>
              <div className={`hotspot${open ? ' is-open' : ''}${hidden}`}>
                <button
                  className="hotspot-dot"
                  aria-expanded={open}
                  aria-label={h.title}
                  onClick={() => set({ activeHotspot: open ? null : id })}
                >
                  <span>{h.kind === 'material' ? '◇' : '+'}</span>
                </button>
                {open && (
                  <div className="hotspot-card">
                    <p className="eyebrow">{h.kind === 'material' ? 'Material' : 'Detalle'}</p>
                    <h4>{h.title}</h4>
                    <p>{h.body}</p>
                  </div>
                )}
              </div>
            </Html>
          )
        })}
      {showMeasures && !room.exterior && (
        <group>
          <Line
            points={[
              [q.x0 + 0.15, fy, q.z0 + 0.15],
              [q.x1 - 0.15, fy, q.z0 + 0.15],
              [q.x1 - 0.15, fy, q.z1 - 0.15],
              [q.x0 + 0.15, fy, q.z1 - 0.15],
              [q.x0 + 0.15, fy, q.z0 + 0.15],
            ]}
            color="#e8dcc6"
            lineWidth={1.5}
            dashed
            dashSize={0.25}
            gapSize={0.12}
          />
          <Html position={[(q.x0 + q.x1) / 2, fy + 0.05, q.z1 - 0.3]} center>
            <span className={`measure${hidden}`}>{w.toFixed(2).replace('.', ',')} m</span>
          </Html>
          <Html position={[q.x1 - 0.3, fy + 0.05, (q.z0 + q.z1) / 2]} center>
            <span className={`measure${hidden}`}>{d.toFixed(2).replace('.', ',')} m</span>
          </Html>
          {room.ceiling && (
            <Html position={[q.x0 + 0.4, fy + room.ceiling / 2, q.z0 + 0.4]} center>
              <span className={`measure${hidden}`}>↕ {room.ceiling.toFixed(1).replace('.', ',')} m</span>
            </Html>
          )}
        </group>
      )}
    </group>
  )
}
