import { NavLink } from 'react-router-dom'
import { House, ListTodo, CalendarDays, LayoutGrid } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import HouseholdSetup from '../pages/HouseholdSetup'
import './Layout.css'

const navItems = [
  { to: '/', label: 'Hem', icon: House, end: true },
  { to: '/listor', label: 'Listor', icon: ListTodo },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/mer', label: 'Mer', icon: LayoutGrid },
]

export default function Layout({ children }) {
  const { profile, householdId, signOut } = useAuth()

  if (profile && !householdId) {
    return <HouseholdSetup />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand-small">Familjeappen</span>
        <button type="button" className="btn ghost" onClick={signOut}>
          Logga ut
        </button>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <span className="nav-icon">
                <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
