export default function DataExportButton() {
  const handleExport = () => {
    const link = document.createElement('a')
    link.href = '/api/export'
    link.download = `trainquest-agent-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
  }

  return (
    <div className="card">
      <div className="section-title">数据管理</div>
      <p className="text-rpg-muted text-sm mb-3">将所有数据导出为 JSON 文件备份</p>
      <button className="btn-secondary w-full" onClick={handleExport}>
        📦 导出所有数据
      </button>
    </div>
  )
}
