import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/record', label: '记录', icon: '⚔️' },
  { to: '/character', label: '角色', icon: '🧙' },
  { to: '/data', label: '数据', icon: '📊' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export default function BottomTabs() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-rpg-panel border-t border-rpg-border z-50">
      <div className="flex">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive
                  ? 'text-rpg-accent'
                  : 'text-rpg-muted hover:text-rpg-text'
              }`
            }
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
