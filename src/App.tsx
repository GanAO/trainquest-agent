import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MobileShell from './components/layout/MobileShell'
import RecordPage from './routes/RecordPage'
import CharacterPage from './routes/CharacterPage'
import DataPage from './routes/DataPage'
import SettingsPage from './routes/SettingsPage'
import HistoryPage from './routes/HistoryPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MobileShell />}>
          <Route index element={<Navigate to="/record" replace />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/character" element={<CharacterPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
