import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import { ConfirmProvider } from './components/ConfirmDialog'
import { RequireBuyer, SiteLayout, StoreLayout } from './components/Layouts'
import DealsPage from './pages/DealsPage'
import HomePage from './pages/HomePage'
import ForStoresPage from './pages/ForStoresPage'
import StoresPage from './pages/StoresPage'
import StorePage from './pages/StorePage'
import ProductPage from './pages/ProductPage'
import DealPage from './pages/DealPage'
import ReservationPage from './pages/ReservationPage'
import MyPage from './pages/MyPage'
import LoginPage from './pages/LoginPage'
import HowPage from './pages/HowPage'
import StaffLoginPage from './pages/StaffLoginPage'
import StoreDashboard from './pages/store/StoreDashboard'
import StoreNewDeal from './pages/store/StoreNewDeal'
import StoreRedeem from './pages/store/StoreRedeem'
import StoreReports from './pages/store/StoreReports'
import AdminPage from './pages/AdminPage'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/for-stores" element={<ForStoresPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/stores/:storeId" element={<StorePage />} />
            <Route path="/stores/:storeId/products/:productId" element={<ProductPage />} />
            <Route path="/d/:slug" element={<DealPage />} />
            <Route path="/how" element={<HowPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/staff/login" element={<StaffLoginPage />} />
            <Route path="/my/reservations" element={<RequireBuyer><MyPage /></RequireBuyer>} />
            <Route path="/my/reservations/:id" element={<RequireBuyer><ReservationPage /></RequireBuyer>} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/store" element={<StoreLayout />}>
            <Route index element={<StoreDashboard />} />
            <Route path="deals/new" element={<StoreNewDeal />} />
            <Route path="redeem" element={<StoreRedeem />} />
            <Route path="reports" element={<StoreReports />} />
            <Route path="reports/:dealId" element={<StoreReports />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
    </AuthProvider>
  </StrictMode>,
)
