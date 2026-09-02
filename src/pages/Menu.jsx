import { Link } from 'react-router-dom'
import {
  Sunrise,
  Search,
  MessageCircle,
  CalendarDays,
  UtensilsCrossed,
  Repeat,
  BookOpen,
  Wallet,
  Contact,
  Folder,
  UserRound,
  Settings,
  Trophy,
} from 'lucide-react'

const menuItems = [
  { to: '/min-dag', icon: Sunrise, label: 'Min dag' },
  { to: '/sok', icon: Search, label: 'Sök' },
  { to: '/chatt', icon: MessageCircle, label: 'Chatt' },
  { to: '/kalender', icon: CalendarDays, label: 'Kalender' },
  { to: '/rugby', icon: Trophy, label: 'Rugby' },
  { to: '/maltider', icon: UtensilsCrossed, label: 'Måltider' },
  { to: '/aterkommande', icon: Repeat, label: 'Återkommande' },
  { to: '/recept', icon: BookOpen, label: 'Recept' },
  { to: '/budget', icon: Wallet, label: 'Budget' },
  { to: '/kontakter', icon: Contact, label: 'Kontakter' },
  { to: '/dokument', icon: Folder, label: 'Dokument' },
  { to: '/profil', icon: UserRound, label: 'Min profil' },
  { to: '/installningar', icon: Settings, label: 'Inställningar' },
]

export default function Menu() {
  return (
    <div className="page">
      <h1 className="page-title">Mer</h1>
      <div className="dashboard-grid">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.to} to={item.to} className="card dash-card">
              <span className="dash-icon">
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="dash-label">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
