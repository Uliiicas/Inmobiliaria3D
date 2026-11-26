import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector2,
  Vector3,
} from 'three'
import { buildHouse } from './house'
import { applyTextureOverrides, createMaterials, type MaterialSet } from './materials'
import { waterNormals } from './textures'
import type { MatKey } from './builder'
import { Builder } from './builder'
import { useStore } from '../state/store'
import { PROFILES } from '../lib/quality'
import { runtime } from '../lib/runtime'
import { loadHiggsfieldManifest } from '../lib/higgsfield'

const wait = () => new Promise((r) => setTimeout(r, 16))

/** Construye la casa por etapas para no bloquear la interfaz y reportar progreso real */
export function World() {
  const quality = useStore((s) => s.quality)
  const setStore = useStore((s) => s.set)
  const profile = PROFILES[quality]
  // la resolución de texturas se decide una sola vez para no reconstruir la casa en vivo
  const [texSize] = useState(() => profile.texSize)
  const [data, setData] = useState<{ geoms: Map<MatKey, BufferGeometry>; set: MaterialSet } | null>(null)
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    let cancelled = false
    let built: { geoms: Map<MatKey, BufferGeometry>; set: MaterialSet } | null = null
    ;(async () => {
      setStore({ loadStage: 'Componiendo materiales', loadProgress: 0.12 })
      await wait()
      const set = createMaterials(texSize)
      if (cancelled) return set.dispose()
      setStore({ loadStage: 'Levantando la arquitectura', loadProgress: 0.48 })
      await wait()
      const geoms = buildHouse()
      if (cancelled) return
      built = { geoms, set }
      runtime.materials = set
      setStore({ loadStage: 'Calibrando la luz', loadProgress: 0.74 })
      setData(built)
      const manifest = await loadHiggsfieldManifest()
      if (manifest?.textures && !cancelled) applyTextureOverrides(set, manifest.textures)
    })()
    return () => {
      cancelled = true
      if (built) {
        built.geoms.forEach((g) => g.dispose())
        built.set.dispose()
      }
    }
  }, [texSize, setStore])

  // compilar shaders antes de mostrar la escena
  useEffect(() => {
    if (!data) return
    let alive = true
    const run = async () => {
      await wait()
      try {
        await gl.compileAsync(scene, camera)
      } catch {
        /* algunos navegadores no soportan compileAsync */
      }
      if (!alive) return
      setStore({ loadStage: 'Listo', loadProgress: 1 })
      setTimeout(() => alive && setStore({ ready: true }), 350)
    }
    run()
    return () => {
      alive = false
    }
  }, [data, gl, scene, camera, setStore])

  if (!data) return null
  return (
    <group>
      {[...data.geoms.entries()].map(([k, g]) => (
        <mesh
          key={k}
          geometry={g}
          material={data.set.mats[k]}
          castShadow={profile.shadows && !Builder.noShadow.includes(k) && k !== 'grass' && k !== 'sand'}
          receiveShadow={profile.shadows && k !== 'glass' && k !== 'glow' && k !== 'cove' && k !== 'fire'}
          renderOrder={k === 'glass' || k === 'glassFrosted' ? 2 : 0}
        />
      ))}
      <Door set={data.set} />
      <Pool />
      <Ocean />
      {profile.grass > 0 && <Grasses count={profile.grass} />}
    </group>
  )
}

/** Puerta pivotante de roble de 2,0 × 3,2 m. Se abre con el recorrido o en el modo 360° */
function Door({ set }: { set: MaterialSet }) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.y = -runtime.door * Math.PI * 0.46
  })
  return (
    <group position={[1.65, 0, -8.15]} ref={ref}>
      <mesh position={[0.35, 1.6, 0]} material={set.mats.oak} castShadow receiveShadow>
        <boxGeometry args={[1.98, 3.18, 0.1]} />
      </mesh>
      <mesh position={[1.1, 1.2, -0.08]} material={set.mats.bronze}>
        <boxGeometry args={[0.03, 1.2, 0.04]} />
      </mesh>
    </group>
  )
}

let sharedWaterNormals: ReturnType<typeof waterNormals> | null = null
function getWaterNormals() {
  if (!sharedWaterNormals) sharedWaterNormals = waterNormals(256)
  return sharedWaterNormals
}

