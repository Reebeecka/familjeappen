import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import HouseholdSetup from '../pages/HouseholdSetup'

const navItems = [
  { to: '/', label: 'Hem', icon: '🏠', end: true },
  { to: '/uppgifter', label: 'Uppgifter', icon: '✅' },
  { to: '/inkop', label: 'Inköp', icon: '🛒' },
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
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
