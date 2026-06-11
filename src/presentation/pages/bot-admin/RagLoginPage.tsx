import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Building2, LogIn, ArrowRight } from 'lucide-react';
import { ragAuthApi } from '../../../infrastructure/auth/ragAuthApi';

export default function RagLoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/rag-admin/bots';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await ragAuthApi.login({ email, password });
      } else {
        await ragAuthApi.register({
          email,
          password,
          full_name: fullName,
          tenant_name: tenantName,
        });
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Произошла непредвиденная ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#070F19] px-4 py-12 relative overflow-hidden font-sans">
      {/* Decorative gradient glowing circles */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#1E88E5]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#9C27B0]/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-[#1E88E5] to-[#1565C0] rounded-2xl shadow-[0_8px_30px_rgb(30,136,229,0.3)] mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Alem RAG Platform
          </h2>
          <p className="mt-2 text-sm text-[#8497B4]">
            Управление чат-ботами и векторными базами знаний
          </p>
        </div>

        <div className="border border-[#1E293B] bg-[#0E1B2E]/60 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden p-6 sm:p-8">
          {/* Tabs header */}
          <div className="flex border-b border-[#1E293B] mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                isLogin
                  ? 'border-[#1E88E5] text-white'
                  : 'border-transparent text-[#8497B4] hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                !isLogin
                  ? 'border-[#1E88E5] text-white'
                  : 'border-transparent text-[#8497B4] hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 10 : -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {error && (
                <div className="p-3 text-xs bg-red-950/50 border border-red-500/30 rounded-xl text-red-200">
                  {error}
                </div>
              )}

              {!isLogin && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-1">
                      ФИО
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#526685]">
                        <User className="w-5 h-5" />
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Иван Иванов"
                        className="w-full pl-10 pr-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-1">
                      Компания / Организация
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#526685]">
                        <Building2 className="w-5 h-5" />
                      </span>
                      <input
                        type="text"
                        required
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        placeholder="ТОО Название"
                        className="w-full pl-10 pr-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-1">
                  Электронная почта
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#526685]">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8497B4] uppercase tracking-wider mb-1">
                  Пароль
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#526685]">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#070F19] border border-[#1E293B] rounded-xl text-sm text-white placeholder-[#526685] focus:outline-none focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-[#1E88E5] to-[#1565C0] text-white text-sm font-semibold rounded-xl hover:from-[#1976D2] hover:to-[#0D47A1] focus:outline-none shadow-[0_4px_15px_rgba(30,136,229,0.3)] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Войти' : 'Создать аккаунт'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
