import { Link } from 'react-router-dom'

const menuItems = [
  { to: '/min-dag', icon: '🌅', label: 'Min dag' },
  { to: '/sok', icon: '🔍', label: 'Sök' },
  { to: '/chatt', icon: '💬', label: 'Chatt' },
  { to: '/kalender', icon: '📅', label: 'Kalender' },
  { to: '/maltider', icon: '🍽️', label: 'Måltider' },
  { to: '/aterkommande', icon: '🔁', label: 'Återkommande' },
  { to: '/recept', icon: '📖', label: 'Recept' },
  { to: '/budget', icon: '💰', label: 'Budget' },
  { to: '/kontakter', icon: '📇', label: 'Kontakter' },
  { to: '/dokument', icon: '📁', label: 'Dokument' },
  { to: '/profil', icon: '👤', label: 'Min profil' },
  { to: '/installningar', icon: '⚙️', label: 'Inställningar' },
]

export default function Menu() {
  return (
    <div className="page">
      <h1 className="page-title">Mer</h1>
      <div className="dashboard-grid">
        {menuItems.map((item) => (
          <Link key={item.to} to={item.to} className="card dash-card">
            <span className="dash-icon">{item.icon}</span>
            <span className="dash-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
