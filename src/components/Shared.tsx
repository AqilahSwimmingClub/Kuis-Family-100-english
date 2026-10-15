import { X, Trophy, ArrowLeft } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { TEAM_COLORS } from '../data/constants'
export function Logo({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'small' : ''}`}><div className="brand-icon"><Trophy size={small ? 24 : 34} /></div><div><strong>FAMILY <span>100</span></strong><small>ENGLISH CHALLENGE</small></div></div>
}
export function Back({ onClick }: { onClick: () => void }) { return <button className="button ghost" onClick={onClick}><ArrowLeft size={16} /> Kembali</button> }
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} className="modal" onCancel={onClose}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Tutup dialog" onClick={onClose}><X /></button></div>{children}</dialog>
}
export function Confetti() { return <div className="confetti" aria-hidden="true">{Array.from({ length: 45 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: TEAM_COLORS[i % 5], animationDelay: `${(i % 9) * .13}s`, transform: `rotate(${i * 23}deg)` }} />)}</div> }
export function Footer() { return <footer>Dirancang &amp; Dikembangkan oleh <strong>FAHMI DJAWAS, S.Pd.</strong><span>© 2026 Semua Hak Dilindungi</span></footer> }
