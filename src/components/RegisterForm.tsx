import { useState, type FormEvent } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { validateRegister, type FormErrors } from '../auth/validation'
import { PasswordField } from './PasswordField'

interface RegisterFormProps {
  onLogin: () => void
}

export function RegisterForm({ onLogin }: RegisterFormProps) {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [requestError, setRequestError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestError('')
    const nextErrors = validateRegister({ email, password, confirmPassword })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const user = await signUp(email, password)
      setRegisteredEmail(user.email)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Không thể tạo tài khoản lúc này')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (registeredEmail) {
    return (
      <div className="success-panel" role="status">
        <span className="success-mark">✓</span>
        <span className="eyebrow">Hoàn tất đăng ký</span>
        <h1>Tài khoản đã sẵn sàng</h1>
        <p>Thông tin đăng nhập đã được tạo cho <strong>{registeredEmail}</strong>.</p>
        <button className="submit-button" type="button" onClick={onLogin}>
          Đến đăng nhập <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="form-heading">
        <span className="eyebrow">Bắt đầu hành trình</span>
        <h1>Tạo tài khoản</h1>
        <p>Lưu thông tin cá nhân và theo dõi vé tàu dễ dàng hơn.</p>
      </div>
      <form className="auth-form register-form" onSubmit={handleSubmit} noValidate>
        {requestError && <div className="form-alert" role="alert">{requestError}</div>}
        <div className="field-group">
          <label htmlFor="register-email">Email</label>
          <div className={`input-wrap${errors.email ? ' input-wrap-error' : ''}`}>
            <Mail aria-hidden="true" className="field-icon" size={18} />
            <input
              id="register-email" type="email" value={email}
              onChange={(event) => setEmail(event.target.value)} placeholder="ten@email.com"
              autoComplete="email" aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
            />
          </div>
          {errors.email && <p className="field-error" id="register-email-error">{errors.email}</p>}
        </div>
        <PasswordField id="register-password" label="Mật khẩu" value={password}
          onChange={setPassword} error={errors.password} autoComplete="new-password" />
        <PasswordField id="register-confirm-password" label="Xác nhận mật khẩu" value={confirmPassword}
          onChange={setConfirmPassword} error={errors.confirmPassword} autoComplete="new-password" />
        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          {!isSubmitting && <ArrowRight aria-hidden="true" size={18} />}
        </button>
      </form>
      <p className="switch-prompt">
        Đã có tài khoản?{' '}
        <button type="button" className="text-button" onClick={onLogin}>Đăng nhập</button>
      </p>
    </>
  )
}