/** Agua de la piscina: material físico con normales animadas y brillo nocturno */
function Pool() {
  const mat = useMemo(() => {
    const n = getWaterNormals().clone()
    n.repeat.set(3, 0.7)
    n.needsUpdate = true
    return new MeshPhysicalMaterial({
      color: '#5fc1c4',
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
      normalMap: n,
      normalScale: new Vector2(0.25, 0.25),
      envMapIntensity: 1.4,
      emissive: new Color('#2bb3c8'),
      emissiveIntensity: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    })
  }, [])
  useFrame((_, dt) => {
    const n = mat.normalMap!
    n.offset.x += dt * 0.012
    n.offset.y += dt * 0.008
    mat.emissiveIntensity = runtime.artificial * 0.55
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.09, 15.75]} material={mat} receiveShadow>
      <planeGeometry args={[22, 4.5]} />
    </mesh>
  )
}

/** Océano: plano de gran escala con normales animadas que refleja el cielo dinámico */
function Ocean() {
  const mat = useMemo(() => {
    const n = getWaterNormals().clone()
    n.repeat.set(220, 220)
    n.needsUpdate = true
    const m = new MeshStandardMaterial({
      color: '#0a2a36',
      roughness: 0.16,
      metalness: 0,
      normalMap: n,
      envMapIntensity: 1.2,
    })
    m.normalScale.set(0.6, 0.6)
    return m
  }, [])
  const geo = useMemo(() => new PlaneGeometry(6000, 6000, 1, 1), [])
  useFrame((_, dt) => {
    const n = mat.normalMap!
    n.offset.x += dt * 0.004
    n.offset.y -= dt * 0.006
    mat.envMapIntensity = 0.5 + (1 - runtime.artificial) * 0.5
  })
  return <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, -9, 3000]} material={mat} />
}

/** Gramíneas ornamentales instanciadas que se mecen con la brisa */
function Grasses({ count }: { count: number }) {
  const ref = useRef<InstancedMesh>(null)
  const { geo, mat, base } = useMemo(() => {
    const geo = new ConeGeometry(0.06, 1, 4, 1, true)
    geo.translate(0, 0.5, 0)
    const mat = new MeshStandardMaterial({ color: '#a49a72', roughness: 0.9 })
    const base: { p: Vector3; s: number; r: number }[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const zones: [number, number, number, number, number][] = [
      // x0, x1, z0, z1, y
      [-13.8, -4.8, -23.6, -8.6, -0.5],
      [8.8, 13.8, -23.6, -8.6, -0.5],
      [-24, -15, -16, 18, -0.6],
      [15, 24, -16, 18, -0.6],
    ]
    for (let i = 0; i < count; i++) {
      const z = zones[i % zones.length]
      const x = z[0] + rnd() * (z[1] - z[0])
      const zz = z[2] + rnd() * (z[3] - z[2])
      // los bloques de gramíneas se agrupan como en un jardín diseñado
      if (Math.sin(x * 0.9) * Math.cos(zz * 0.7) < -0.2) continue
      base.push({ p: new Vector3(x, z[4], zz), s: 0.5 + rnd() * 0.7, r: rnd() * Math.PI })
    }
    return { geo, mat, base }
  }, [count])
  const tmp = useMemo(() => new Object3D(), [])
  const m4 = useMemo(() => new Matrix4(), [])
  const q = useMemo(() => new Quaternion(), [])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    base.forEach((b, i) => {
      tmp.position.copy(b.p)
      tmp.rotation.set(0, b.r, 0)
      tmp.scale.set(b.s, b.s * 1.4, b.s)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [base, tmp])
  const frame = useRef(0)
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh || useStore.getState().reducedMotion) return
    // actualizar el balanceo a 30 fps es suficiente
    if (frame.current++ % 2) return
    const t = clock.elapsedTime
    base.forEach((b, i) => {
      const sway = Math.sin(t * 1.3 + b.p.x * 0.6 + b.p.z * 0.4) * 0.12
      q.setFromAxisAngle(AXIS_Z, sway)
      tmp.quaternion.setFromAxisAngle(AXIS_Y, b.r).premultiply(q)
      tmp.position.copy(b.p)
      tmp.scale.set(b.s, b.s * 1.4, b.s)
      m4.compose(tmp.position, tmp.quaternion, tmp.scale)
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, base.length]} castShadow={false} receiveShadow frustumCulled={false} />
}

const AXIS_Y = new Vector3(0, 1, 0)
const AXIS_Z = new Vector3(0, 0, 1)

