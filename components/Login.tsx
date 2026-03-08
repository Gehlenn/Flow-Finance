import React, { useState } from 'react';
import { Mail, ArrowRight, Lock, AlertCircle, FlaskConical, UserPlus, Fingerprint, ChevronLeft, CheckCircle2, ShieldCheck, Terminal } from 'lucide-react';
import Logo from './Logo';
import { 
  auth, 
  googleProvider, 
  signInWithPopup,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  Provider
} from '../services/localService';
// import { auth, googleProvider, signInWithPopup } from '../services/firebase';
// import { 
//   signInWithEmailAndPassword, 
//   createUserWithEmailAndPassword, 
//   sendPasswordResetEmail 
// } from "firebase/auth";

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
  const [focusedField, setFocusedField] = useState<string | null>(null);
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

  const handleSocialLogin = async (provider: Provider) => {
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
    <div className="h-screen w-full bg-slate-50 dark:bg-[#020617] flex flex-col items-center justify-between py-6 px-4 overflow-hidden transition-colors duration-500 relative text-slate-900 dark:text-white">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-400/5 dark:bg-cyan-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className={`w-full max-w-[360px] flex flex-col flex-1 justify-between transition-all duration-700 relative z-10 ${isAnimating ? 'opacity-0 scale-95 blur-md' : 'opacity-100'}`}>
        
        {/* Header */}
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

        {/* Form Card */}
        <div className="bg-white/90 dark:bg-slate-900/95 px-6 py-6 rounded-[3rem] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.12)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] border border-white/50 dark:border-slate-800/50 backdrop-blur-3xl my-4">
          
          {error?.code === 'auth/unauthorized-domain' ? (
            <div className="animate-in slide-in-from-top-4 duration-500 space-y-3">
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] space-y-2 text-center">
                <FlaskConical size={24} className="mx-auto text-indigo-500" />
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                  OAuth restrito. Use a demonstração segura para explorar o Flow.
                </p>
                <button 
                  onClick={handleQuickTest}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  <Fingerprint size={14} className="mr-2 inline" /> Iniciar Modo Demo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-500 animate-in shake">
                  <AlertCircle size={14} className="shrink-0" />
                  <p className="text-[9px] font-bold">{error.message}</p>
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
                    <input type="text" required placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
                    <input type="email" required placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
                    <input type="password" required placeholder="Senha (min 6 car.)" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
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
                    <input type="email" required placeholder="E-mail cadastrado" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-500/20 shadow-inner" />
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
        
        {/* Footer with Quick Access button */}
        <div className="flex flex-col items-center gap-3 mb-4">
          <button 
            onClick={handleQuickTest}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/20 text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-90"
          >
            <Terminal size={12} /> Acesso Rápido (Teste)
          </button>

          <div className="flex items-center gap-2 px-5 py-2 bg-white/40 dark:bg-slate-900/40 rounded-full border border-slate-200/50 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-widest opacity-60">
            <ShieldCheck size={14} className="text-emerald-500" /> AES-256 Secured
          </div>
          <div className="text-center opacity-30">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">© Komodo Flow Finance</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Build v1.0.0 Stable</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;