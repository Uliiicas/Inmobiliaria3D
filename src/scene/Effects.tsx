import type React from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing'
import { HalfFloatType, MathUtils } from 'three'
import { useStore } from '../state/store'
import { PROFILES } from '../lib/quality'
import { runtime } from '../lib/runtime'

/** Postproducción cinematográfica: oclusión ambiental, bloom de luminarias, profundidad de campo y viñeta */
export function Effects() {
  const quality = useStore((s) => s.quality)
  const mode = useStore((s) => s.mode)
  const reduced = useStore((s) => s.reducedMotion)
  const p = PROFILES[quality]
  const dof = useRef<DepthOfFieldEffect>(null)
  useFrame(() => {
    const e = dof.current
    if (!e) return
    const target = MathUtils.clamp(runtime.focus, 2, 40)
    e.cocMaterial.worldFocusDistance = MathUtils.lerp(e.cocMaterial.worldFocusDistance || target, target, 0.08)
  })
  if (!p.post) return null
  const useDof = p.dof && mode === 'tour' && !reduced
  const list = [
    p.ao ? <N8AO key="ao" halfRes aoRadius={1.2} intensity={2.2} distanceFalloff={0.8} /> : null,
    <Bloom key="bloom" mipmapBlur intensity={0.3} luminanceThreshold={1.5} luminanceSmoothing={0.3} radius={0.7} />,
    useDof ? <DepthOfField key="dof" ref={dof} worldFocusDistance={6} worldFocusRange={24} bokehScale={1.4} /> : null,
    <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />,
    <Vignette key="vig" eskil={false} offset={0.22} darkness={0.55} />,
  ].filter(Boolean) as React.ReactElement[]
  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass={false} frameBufferType={HalfFloatType}>
      {list}
    </EffectComposer>
  )
}
