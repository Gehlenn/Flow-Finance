import React from 'react';
import { X, ShieldCheck, Copyright } from 'lucide-react';

interface LegalModalProps {
  type: 'privacy_terms' | 'copyright';
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  const getTitle = () => {
    switch (type) {
      case 'privacy_terms': return 'Termos de Uso e Privacidade';
      case 'copyright': return 'Propriedade Intelectual e Licenciamento';
    }
  };

  const getContent = () => {
    switch (type) {
      case 'privacy_terms':
        return (
          <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">1. IntroduÃ§Ã£o</h4>
              <p>Bem-vindo ao Flow Finance. Ao utilizar nosso aplicativo, vocÃª concorda com estes Termos de Uso e nossa PolÃ­tica de Privacidade. Estes documentos regem a relaÃ§Ã£o entre vocÃª (o "UsuÃ¡rio") e o Flow Finance (a "Plataforma").</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">2. Privacidade e Dados</h4>
              <p><strong>2.1. Coleta MÃ­nima:</strong> Coletamos apenas os dados essenciais para o funcionamento do serviÃ§o: endereÃ§o de e-mail para autenticaÃ§Ã£o e os dados financeiros que vocÃª insere voluntariamente.</p>
              <p><strong>2.2. ProteÃ§Ã£o: âš ï¸ IMPORTANTE:</strong> Na versÃ£o atual (0.1.0 Prototype), os dados financeiros sÃ£o armazenados LOCALMENTE no seu dispositivo e SÃƒO CRIPTOGRAFADOS usando Web Crypto API (AES-GCM-256). Dados sincronizados com servidor devem usar HTTPS/TLS. Nunca compartilharemos dados com terceiros.</p>
              <p><strong>2.3. Perspectiva de SeguranÃ§a:</strong> Em versÃµes futuras serÃ¡ implementado armazenamento em servidor com criptografia end-to-end. Por enquanto, os dados residem apenas no seu dispositivo local.</p>
              <p><strong>2.4. NÃ£o-Compartilhamento:</strong> Seus dados financeiros sÃ£o seus. NÃ£o vendemos, alugamos ou compartilhamos suas informaÃ§Ãµes pessoais ou financeiras com terceiros para fins de marketing.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">3. Uso do ServiÃ§o</h4>
              <p><strong>3.1. Responsabilidade:</strong> O Flow Finance Ã© uma ferramenta de gestÃ£o. NÃ£o oferecemos consultoria financeira, legal ou tributÃ¡ria. As decisÃµes tomadas com base nos dados do app sÃ£o de sua inteira responsabilidade.</p>
              <p><strong>3.2. Conduta:</strong> Ã‰ proibido utilizar a plataforma para atividades ilÃ­citas, fraudulentas ou que violem direitos de terceiros.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">4. Propriedade Intelectual</h4>
              <p>Todo o design, cÃ³digo-fonte, logotipos e textos sÃ£o propriedade exclusiva do Flow Finance ou de seus licenciadores, protegidos pelas leis de direitos autorais vigentes.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">5. AlteraÃ§Ãµes</h4>
              <p>Reservamo-nos o direito de atualizar estes termos periodicamente. O uso contÃ­nuo do serviÃ§o apÃ³s as alteraÃ§Ãµes constitui aceitaÃ§Ã£o dos novos termos.</p>
            </div>
            
            <p className="text-xs text-slate-400 pt-4">Ãšltima atualizaÃ§Ã£o: Fevereiro de 2026</p>
          </div>
        );
      case 'copyright':
        return (
          <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-2xl text-slate-800 dark:text-white tracking-tight">Â© 2026 Flow Finance</p>
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400 mt-1">Todos os direitos reservados</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">DeclaraÃ§Ã£o de Propriedade</h4>
              <p>O software Flow Finance, incluindo mas nÃ£o se limitando a sua arquitetura, cÃ³digo-fonte (frontend e backend), algoritmos, design de interface (UI), experiÃªncia do usuÃ¡rio (UX), logotipos, Ã­cones e textos, Ã© propriedade intelectual exclusiva de seus desenvolvedores.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">RestriÃ§Ãµes de Uso</h4>
              <p>Ã‰ estritamente proibida a cÃ³pia, reproduÃ§Ã£o, engenharia reversa, descompilaÃ§Ã£o, distribuiÃ§Ã£o ou criaÃ§Ã£o de obras derivadas de qualquer parte deste software sem a autorizaÃ§Ã£o expressa e por escrito dos detentores dos direitos autorais.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">Tecnologias e LicenÃ§as</h4>
              <p>Este projeto foi desenvolvido utilizando tecnologias modernas como React, TypeScript, Vite e Tailwind CSS. As bibliotecas de cÃ³digo aberto utilizadas neste projeto sÃ£o regidas por suas respectivas licenÃ§as (MIT, Apache 2.0, etc.), e seus crÃ©ditos sÃ£o devidamente reconhecidos.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wide text-xs">Marca Registrada</h4>
              <p>"Flow Finance" e o logotipo do Flow sÃ£o marcas comerciais. O uso indevido destas marcas Ã© passÃ­vel de aÃ§Ã£o legal.</p>
            </div>

            <div className="pt-4 text-center">
              <p className="text-[10px] font-mono text-slate-400">Build Version: 2.4.0-stable (2026)</p>
              <p className="text-[10px] font-mono text-slate-400">Engine: Komodo Flow Core v3</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              {type === 'privacy_terms' && <ShieldCheck size={20} />}
              {type === 'copyright' && <Copyright size={20} />}
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white uppercase tracking-tight">{getTitle()}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {getContent()}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <button onClick={onClose} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium uppercase tracking-wide transition-colors shadow-lg shadow-indigo-500/20">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;




