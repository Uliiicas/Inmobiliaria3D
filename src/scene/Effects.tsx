import type React from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type BloomEffect, type DepthOfFieldEffect } from 'postprocessing'
import { HalfFloatType, MathUtils } from 'three'
import { useStore } from '../state/store'
import { PROFILES } from '../lib/quality'
import { runtime } from '../lib/runtime'
import { CAPTURE } from '../lib/capture'

const BLOOM = 0.3

/** Postproducción cinematográfica: oclusión ambiental, bloom de luminarias, profundidad de campo y viñeta */
export function Effects() {
  const quality = useStore((s) => s.quality)
  const mode = useStore((s) => s.mode)
  const reduced = useStore((s) => s.reducedMotion)
  // la casa horneada ya trae su oclusión: el AO en pantalla sólo suma contacto
  const baked = useStore((s) => s.baked)
  const p = PROFILES[quality]
  const dof = useRef<DepthOfFieldEffect>(null)
  const bloom = useRef<BloomEffect>(null)
  useFrame(() => {
    // el bloom se suma antes de la exposición: al abrirla en interiores se compensa para no velar la imagen
    if (bloom.current) bloom.current.intensity = BLOOM / runtime.exposureBoost
    const e = dof.current
    if (!e) return
    const target = MathUtils.clamp(runtime.focus, 2, 40)
    e.cocMaterial.worldFocusDistance = CAPTURE ? target : MathUtils.lerp(e.cocMaterial.worldFocusDistance || target, target, 0.08)
  })
  if (!p.post) return null
  const useDof = p.dof && mode === 'tour' && !reduced
  const list = [
    p.ao ? <N8AO key="ao" halfRes aoRadius={baked ? 0.6 : 1.2} intensity={baked ? 1.0 : 2.2} distanceFalloff={0.8} /> : null,
    <Bloom key="bloom" ref={bloom} mipmapBlur intensity={BLOOM} luminanceThreshold={1.5} luminanceSmoothing={0.3} radius={0.7} />,
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
