import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Finance from './pages/Finance.jsx'
import RealEstate from './pages/RealEstate.jsx'
import CreditRepair from './pages/CreditRepair.jsx'
import PortalProject from './pages/PortalProject.jsx'
import Fitness from './pages/Fitness.jsx'
import BibleStudy from './pages/BibleStudy.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="finance" element={<Finance />} />
          <Route path="real-estate" element={<RealEstate />} />
          <Route path="credit-repair" element={<CreditRepair />} />
          <Route path="portal-project" element={<PortalProject />} />
          <Route path="fitness" element={<Fitness />} />
          <Route path="bible-study" element={<BibleStudy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
