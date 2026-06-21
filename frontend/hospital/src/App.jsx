import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AboutPage from "./pages/AboutPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import AdminPortalPage from "./pages/AdminPortalPage";
import PatientPortalPage from "./pages/PatientPortalPage";
import ReceptionPortalPage from "./pages/ReceptionPortalPage";
import AmbulanceDriverPage from "./pages/AmbulanceDriverPage";
import SupervisorPortalPage from "./pages/SupervisorPortalPage";
import PlatformAdminPage from "./pages/PlatformAdminPage";
import ReceptionBedMapPage from "./pages/ReceptionBedMapPage";
import ReceptionResourcePage from "./pages/ReceptionResourcePage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import EmergencyPortal from "./pages/EmergencyPortal";
import TriageDashboard from "./pages/TriageDashboard";
import DoctorPortalPage from "./pages/DoctorPortalPage";
import TriagePage from "./pages/TriagePage";
import PatientTrackingPage from "./pages/PatientTrackingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin-portal" element={<AdminPortalPage />} />
        <Route path="/patient-portal" element={<PatientPortalPage />} />
        <Route path="/reception-portal" element={<ReceptionPortalPage />} />
        <Route path="/reception/bed-map" element={<ReceptionBedMapPage />} />
        <Route path="/reception/resources" element={<ReceptionResourcePage />} />
        <Route path="/driver-portal" element={<AmbulanceDriverPage />} />
        <Route path="/supervisor-portal" element={<SupervisorPortalPage />} />
        <Route path="/platform-admin" element={<PlatformAdminPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/emergency" element={<EmergencyPortal />} />
        <Route path="/triage-dashboard" element={<TriageDashboard />} />
        <Route path="/doctor-portal" element={<DoctorPortalPage />} />
        <Route path="/triage" element={<TriagePage />} />
        <Route path="/track/:case_id" element={<PatientTrackingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;