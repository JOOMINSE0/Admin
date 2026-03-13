import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import OrderStatus from './pages/OrderStatus'
import MoistureStatus from './pages/MoistureStatus'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/order/status" replace />} />
        <Route path="order/status" element={<OrderStatus />} />
        <Route path="order/moisture" element={<MoistureStatus />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
