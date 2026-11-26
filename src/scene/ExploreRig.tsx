import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import gsap from 'gsap'
import { ROOM_BY_ID } from '../data/rooms'
import { useStore } from '../state/store'
import { runtime } from '../lib/runtime'

export const veil = { value: 0 }

/**
 * Exploración libre 360°: la cámara se ubica a la altura de los ojos dentro del ambiente
 * y el usuario mira en todas las direcciones (techo, suelo, paredes) arrastrando,
 * acerca o aleja con la rueda o el gesto de pinza, y cambia de ambiente desde el plano
 * o los indicadores.
 */
export function ExploreRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const el = useThree((s) => s.gl.domElement)
  const look = useRef({ yaw: 0, pitch: 0, vy: 0, vp: 0, fov: 64, fovT: 64 })
  const pos = useRef(new Vector3())
  const anim = useRef<gsap.core.Timeline | null>(null)
  const lastCamWrite = useRef(0)
  const mode = useStore((s) => s.mode)
  const roomId = useStore((s) => s.roomId)
  const entered = useRef(false)

  // transición cinematográfica hacia el ambiente elegido
  useEffect(() => {
    if (mode !== 'explore') {
      entered.current = false
      return
    }
    const room = ROOM_BY_ID[roomId]
    if (!room) return
    const st = useStore.getState()
    const to = new Vector3(...room.view)
    const from = entered.current ? pos.current.clone() : camera.position.clone()
    const fromYaw = entered.current
      ? look.current.yaw
      : Math.atan2(...(() => {
          const d = new Vector3()
          camera.getWorldDirection(d)
          return [d.x, d.z] as [number, number]
        })())
    if (!entered.current) {
      const d = new Vector3()
      camera.getWorldDirection(d)
      look.current.pitch = Math.asin(MathUtils.clamp(d.y, -1, 1))
      look.current.fov = look.current.fovT = MathUtils.clamp(camera.fov, 40, 75)
    }
    entered.current = true
    let toYaw = room.yaw
    // girar por el camino más corto
    while (toYaw - fromYaw > Math.PI) toYaw -= Math.PI * 2
    while (toYaw - fromYaw < -Math.PI) toYaw += Math.PI * 2

    anim.current?.kill()
    const far = from.distanceTo(to) > 2.5
    const proxy = { t: 0 }
    useStore.setState({ transitioning: true })
    const back = new Vector3(Math.sin(toYaw), 0, Math.cos(toYaw)).multiplyScalar(-1.1)
    const arrivalStart = to.clone().add(back)
    const tl = gsap.timeline({
      onComplete: () => useStore.setState({ transitioning: false }),
    })
    const dur = st.reducedMotion ? 0.01 : 1
    if (far) {
      // fundido a velo, cambio de punto de vista y llegada con un leve travelling
      tl.to(veil, { value: 1, duration: 0.5 * dur, ease: 'power2.in' })
      tl.add(() => {
        pos.current.copy(arrivalStart)
        look.current.yaw = toYaw
        look.current.pitch = -0.04
        look.current.vy = look.current.vp = 0
      })
      tl.to(veil, { value: 0, duration: 0.8 * dur, ease: 'power2.out' })
      tl.fromTo(
        proxy,
        { t: 0 },
        {
          t: 1,
          duration: 1.6 * dur,
          ease: 'power3.out',
          onUpdate: () => pos.current.lerpVectors(arrivalStart, to, proxy.t),
        },
        '<',
      )
    } else {
      const p0 = from.clone()
      const y0 = fromYaw
      const pt0 = look.current.pitch
      tl.to(proxy, {
        t: 1,
        duration: 1.4 * dur,
        ease: 'power2.inOut',
        onUpdate: () => {
          pos.current.lerpVectors(p0, to, proxy.t)
          look.current.yaw = MathUtils.lerp(y0, toYaw, proxy.t)
          look.current.pitch = MathUtils.lerp(pt0, -0.04, proxy.t)
        },
      })
    }
    anim.current = tl
    return () => {
      tl.kill()
    }
  }, [mode, roomId, camera])

  // controles: arrastrar para mirar, rueda / pinza para acercar
  useEffect(() => {
    if (mode !== 'explore') return
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture(e.pointerId)
      look.current.vy = look.current.vp = 0
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      if (pointers.size === 2) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) look.current.fovT = MathUtils.clamp(look.current.fovT * (pinch / d), 28, 90)
        pinch = d
        return
      }
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const s = (look.current.fov / 64) * (e.pointerType === 'touch' ? 0.0065 : 0.0042)
      look.current.vy = dx * s
      look.current.vp = dy * s
      look.current.yaw += dx * s
      look.current.pitch = MathUtils.clamp(look.current.pitch + dy * s, -1.45, 1.45)
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
      el.style.cursor = 'grab'
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      look.current.fovT = MathUtils.clamp(look.current.fovT + e.deltaY * 0.035, 28, 90)
    }
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft') look.current.vy = 0.045
      if (e.key === 'ArrowRight') look.current.vy = -0.045
      if (e.key === 'ArrowUp') look.current.vp = 0.03
      if (e.key === 'ArrowDown') look.current.vp = -0.03
      if (e.key === '+' || e.key === '=') look.current.fovT = Math.max(28, look.current.fovT - 6)
      if (e.key === '-') look.current.fovT = Math.min(90, look.current.fovT + 6)
    }
    el.style.cursor = 'grab'
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', key)
    return () => {
      el.style.cursor = ''
      el.style.touchAction = ''
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', key)
    }
  }, [mode, el])

  useFrame((state, dt) => {
    if (useStore.getState().mode !== 'explore') return
    const L = look.current
    const dragging = false
    // inercia suave al soltar
    if (!dragging) {
      const damp = Math.exp(-dt * 5)
      L.yaw += L.vy * (1 - damp) * 2
      L.pitch = MathUtils.clamp(L.pitch + L.vp * (1 - damp) * 2, -1.45, 1.45)
      L.vy *= damp
      L.vp *= damp
    }
    L.fov = MathUtils.lerp(L.fov, L.fovT, 1 - Math.exp(-dt * 8))
    camera.position.copy(pos.current)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(L.pitch, L.yaw + Math.PI, 0)
    if (Math.abs(camera.fov - L.fov) > 0.01) {
      camera.fov = L.fov
      camera.updateProjectionMatrix()
    }
    runtime.door = MathUtils.lerp(runtime.door, 1, 1 - Math.exp(-dt * 2))
    runtime.focus = 4
    if (state.clock.elapsedTime - lastCamWrite.current > 0.1) {
      lastCamWrite.current = state.clock.elapsedTime
      const p = pos.current
      useStore.setState({ cam: { x: p.x, y: p.y, z: p.z, yaw: L.yaw } })
    }
  })
  return null
}
