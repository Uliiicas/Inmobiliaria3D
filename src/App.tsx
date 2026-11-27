import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStore } from './state/store'
import { detectQuality, hasWebGL } from './lib/quality'
import { roomAt, ROOM_BY_ID } from './data/rooms'
import { SHOTS } from './data/tour'
import { Loader, TopBar, Veil } from './ui/Chrome'
import { Captions, Finale, Hero, ProgressRail, scrollToProgress } from './ui/TourOverlay'
import { TimeControl } from './ui/TimeControl'
import { ExploreOverlay, Minimap } from './ui/ExploreOverlay'
import { Contact } from './ui/Contact'
import { Fallback } from './ui/Fallback'
import { veil } from './scene/ExploreRig'

gsap.registerPlugin(ScrollTrigger)

const Experience = lazy(() => import('./scene/Experience'))

function useIsMobile() {
  const [m, setM] = useState(() => matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const q = matchMedia('(max-width: 767px)')
    const on = () => setM(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return m
}

export default function App() {
  const [webgl] = useState(hasWebGL)
  const mode = useStore((s) => s.mode)
  const ready = useStore((s) => s.ready)
  const heroVisible = useStore((s) => s.tourProgress < 0.012)
  const set = useStore((s) => s.set)
  const spacer = useRef<HTMLDivElement>(null)
  const mobile = useIsMobile()

  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => set({ reducedMotion: q.matches })
    apply()
    q.addEventListener('change', apply)
    set({ quality: detectQuality(), qualityLocked: new URLSearchParams(location.search).has('quality') })
    const roomParam = new URLSearchParams(location.search).get('room')
    if (roomParam && ROOM_BY_ID[roomParam]) set({ mode: 'explore', roomId: roomParam, planOpen: false })
    const h = parseFloat(new URLSearchParams(location.search).get('hour') ?? '')
    if (h >= 6 && h <= 21) set({ hour: h })
    return () => q.removeEventListener('change', apply)
  }, [set])

  // el scroll del documento conduce la cámara del recorrido
  useEffect(() => {
    if (!spacer.current) return
    const st = ScrollTrigger.create({
      trigger: spacer.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (useStore.getState().mode === 'tour') useStore.setState({ tourProgress: self.progress })
      },
    })
    return () => st.kill()
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-locked', mode === 'explore' || !ready)
  }, [mode, ready])

  const enterExplore = useCallback(() => {
    const { cam } = useStore.getState()
    const here = roomAt(cam.x, cam.y, cam.z)
    const start = here && here.id !== 'acceso' ? here.id : 'living'
    set({ mode: 'explore', roomId: start, planOpen: true, planFloor: ROOM_BY_ID[start].floor, activeHotspot: null })
  }, [set])

  const exitExplore = useCallback(() => {
    const reduced = useStore.getState().reducedMotion
    gsap.to(veil, {
      value: 1,
      duration: reduced ? 0.01 : 0.45,
      onComplete: () => {
        set({ mode: 'tour', planOpen: false, transitioning: false, activeHotspot: null })
        gsap.to(veil, { value: 0, duration: reduced ? 0.01 : 0.9, delay: 0.1 })
      },
    })
  }, [set])

  const goHome = useCallback(() => {
    if (useStore.getState().mode === 'explore') exitExplore()
    scrollToProgress(0)
  }, [exitExplore])

  if (!webgl) {
    return (
      <>
        <Fallback />
        <Contact />
      </>
    )
  }

  return (
    <>
      <Suspense fallback={null}>
        <Experience />
      </Suspense>

      {/* espacio de scroll que conduce el recorrido: ~0,55 pantallas por toma */}
      <div ref={spacer} style={{ height: `${SHOTS.length * 58}vh` }} aria-hidden />

      <Veil />
      <TopBar onExplore={enterExplore} onHome={goHome} />
      {mode === 'tour' ? (
        <>
          <Hero onExplore={enterExplore} />
          <Captions />
          <ProgressRail />
          <Finale onExplore={enterExplore} />
          <div
            className={`fixed z-[36] transition-opacity duration-700 ${ready && !heroVisible ? 'opacity-100' : 'pointer-events-none opacity-0'} ${
              mobile ? 'right-3 bottom-3 left-3 flex justify-center' : 'bottom-7 left-1/2 -translate-x-1/2'
            }`}
          >
            <TimeControl />
          </div>
        </>
      ) : (
        <>
          <ExploreOverlay onExit={exitExplore} />
          <div className={`fixed z-[36] ${mobile ? 'right-3 bottom-[84px] left-3 flex justify-center' : 'top-5 left-1/2 -translate-x-1/2'}`}>
            <TimeControl />
          </div>
        </>
      )}
      <Minimap />
      <Contact />
      <Loader />
    </>
  )
}
