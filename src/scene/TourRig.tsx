import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { SHOTS } from '../data/tour'
import { useStore } from '../state/store'
import { runtime } from '../lib/runtime'

/**
 * Cámara del recorrido cinematográfico: posición y punto de mira viajan sobre dos curvas
 * Catmull-Rom sincronizadas. El progreso del scroll se suaviza con amortiguación crítica
 * para que la cámara nunca salte, incluso con ruedas de mouse "a saltos".
 */
export function TourRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const { posCurve, tgtCurve, fovs } = useMemo(() => {
    const posCurve = new CatmullRomCurve3(
      SHOTS.map((s) => new Vector3(...s.p)),
      false,
      'centripetal',
    )
    const tgtCurve = new CatmullRomCurve3(
      SHOTS.map((s) => new Vector3(...s.t)),
      false,
      'centripetal',
    )
    return { posCurve, tgtCurve, fovs: SHOTS.map((s) => s.fov ?? 55) }
  }, [])
  const pos = useMemo(() => new Vector3(), [])
  const tgt = useMemo(() => new Vector3(), [])
  const look = useMemo(() => new Vector3(), [])
  const lookSmoothed = useRef<Vector3 | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const lastCamWrite = useRef(0)

  useFrame((state, dt) => {
    const st = useStore.getState()
    if (st.mode !== 'tour' || st.transitioning) return
    const target = st.tourProgress
    // amortiguación exponencial independiente del frame rate
    const k = st.reducedMotion ? 1 - Math.exp(-dt * 12) : 1 - Math.exp(-dt * 2.6)
    runtime.tour = MathUtils.lerp(runtime.tour, target, k)
    if (Math.abs(runtime.tour - target) < 1e-5) runtime.tour = target
    const p = MathUtils.clamp(runtime.tour, 0, 1)

    posCurve.getPoint(p, pos)
    tgtCurve.getPoint(p, tgt)

    // parallax sutil con el puntero y respiración de cámara en mano
    if (!st.reducedMotion) {
      pointer.current.x = MathUtils.lerp(pointer.current.x, state.pointer.x, 0.04)
      pointer.current.y = MathUtils.lerp(pointer.current.y, state.pointer.y, 0.04)
      const t = state.clock.elapsedTime
      pos.y += Math.sin(t * 0.7) * 0.012
      pos.x += Math.sin(t * 0.43) * 0.01
      tgt.x += pointer.current.x * 0.35
      tgt.y += pointer.current.y * 0.22
    }
    if (!lookSmoothed.current) lookSmoothed.current = tgt.clone()
    lookSmoothed.current.lerp(tgt, 1 - Math.exp(-dt * 8))
    camera.position.copy(pos)
    look.copy(lookSmoothed.current)
    camera.lookAt(look)

    // FOV interpolado por segmento
    const f = p * (fovs.length - 1)
    const i = Math.min(fovs.length - 2, Math.floor(f))
    const fov = MathUtils.lerp(fovs[i], fovs[i + 1], MathUtils.smoothstep(f - i, 0, 1))
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    runtime.focus = pos.distanceTo(tgt)

    // la puerta se abre al aproximarse (fotogramas 2.6 → 3.6) y se cierra detrás
    const door = MathUtils.smoothstep(f, 2.5, 3.5) * (1 - MathUtils.smoothstep(f, 4.6, 5.6))
    runtime.door = door

    if (state.clock.elapsedTime - lastCamWrite.current > 0.1) {
      lastCamWrite.current = state.clock.elapsedTime
      const dir = tgt.clone().sub(pos)
      useStore.setState({ cam: { x: pos.x, y: pos.y, z: pos.z, yaw: Math.atan2(dir.x, dir.z) } })
    }
  })
  return null
}
