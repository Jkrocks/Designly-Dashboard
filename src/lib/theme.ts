import { useEffect, useState } from 'react'
import { useStore } from './store'

function systemDark() {
  // Hosts that embed the app may stamp an explicit theme on <html>; honour it in "system" mode.
  const stamp = document.documentElement.getAttribute('data-theme')
  if (stamp === 'dark') return true
  if (stamp === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function useTheme() {
  const pref = useStore((s) => s.settings.theme)
  const [sys, setSys] = useState(systemDark)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const on = () => setSys(systemDark())
    mq?.addEventListener('change', on)
    const mo = new MutationObserver(on)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq?.removeEventListener('change', on)
      mo.disconnect()
    }
  }, [])
  const dark = pref === 'dark' || (pref === 'system' && sys)
  return { dark, pref }
}

export function ThemeSync() {
  const { dark } = useTheme()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.body.style.background = dark ? '#050505' : '#eeefea'
  }, [dark])
  return null
}
