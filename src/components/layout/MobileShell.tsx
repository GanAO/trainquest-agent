import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { icon: '⚔️', label: '训练记录', path: '/history' },
  { icon: '🧙', label: '角色详情', path: '/character' },
  { icon: '📊', label: '数据统计', path: '/data' },
  { icon: '⚙️', label: '设置', path: '/settings' },
]

export default function MobileShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleNav = (path: string) => {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-rpg-bg flex flex-col">
      {/* 全局 ☰ 按钮 */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed top-4 left-4 z-30 w-9 h-9 flex items-center justify-center rounded-lg text-rpg-muted hover:text-rpg-text hover:bg-rpg-panel transition-colors"
        aria-label="菜单"
      >
        <svg width="20" height="14" viewBox="0 0 20 14" fill="currentColor">
          <rect y="0" width="20" height="2" rx="1" />
          <rect y="6" width="20" height="2" rx="1" />
          <rect y="12" width="20" height="2" rx="1" />
        </svg>
      </button>

      {/* 页面内容 */}
      <div className="flex-1 max-w-md mx-auto w-full">
        <Outlet />
      </div>

      {/* 遮罩 */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 左侧抽屉 */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-64 bg-rpg-panel border-r border-rpg-border z-50
          transition-transform duration-300 ease-out
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-rpg-border">
          <span className="font-pixel text-rpg-gold text-xs tracking-wide">FITNESS RPG</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-rpg-muted hover:text-rpg-text text-2xl leading-none transition-colors"
            aria-label="关闭菜单"
          >
            ×
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rpg-border text-left transition-colors group"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-rpg-text font-medium group-hover:text-white transition-colors">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* 底部首页入口 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-rpg-border">
          <button
            onClick={() => handleNav('/')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rpg-border text-left transition-colors"
          >
            <span className="text-xl">🏠</span>
            <span className="text-rpg-muted font-medium">回到首页</span>
          </button>
        </div>
      </div>
    </div>
  )
}
