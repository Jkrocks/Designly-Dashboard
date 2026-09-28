import type { ReactNode } from 'react'
import { Copy, Mail, MessageCircle } from 'lucide-react'
import { useUI } from '../lib/store'
import { cn } from '../lib/utils'
import { Button, inputCls, Modal } from './ui'

const linkCls = 'inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm hover:bg-surface-3'

/** Hands a message to the sender's own apps: clipboard, WhatsApp, Gmail or their mail client. */
export function ShareSheet({ open, onClose, title, intro, subject, body, to, extra }: { open: boolean; onClose: () => void; title: string; intro?: ReactNode; subject: string; body: string; to?: string; extra?: ReactNode }) {
  const notify = useUI((u) => u.notify)
  const copy = () =>
    navigator.clipboard.writeText(body).then(
      () => notify('Copied. Paste it anywhere.'),
      () => notify('Couldn’t copy. Select the text and copy it yourself.'),
    )
  const q = (v: string) => encodeURIComponent(v)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      {intro && <p className="mb-3 text-sm text-ink-3">{intro}</p>}
      <textarea id="share-text" aria-label="Message" readOnly value={body} rows={9} className={cn(inputCls, 'h-auto py-3 text-[13px] leading-relaxed')} onFocus={(e) => e.currentTarget.select()} />
      {extra}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="accent" icon={<Copy size={15} />} onClick={copy}>
          Copy
        </Button>
        <a className={linkCls} href={`https://mail.google.com/mail/?view=cm&fs=1&to=${q(to ?? '')}&su=${q(subject)}&body=${q(body)}`} target="_blank" rel="noreferrer">
          <Mail size={15} /> Gmail
        </a>
        <a className={linkCls} href={`mailto:${to ?? ''}?subject=${q(subject)}&body=${q(body)}`}>
          <Mail size={15} /> Other email app
        </a>
        <a className={linkCls} href={`https://wa.me/?text=${q(body)}`} target="_blank" rel="noreferrer">
          <MessageCircle size={15} /> WhatsApp
        </a>
      </div>
    </Modal>
  )
}
