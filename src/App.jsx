import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Finance from './finance/FinancePage.jsx'
import RealEstate from './pages/RealEstate.jsx'
import CreditRepair from './pages/CreditRepair.jsx'
import PortalProject from './pages/PortalProject.jsx'
import Fitness from './pages/Fitness.jsx'
import BibleStudy from './pages/BibleStudy.jsx'
import Today from './pages/Today.jsx'
import CeoCalendar from './pages/CeoCalendar.jsx'
import Inbox from './pages/Inbox.jsx'
import Dates from './pages/Dates.jsx'
import SocialHQ from './pages/social/SocialHQ.jsx'
import Planner from './pages/social/Planner.jsx'
import IdeaBank from './pages/social/IdeaBank.jsx'
import PostWorkspace from './pages/social/PostWorkspace.jsx'
import PlanMonth from './pages/social/PlanMonth.jsx'
import Library from './pages/social/Library.jsx'
import Campaigns from './pages/social/Campaigns.jsx'
import CampaignBuilder from './pages/social/CampaignBuilder.jsx'
import Insights from './pages/social/Insights.jsx'

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
          <Route path="social" element={<SocialHQ />} />
          <Route path="social/planner" element={<Planner />} />
          <Route path="social/ideas" element={<IdeaBank />} />
          <Route path="social/post/:id" element={<PostWorkspace />} />
          <Route path="social/plan" element={<PlanMonth />} />
          <Route path="social/library" element={<Library />} />
          <Route path="social/insights" element={<Insights />} />
          <Route path="social/campaigns" element={<Campaigns />} />
          <Route path="social/campaigns/:id" element={<CampaignBuilder />} />
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
