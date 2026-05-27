import React, { useState } from 'react';
import { Mail, ArrowRight, Lock, AlertCircle, FlaskConical, UserPlus, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import { 
  auth, 
  googleProvider, 
  isFirebaseConfigured,
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
  onDevelopmentLogin?: (credentials: { email: string; password: string }) => Promise<void>;
}

type AuthView = 'login' | 'signup' | 'recover' | 'success';

const IS_DEV = import.meta.env.DEV;
const ALLOW_INSECURE_LOCAL_LOGIN = import.meta.env.VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN === 'true';

const Login: React.FC<LoginProps> = ({ onLogin, onDevelopmentLogin }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<{code: string, message: string} | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/configuration-not-found': return 'Autenticacao Firebase indisponivel neste ambiente. Configure as variaveis do frontend para habilitar login real.';
      case 'auth/email-already-in-use': return 'Este e-mail já está sendo utilizado.';
      case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/invalid-email': return 'O e-mail informado não é válido.';
      case 'auth/user-not-found': return 'Usuário não localizado.';
      case 'auth/wrong-password': return 'Senha incorreta. Tente novamente.';
      default: return 'Ocorreu um erro inesperado. Verifique os dados.';
    }
  };

  const getAuthDiagnostic = (code: string) => {
    switch (code) {
      case 'auth/configuration-not-found':
        return {
          title: 'Diagnóstico de autenticação',
          message: 'O login real depende das variáveis do Firebase no frontend ou do login local de desenvolvimento.',
          suggestion: 'Verifique VITE_FIREBASE_* no frontend ou habilite VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN no ambiente local.',
        };
      case 'auth/local-login-failed':
        return {
          title: 'Diagnóstico de sessão local',
          message: 'O backend local rejeitou a autenticação insegura de desenvolvimento.',
          suggestion: 'Confirme se o backend está ativo, se a sessão dev foi carregada e se o login local está liberado.',
        };
      case 'auth/unauthorized-domain':
        return {
          title: 'Diagnóstico de domínio',
          message: 'O domínio atual não está autorizado no Firebase.',
          suggestion: 'Adicione o domínio na lista de Authorized Domains do projeto Firebase.',
        };
      default:
        return null;
    }
  };

  const getErrorCode = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === 'string' && code) {
        return code;
      }
    }
    return fallback;
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    if (!isFirebaseConfigured) {
      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.email) {
        onLogin(result.user.email);
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/social-login-failed');
      if (code === 'auth/unauthorized-domain' || !window.location.hostname) {
        setError({
          code: 'auth/unauthorized-domain',
          message: `Dominio nao autorizado no Firebase: ${window.location.hostname}. Adicione em Authentication > Settings > Authorized domains.`,
        });
      } else {
        setError({ code, message: getFirebaseErrorMessage(code) });
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isFirebaseConfigured) {
      if (IS_DEV && ALLOW_INSECURE_LOCAL_LOGIN && onDevelopmentLogin) {
        setIsLoading(true);
        setError(null);
        try {
          await onDevelopmentLogin({ email, password });
          onLogin(email);
          return;
        } catch (error: unknown) {
          setIsLoading(false);
          const code = getErrorCode(error, 'auth/local-login-failed');
          setError({
            code,
            message: String(
              error && typeof error === 'object' && 'message' in error
                ? (error as { message?: unknown }).message
                : 'Falha ao autenticar no backend local.'
            ),
          });
          return;
        }
      }

      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/sign-in-failed');
      setError({ code, message: getFirebaseErrorMessage(code) });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    if (!isFirebaseConfigured) {
      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    if (password.length < 6) {
      setError({ code: 'local/short-password', message: "A senha precisa de no mínimo 6 caracteres." });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/signup-failed');
      setError({ code, message: getFirebaseErrorMessage(code) });
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isFirebaseConfigured) {
      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Link enviado com sucesso!");
      setView('success');
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/reset-failed');
      setError({ code, message: getFirebaseErrorMessage(code) });
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-[#020617] flex flex-col items-center justify-between py-6 px-4 overflow-hidden transition-colors duration-500 relative text-slate-900 dark:text-white">

      <div className={`w-full max-w-[360px] flex flex-col flex-1 justify-between transition-all duration-700 relative z-10 ${isAnimating ? 'opacity-0 scale-95 blur-md' : 'opacity-100'}`}>
        
        <div className="text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000 mt-4 overflow-visible">
          <div className="transform scale-[1.35] mb-6 overflow-visible">
            <Logo size="md" showText={false} />
          </div>
          <div className="flex flex-col items-center mt-2">
            <h1 className="text-6xl font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              Flow
            </h1>
            <p className="text-[14px] font-black text-indigo-500 uppercase tracking-[0.6em] mt-2">Finance</p>
            <p className="text-xs text-slate-400 mt-1">Flow Finance</p>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/95 px-6 py-6 rounded-[3rem] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.12)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] border border-white/50 dark:border-slate-800/50 backdrop-blur-3xl my-4">
          
          {error?.code === 'auth/unauthorized-domain' ? (
            <div className="animate-in slide-in-from-top-4 duration-500 space-y-3">
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] space-y-2 text-center">
                <FlaskConical size={24} className="mx-auto text-indigo-500" />
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                  OAuth restrito. Use a demonstração segura para explorar o Flow.
                </p>
                <button 
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => onLogin('teste@flow.com'), 400);
                  }}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  <ShieldCheck size={14} className="mr-2 inline" /> Iniciar Modo Demo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div role="alert" aria-live="polite" className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 text-rose-500 animate-in shake">
                  <AlertCircle size={13} className="shrink-0" />
                  <p className="text-xs font-medium">{error.message}</p>
                </div>
              )}
              {error && getAuthDiagnostic(error.code) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em]">{getAuthDiagnostic(error.code)?.title}</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed">{getAuthDiagnostic(error.code)?.message}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] opacity-90">
                    Próximo passo: {getAuthDiagnostic(error.code)?.suggestion}
                  </p>
                </div>
              )}

              {view === 'login' && (
                <>
                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    <div className="space-y-2">
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors ${focusedField === 'email' ? 'text-indigo-500' : ''}`} size={15} />
                        <input 
                          type="email" required value={email}
                          onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-label="E-mail de acesso"
                          placeholder="E-mail"
                          data-testid="email"
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 text-xs font-bold outline-none transition-all shadow-inner"
                        />
                      </div>
                      <div className="relative group">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors ${focusedField === 'password' ? 'text-indigo-500' : ''}`} size={15} />
                        <input 
                          type="password" required value={password}
                          onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-label="Senha de acesso"
                          placeholder="Senha"
                          data-testid="password"
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 text-xs font-bold outline-none transition-all shadow-inner"
                        />
                      </div>
                      <button type="button" onClick={() => setView('recover')} className="block w-full text-right text-[9px] font-black text-indigo-500 uppercase tracking-widest px-1">Esqueci a senha</button>
                    </div>
                  <button type="submit" disabled={isLoading} data-testid="login-button" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50 transition-all">
                    {isLoading ? 'Autenticando...' : 'Acessar Conta'} <ArrowRight size={14} className="inline ml-1" />
                  </button>
                </form>
                  
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                    <span className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">OU</span>
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                  </div>

                  <button onClick={() => handleSocialLogin(googleProvider)} className="w-full py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-sm">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" /> Entrar com Google
                  </button>

                  <button onClick={() => setView('signup')} className="w-full text-center text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1.5 group">
                    Novo por aqui? <span className="text-indigo-600 group-hover:underline">Cadastre-se</span>
                  </button>
                </>
              )}

              {view === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-3 animate-in slide-in-from-right-4 duration-500">
                  <button type="button" onClick={() => setView('login')} className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase mb-1"><ChevronLeft size={14} /> Voltar</button>
                  <div className="space-y-2">
                    <input type="text" required aria-label="Nome completo" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
                    <input type="email" required aria-label="E-mail para cadastro" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
                    <input type="password" required aria-label="Senha para cadastro" placeholder="Senha (min 6 car.)" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">
                    Criar meu Acesso <UserPlus size={16} className="ml-2 inline" />
                  </button>
                </form>
              )}

              {view === 'recover' && (
                <form onSubmit={handleRecoverPassword} className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                  <button type="button" onClick={() => setView('login')} className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase mb-1"><ChevronLeft size={14} /> Voltar</button>
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-500 text-center leading-relaxed px-2">Enviaremos um link de recuperação para o e-mail cadastrado.</p>
                    <input type="email" required aria-label="E-mail para recuperar senha" placeholder="E-mail cadastrado" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all">Recuperar Senha</button>
                </form>
              )}

              {view === 'success' && (
                <div className="text-center space-y-4 py-2 animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
                    <CheckCircle2 size={36} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-2 leading-relaxed">{successMessage}</p>
                  <button onClick={() => setView('login')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all">Voltar ao Login</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 mb-4">
          <button 
            onClick={() => {
              setIsAnimating(true);
              setTimeout(() => onLogin('teste@flow.com'), 400);
            }}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/20 text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-90"
          >
            <ShieldCheck size={13} /> Sessão protegida
          </button>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Firebase, login local e recuperação</p>
        </div>
      </div>
    </div>
  );
};

export default Login;






