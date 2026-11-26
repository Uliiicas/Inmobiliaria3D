import { Suspense, lazy } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { ACESFilmicToneMapping, NoToneMapping, PCFSoftShadowMap, VSMShadowMap } from 'three'
import { useStore, type Quality } from '../state/store'
import { PROFILES } from '../lib/quality'
import { World } from './World'
import { Atmosphere } from './Atmosphere'
import { TourRig } from './TourRig'
import { ExploreRig } from './ExploreRig'
import { Markers } from './Markers'
import { runtime } from '../lib/runtime'
import { CAPTURE } from '../lib/capture'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { Material, Mesh } from 'three'

const Effects = lazy(() => import('./Effects').then((m) => ({ default: m.Effects })))

const DOWN: Record<Quality, Quality> = { high: 'medium', medium: 'low', low: 'low' }

/** Al activar o desactivar sombras en vivo los materiales deben recompilarse */
function ShadowSync() {
  const quality = useStore((s) => s.quality)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.traverse((o) => {
      const m = (o as Mesh).material as Material | Material[] | undefined
      if (!m) return
      ;(Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true))
    })
  }, [quality, scene])
  return null
}

function Clock() {
  useFrame((_, dt) => {
    runtime.time += dt
  })
  return null
}

export default function Experience() {
  const quality = useStore((s) => s.quality)
  const locked = useStore((s) => s.qualityLocked)
  const set = useStore((s) => s.set)
  const p = PROFILES[quality]
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={CAPTURE ? 1 : p.dpr}
      shadows={p.shadows ? { type: quality === 'high' ? PCFSoftShadowMap : VSMShadowMap } : false}
      camera={{ fov: 38, near: 0.08, far: 6000, position: [17, 7.5, -42] }}
      gl={{
        antialias: p.antialias,
        powerPreference: 'high-performance',
        toneMapping: p.post ? NoToneMapping : ACESFilmicToneMapping,
        stencil: false,
      }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = p.post ? NoToneMapping : ACESFilmicToneMapping
        if (import.meta.env.DEV) (window as unknown as { __three: unknown }).__three = { gl, scene, runtime }
      }}
    >
      {!CAPTURE && (
        <PerformanceMonitor
          flipflops={2}
          onDecline={() => {
            // se baja un escalón como máximo una vez por sesión salvo elección manual
            if (!locked && quality === 'high') set({ quality: DOWN[quality] })
          }}
        />
      )}
      {!CAPTURE && <AdaptiveDpr pixelated={false} />}
      <Clock />
      <ShadowSync />
      <Atmosphere />
      <World />
      <TourRig />
      <ExploreRig />
      <Markers />
      <Suspense fallback={null}>
        <Effects />
      </Suspense>
    </Canvas>
  )
}
