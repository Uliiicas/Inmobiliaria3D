import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Mesh,
  PMREMGenerator,
  PointLight,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector3,
  type Points,
} from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { computeDaylight, type DaylightState } from '../lib/daylight'
import { useStore } from '../state/store'
import { PROFILES } from '../lib/quality'
import { runtime } from '../lib/runtime'
import { CAPTURE } from '../lib/capture'
import { LAMPS } from '../data/lighting'
import { ROOF } from '../data/rooms'
import { bakedUniforms } from './baked'


const NIGHT_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }
`
const NIGHT_FRAG = /* glsl */ `
uniform vec3 top; uniform vec3 horizon; uniform float opacity;
varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 c = mix(horizon, top, pow(h, 0.45));
  gl_FragColor = vec4(c, opacity);
}
`

/** Ganancias del atlas de luz horneado (calibradas contra la iluminación en tiempo real) */
const BAKE_GAIN = { sky: 4.5, sun: Math.PI * 1.6, lamps: Math.PI }
const LAMP_TINT = new Color('#ffc58e')
/** apertura extra dentro de la casa: más de día (sólo luz indirecta) que de noche (luminarias) */
const INTERIOR_EXPOSURE = { day: 6.5, night: 2.3 }
const SKY_DESAT = 0.75
const SKY_NEUTRAL = new Color()

export function Atmosphere() {
  const { gl, scene, camera } = useThree()
  const interior = useRef(0)
  const baked = useStore((s) => s.baked)
  const quality = useStore((s) => s.quality)
  const profile = PROFILES[quality]
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const stars = useRef<Points>(null)
  const lamps = useRef<(PointLight | null)[]>([])
  const state = useRef<DaylightState>(computeDaylight(runtime.hour))

  // cielo físico (Preetham) visible + copia para el mapa de entorno
  const { sky, envScene, envSky, night, envNight } = useMemo(() => {
    const sky = new Sky()
    sky.scale.setScalar(4500)
    const envScene = new Scene()
    const envSky = new Sky()
    envSky.scale.setScalar(1000)
    envScene.add(envSky)
    const mk = () =>
      new Mesh(
        new SphereGeometry(1, 32, 16),
        new ShaderMaterial({
          vertexShader: NIGHT_VERT,
          fragmentShader: NIGHT_FRAG,
          side: BackSide,
          transparent: true,
          depthWrite: false,
          uniforms: { top: { value: new Color('#070b18') }, horizon: { value: new Color('#1c2440') }, opacity: { value: 0 } },
        }),
      )
    const night = mk()
    night.scale.setScalar(4000)
    night.renderOrder = -1
    const envNight = mk()
    envNight.scale.setScalar(900)
    envScene.add(envNight)
    return { sky, envScene, envSky, night, envNight }
  }, [])

  const pmrem = useMemo(() => new PMREMGenerator(gl), [gl])
  const envTex = useRef<Texture | null>(null)
  const lastEnvHour = useRef(-10)
  const lastArtificial = useRef(-1)

  useEffect(() => {
    scene.fog = new Fog('#dcd6cc', 180, 2600)
    return () => {
      scene.fog = null
      envTex.current?.dispose()
      pmrem.dispose()
    }
  }, [scene, pmrem])

  const sunPos = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(2, 0, 2), [])

  useFrame((_, dt) => {
    const st = useStore.getState()
    // la hora mostrada persigue la elegida: transiciones graduales y continuas
    const k = st.reducedMotion || CAPTURE ? 1 : 1 - Math.exp(-dt * 3.2)
    runtime.hour = MathUtils.lerp(runtime.hour, st.hour, k)
    if (Math.abs(runtime.hour - st.hour) < 0.002) runtime.hour = st.hour
    const d = computeDaylight(runtime.hour, state.current)

    // cielo
    for (const s of [sky, envSky]) {
      const u = (s.material as ShaderMaterial).uniforms
      u.sunPosition.value.copy(d.sunDir)
      u.turbidity.value = d.turbidity
      u.rayleigh.value = d.rayleigh
      u.mieCoefficient.value = d.mie
      u.mieDirectionalG.value = d.mieG
    }
    const nightOpacity = Math.max(MathUtils.smoothstep(runtime.hour, 19.55, 20.7) * 0.97, (1 - MathUtils.smoothstep(runtime.hour, 6.0, 7.2)) * 0.72)
    const dawn = runtime.hour < 12
    for (const n of [night, envNight]) {
      const u = (n.material as ShaderMaterial).uniforms
      u.opacity.value = nightOpacity
      u.top.value.set(dawn ? '#33476f' : '#070b18')
      u.horizon.value.set(dawn ? '#d6a58f' : '#1c2440')
    }

    // sol / luna
    const L = sun.current
    if (L) {
      sunPos.copy(d.keyDir).multiplyScalar(70).add(target)
      L.position.copy(sunPos)
      L.target.position.copy(target)
      L.target.updateMatrixWorld()
      L.color.copy(d.keyColor)
      L.intensity = d.keyIntensity
    }
    if (hemi.current) {
      hemi.current.color.copy(d.hemiSky)
      hemi.current.groundColor.copy(d.hemiGround)
      hemi.current.intensity = d.hemiIntensity * 0.8
    }
    const fog = scene.fog as Fog | null
    if (fog) fog.color.copy(d.fog)
    // Como un fotógrafo de interiores: dentro de la casa horneada se abre la exposición
    // (los ventanales quedan luminosos y el interior se lee con detalle)
    const c = camera.position
    const inside = runtime.baked && c.x > -14.2 && c.x < 14.2 && c.z > -8.2 && c.z < 9.6 && c.y < ROOF ? 1 : 0
    interior.current = MathUtils.lerp(interior.current, inside, st.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.5))
    const ie = MathUtils.lerp(INTERIOR_EXPOSURE.day, INTERIOR_EXPOSURE.night, MathUtils.clamp(runtime.artificial, 0, 1))
    runtime.exposureBoost = 1 + interior.current * (ie - 1)
    gl.toneMappingExposure = d.exposure * runtime.exposureBoost

    // iluminación artificial
    const mode = st.interiorLights
    const art = mode === 'on' ? Math.max(0.9, d.artificial) : mode === 'off' ? 0 : d.artificial
    runtime.artificial = MathUtils.lerp(runtime.artificial, art, st.reducedMotion ? 1 : 1 - Math.exp(-dt * 4))
    const a = runtime.artificial
    lamps.current.forEach((l, i) => {
      if (!l) return
      const base = LAMPS[i][4]
      const flicker = i === 10 ? 0.85 + Math.sin(runtime.time * 11) * 0.08 + Math.sin(runtime.time * 23) * 0.06 : 1
      l.intensity = base * (i === 10 ? Math.max(a, 0.35) : a) * flicker
    })
    // casa horneada: la luz indirecta del atlas se tiñe con el cielo, el sol y las luminarias de esta hora
    if (runtime.baked) {
      const u = bakedUniforms
      // el cielo que entra por los ventanales se lee casi neutro (balance de blancos de interior)
      const sky = u.uSkyIrr.value.copy(d.hemiSky)
      const lum = sky.r * 0.2126 + sky.g * 0.7152 + sky.b * 0.0722
      sky.lerp(SKY_NEUTRAL.setScalar(lum), SKY_DESAT).multiplyScalar(d.hemiIntensity * BAKE_GAIN.sky)
      u.uSunIrr.value.copy(d.keyColor).multiplyScalar(d.keyIntensity * BAKE_GAIN.sun)
      u.uLampIrr.value.copy(LAMP_TINT).multiplyScalar(a * BAKE_GAIN.lamps)
      u.uSunGate.value = PROFILES[st.quality].shadows ? 0 : 1
    }
    const m = runtime.materials
    if (m) {
      m.emissive.glow.emissiveIntensity = 0.15 + a * 2.6
      m.emissive.cove.emissiveIntensity = a * 3.2
      m.emissive.fire.emissiveIntensity = 2.2 + Math.sin(runtime.time * 9) * 0.4
      m.glass.opacity = 0.12 + (1 - a) * 0.04
    }
    if (stars.current) {
      const sm = stars.current.material as ShaderMaterial & { opacity: number }
      sm.opacity = d.stars
      stars.current.visible = d.stars > 0.01
    }

    // regenerar el mapa de entorno sólo cuando la luz cambió lo suficiente
    if (Math.abs(lastEnvHour.current - runtime.hour) > 0.12 || Math.abs(lastArtificial.current - a) > 0.15) {
      lastEnvHour.current = runtime.hour
      lastArtificial.current = a
      const rt = pmrem.fromScene(envScene, 0.02, 1, 2000)
      envTex.current?.dispose()
      envTex.current = rt.texture
      scene.environment = rt.texture
      scene.environmentIntensity = d.envIntensity
    }
  })

  // con la casa horneada las luminarias ya están en el atlas: sólo queda la del fogón (parpadea)
  const n = baked ? 0 : Math.min(profile.pointLights, LAMPS.length)
  const s = profile.shadowMap
  return (
    <>
      <primitive object={sky} />
      <primitive object={night} />
      <Stars ref={stars} radius={1200} depth={200} count={3000} factor={3.2} saturation={0} fade speed={0.3} />
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={profile.shadows}
        shadow-mapSize={[s, s]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={180}
      />
      {LAMPS.slice(0, n).map(([x, y, z, c, , dist], i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lamps.current[i] = el
          }}
          position={[x, y, z]}
          color={c}
          intensity={0}
          distance={dist}
          decay={1.6}
        />
      ))}
    </>
  )
}
