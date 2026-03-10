import React, { useState } from 'react';
import { Mail, ArrowRight, Lock, AlertCircle, UserPlus, Fingerprint, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import { 
  auth, 
  googleProvider, 
  signInWithPopup,
} from '../services/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  AuthProvider,
} from 'firebase/auth';

interface LoginProps {
  onLogin: (email: string) => void;
}

type AuthView = 'login' | 'signup' | 'recover' | 'success';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{code: string, message: string} | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use': return 'Este e-mail já está sendo utilizado.';
      case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/invalid-email': return 'O e-mail informado não é válido.';
      case 'auth/user-not-found': return 'Usuário não localizado.';
      case 'auth/wrong-password': return 'Senha incorreta. Tente novamente.';
      default: return 'Ocorreu um erro inesperado. Verifique os dados.';
    }
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.email) {
        onLogin(result.user.email);
      }
    } catch (err: any) {
      setIsLoading(false);
      if (err.code === 'auth/unauthorized-domain' || !window.location.hostname) {
        setError({ code: 'auth/unauthorized-domain', message: "Sandbox Ativa: Domínio não autorizado." });
      } else {
        setError({ code: err.code, message: getFirebaseErrorMessage(err.code) });
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (err: any) {
      setIsLoading(false);
      setError({ code: err.code, message: getFirebaseErrorMessage(err.code) });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    if (password.length < 6) {
      setError({ code: 'local/short-password', message: "A senha precisa de no mínimo 6 caracteres." });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (err: any) {
      setIsLoading(false);
      setError({ code: err.code, message: getFirebaseErrorMessage(err.code) });
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Link enviado com sucesso!");
      setView('success');
    } catch (err: any) {
      setIsLoading(false);
      setError({ code: err.code, message: getFirebaseErrorMessage(err.code) });
    }
  };

  const handleQuickTest = () => {
    setIsAnimating(true);
    setTimeout(() => onLogin('teste@flow.com'), 400);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className={`w-full max-w-md transition-all duration-700 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100'}`}>
        
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Logo size="md" showText={false} />
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tight">Flow</h1>
          <p className="text-sm font-bold text-indigo-600 tracking-[0.4em] mt-1">FINANCE</p>
          <p className="text-xs text-gray-400 mt-1">Flow Finance</p>
        </div>

        {/* Card Principal */}
        <div className="bg-white rounded-3xl shadow-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
              <AlertCircle size={16} />
              <p className="text-xs font-semibold">{error.message}</p>
            </div>
          )}

          {view === 'login' && (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                {/* Input E-mail */}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Input Senha */}
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Link Esqueci Senha */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setView('recover')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 tracking-wider"
                  >
                    ESQUECI A SENHA
                  </button>
                </div>

                {/* Botão Acessar */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/30 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? 'AUTENTICANDO...' : 'ACESSAR CONTA'} <ArrowRight size={18} />
                </button>
              </form>

              {/* Divisor OU */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs font-semibold text-gray-400 uppercase">ou</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Botão Google */}
              <button
                onClick={() => handleSocialLogin(googleProvider)}
                className="w-full py-3.5 bg-white border-2 border-gray-200 hover:border-gray-300 rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-gray-700 active:scale-[0.98] transition-all"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                ENTRAR COM GOOGLE
              </button>

              {/* Link Cadastro */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setView('signup')}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 tracking-wider"
                >
                  NOVO POR AQUI? <span className="text-indigo-600">CADASTRE-SE</span>
                </button>
              </div>
            </>
          )}

          {view === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('login')}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2"
              >
                <ChevronLeft size={16} /> VOLTAR
              </button>
              <input
                type="text"
                required
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                required
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                required
                placeholder="Senha (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                CRIAR CONTA <UserPlus size={18} />
              </button>
            </form>
          )}

          {view === 'recover' && (
            <form onSubmit={handleRecoverPassword} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('login')}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2"
              >
                <ChevronLeft size={16} /> VOLTAR
              </button>
              <p className="text-xs text-gray-600 text-center mb-4">
                Enviaremos um link de recuperação para seu e-mail.
              </p>
              <input
                type="email"
                required
                placeholder="E-mail cadastrado"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-all"
              >
                RECUPERAR SENHA
              </button>
            </form>
          )}

          {view === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-sm font-semibold text-gray-700">{successMessage}</p>
              <button
                onClick={() => setView('login')}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-all"
              >
                VOLTAR AO LOGIN
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 space-y-3">
          {/* Botão Acesso Rápido */}
          <div className="text-center">
            <button
              onClick={handleQuickTest}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold tracking-wider transition-all"
            >
              <Fingerprint size={14} /> ACESSO RÁPIDO (TESTE)
            </button>
          </div>

          {/* Badge Segurança */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-xs font-bold text-gray-600">
              <ShieldCheck size={14} className="text-green-600" /> AES-256 SECURED
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs text-gray-400 space-y-0.5">
            <p className="font-bold tracking-widest">© KOMODO FLOW FINANCE</p>
            <p className="text-[10px] tracking-wider">BUILD V1.0.0 STABLE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;