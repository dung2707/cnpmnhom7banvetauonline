import { useAuth } from './auth/AuthContext'
import { AuthPage } from './components/AuthPage'
import { HomePage } from './components/HomePage'

export default function App() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <HomePage /> : <AuthPage />
}