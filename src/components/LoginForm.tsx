import { useState, type FormEvent } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { validateLogin, type FormErrors } from '../auth/validation'
import { PasswordField } from './PasswordField'

interface LoginFormProps {
  onRegister: () => void
}

export function LoginForm({ onRegister }: LoginFormProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [requestError, setRequestError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestError('')
    const nextErrors = validateLogin({ email, password })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      await signIn(email, password)
    } catch {
      setRequestError('Email hoặc mật khẩu không chính xác')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="form-heading">
        <span className="eyebrow">Chào mừng trở lại</span>
        <h1>Đăng nhập</h1>
        <p>Đăng nhập để tiếp tục hành trình của bạn.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {requestError && <div className="form-alert" role="alert">{requestError}</div>}
        <div className="field-group">
          <label htmlFor="login-email">Email</label>
          <div className={`input-wrap${errors.email ? ' input-wrap-error' : ''}`}>
            <Mail aria-hidden="true" className="field-icon" size={18} />
            <input
              id="login-email" type="email" value={email}
              onChange={(event) => setEmail(event.target.value)} placeholder="ten@email.com"
              autoComplete="email" aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
            />
          </div>
          {errors.email && <p className="field-error" id="login-email-error">{errors.email}</p>}
        </div>
        <PasswordField id="login-password" label="Mật khẩu" value={password}
          onChange={setPassword} error={errors.password} autoComplete="current-password" />
        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          {!isSubmitting && <ArrowRight aria-hidden="true" size={18} />}
        </button>
      </form>
      <p className="switch-prompt">
        Chưa có tài khoản?{' '}
        <button type="button" className="text-button" onClick={onRegister}>Đăng ký ngay</button>
      </p>
      <div className="demo-hint">Dùng thử: <strong>demo@duongsat.vn</strong> / <strong>Tau123456</strong></div>
    </>
  )
}