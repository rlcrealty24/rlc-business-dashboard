import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Finance from './pages/Finance.jsx'
import RealEstate from './pages/RealEstate.jsx'
import CreditRepair from './pages/CreditRepair.jsx'
import PortalProject from './pages/PortalProject.jsx'
import Fitness from './pages/Fitness.jsx'
import BibleStudy from './pages/BibleStudy.jsx'
import Today from './pages/Today.jsx'
import CeoCalendar from './pages/CeoCalendar.jsx'
import Inbox from './pages/Inbox.jsx'
import Dates from './pages/Dates.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="calendar" element={<CeoCalendar />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="dates" element={<Dates />} />
          <Route path="dashboard" element={<Navigate to="/today" replace />} />
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
