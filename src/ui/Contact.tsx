import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../state/store'
import { IconCalendar, IconClose } from './Icons'
import { PROPERTY } from '../data/rooms'

const ease = [0.22, 1, 0.36, 1] as const

/**
 * Botón flotante + formulario para solicitar una visita presencial.
 * Si VITE_CONTACT_ENDPOINT está definido, envía un POST JSON a ese endpoint (CRM, Formspree, función serverless…).
 * Sin endpoint, funciona en modo demostración y no envía datos a ningún lado.
 */
export function Contact() {
  const open = useStore((s) => s.contactOpen)
  const set = useStore((s) => s.set)
  const mode = useStore((s) => s.mode)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      setState('idle')
      setTimeout(() => first.current?.focus(), 350)
    }
  }, [open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ contactOpen: false })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [set])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    setState('sending')
    const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined
    try {
      if (endpoint) {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...data, property: PROPERTY.name }),
        })
        if (!r.ok) throw new Error(String(r.status))
      } else {
        await new Promise((r) => setTimeout(r, 900))
      }
      setState('sent')
    } catch {
      setState('error')
    }
  }

  return (
    <>
      <button
        className={`btn btn-solid fixed z-[46] !h-12 shadow-[0_12px_40px_rgba(0,0,0,.35)] ${mode === 'explore' ? 'top-[76px] right-5 md:top-24 md:right-10' : 'right-5 bottom-5 md:right-10 md:bottom-7 max-md:top-[76px] max-md:bottom-auto'}`}
        onClick={() => set({ contactOpen: true })}
      >
        <IconCalendar width={16} height={16} /> <span className="max-sm:hidden">Agendar visita</span>
        <span className="sm:hidden">Visita</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex justify-end bg-ink/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            onClick={(e) => e.target === e.currentTarget && set({ contactOpen: false })}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Solicitar visita privada"
              className="relative h-full w-full max-w-[520px] overflow-y-auto bg-ink-2 px-7 py-10 md:px-12 md:py-14"
              initial={{ x: '100%' }}
              animate={{ x: 0, transition: { duration: 0.9, ease } }}
              exit={{ x: '100%', transition: { duration: 0.6, ease } }}
            >
              <button className="icon-btn absolute top-5 right-5" onClick={() => set({ contactOpen: false })} aria-label="Cerrar">
                <IconClose />
              </button>
              {state === 'sent' ? (
                <div className="flex h-full flex-col justify-center">
                  <p className="eyebrow mb-4">Solicitud recibida</p>
                  <h2 className="display text-[52px]">Gracias.</h2>
                  <p className="caption mt-4 max-w-[36ch]">
                    Un asesor privado se pondrá en contacto en las próximas 24 horas para confirmar su visita a {PROPERTY.name}.
                  </p>
                  {!import.meta.env.VITE_CONTACT_ENDPOINT && (
                    <p className="mt-6 text-[11px] text-ivory/40">Modo demostración: configure VITE_CONTACT_ENDPOINT para recibir las solicitudes.</p>
                  )}
                </div>
              ) : (
                <form onSubmit={submit} className="flex flex-col gap-7">
                  <div>
                    <p className="eyebrow mb-4">Visita privada</p>
                    <h2 className="display text-[48px]">Recorrerla en persona</h2>
                    <p className="caption mt-3">Coordinamos visitas exclusivas, con traslado y a la hora de luz que usted prefiera.</p>
                  </div>
                  <label className="block">
                    <span className="eyebrow !text-[9.5px]">Nombre y apellido</span>
                    <input ref={first} className="field" name="name" required autoComplete="name" />
                  </label>
                  <div className="grid gap-7 sm:grid-cols-2">
                    <label className="block">
                      <span className="eyebrow !text-[9.5px]">Email</span>
                      <input className="field" type="email" name="email" required autoComplete="email" />
                    </label>
                    <label className="block">
                      <span className="eyebrow !text-[9.5px]">Teléfono</span>
                      <input className="field" type="tel" name="phone" autoComplete="tel" />
                    </label>
                  </div>
                  <div className="grid gap-7 sm:grid-cols-2">
                    <label className="block">
                      <span className="eyebrow !text-[9.5px]">Fecha preferida</span>
                      <input className="field" type="date" name="date" min={new Date().toISOString().slice(0, 10)} />
                    </label>
                    <label className="block">
                      <span className="eyebrow !text-[9.5px]">Momento del día</span>
                      <select className="field" name="slot" defaultValue="Atardecer">
                        <option>Mañana</option>
                        <option>Mediodía</option>
                        <option>Atardecer</option>
                        <option>Noche</option>
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="eyebrow !text-[9.5px]">Mensaje (opcional)</span>
                    <textarea className="field resize-none" rows={3} name="message" />
                  </label>
                  <button className="btn btn-solid mt-2 w-full" disabled={state === 'sending'}>
                    {state === 'sending' ? 'Enviando…' : 'Solicitar visita'}
                  </button>
                  {state === 'error' && <p className="text-[12px] text-[#e8a48c]">No pudimos enviar la solicitud. Intente nuevamente en unos minutos.</p>}
                  <p className="text-[11px] leading-relaxed text-ivory/40">Sus datos se usan solo para coordinar la visita.</p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
