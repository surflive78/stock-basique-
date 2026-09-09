import type { ReactNode } from 'react'
import { AlertTriangle, PackageX, X } from 'lucide-react'
import { statusOf } from './lib/stock'

export function StockBadge({q,seuil}:{q:number;seuil:number}){const s=statusOf(q,seuil);return <span className={`badge ${s}`}>{s==='rupture'?'Rupture':s==='commander'?'À commander':s==='surveiller'?'À surveiller':'Disponible'}</span>}
export function Empty({icon='package',title,text}:{icon?:string;title:string;text:string}){return <div className="empty">{icon==='alert'?<AlertTriangle/>:<PackageX/>}<strong>{title}</strong><span>{text}</span></div>}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal"><header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Fermer"><X/></button></header>{children}</section></div>}
