export interface LoginValues {
  email: string
  password: string
}

export interface RegisterValues extends LoginValues {
  confirmPassword: string
}

export type FormErrors = Partial<Record<keyof RegisterValues, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const validateEmail = (email: string) => EMAIL_PATTERN.test(email.trim())

export function validateLogin(values: LoginValues): FormErrors {
  if (!values.email.trim() || !values.password) {
    return { email: 'Vui lòng nhập đầy đủ thông tin' }
  }

  if (!validateEmail(values.email)) {
    return { email: 'Email không đúng định dạng' }
  }

  return {}
}

export function validateRegister(values: RegisterValues): FormErrors {
  if (!values.email.trim() || !values.password || !values.confirmPassword) {
    return { email: 'Vui lòng nhập đầy đủ thông tin' }
  }

  if (!validateEmail(values.email)) {
    return { email: 'Email không đúng định dạng' }
  }

  if (values.password.length < 8) {
    return { password: 'Mật khẩu cần có ít nhất 8 ký tự' }
  }

  if (values.password !== values.confirmPassword) {
    return { confirmPassword: 'Mật khẩu xác nhận chưa khớp' }
  }

  return {}
}