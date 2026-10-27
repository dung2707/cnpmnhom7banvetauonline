import { useState } from 'react'
import { ArrowUpRight, TrainFront } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return (
    <main className="auth-page">
      <section className="journey-panel" aria-label="Đường sắt Việt">
        <img className="journey-image"
          src="https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1800&q=85"
          alt="Đường ray tàu chạy qua miền núi" />
        <div className="journey-shade" />
        <a className="brand brand-light" href="#home" aria-label="Đường sắt Việt, trang chủ">
          <span className="brand-mark"><TrainFront size={21} strokeWidth={2.1} /></span>
          <span>đường sắt<span className="brand-dot">.</span></span>
        </a>
        <div className="journey-copy">
          <span className="journey-kicker"><span /> Mỗi chuyến đi, một câu chuyện</span>
          <h2>Đi xa hơn.<br />Gần nhau hơn.</h2>
          <p>Hành trình xuyên Việt bắt đầu từ một tài khoản của riêng bạn.</p>
        </div>
        <div className="journey-footer">
          <span>HÀ NỘI</span><i /><span>ĐÀ NẴNG</span><i /><span>TP. HỒ CHÍ MINH</span>
          <a href="#journey" aria-label="Tìm hiểu hành trình"><ArrowUpRight size={16} /></a>
        </div>
      </section>
      <section className="form-panel">
        <div className="form-content" key={mode}>
          {mode === 'login'
            ? <LoginForm onRegister={() => setMode('register')} />
            : <RegisterForm onLogin={() => setMode('login')} />}
        </div>
        <footer className="form-footer">
          <span>© 2026 Đường sắt Việt</span>
          <span className="mock-note"><span /> Môi trường mô phỏng</span>
        </footer>
      </section>
    </main>
  )
}