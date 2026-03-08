import React from 'react';
import { X, ShieldCheck, FileText, Copyright } from 'lucide-react';

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
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">1. Introdução</h4>
              <p>Bem-vindo ao Flow Finance. Ao utilizar nosso aplicativo, você concorda com estes Termos de Uso e nossa Política de Privacidade. Estes documentos regem a relação entre você (o "Usuário") e o Flow Finance (a "Plataforma").</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">2. Privacidade e Dados</h4>
              <p><strong>2.1. Coleta Mínima:</strong> Coletamos apenas os dados essenciais para o funcionamento do serviço: endereço de e-mail para autenticação e os dados financeiros que você insere voluntariamente.</p>
              <p><strong>2.2. Proteção: ⚠️ IMPORTANTE:</strong> Na versão atual (0.1.0 Prototype), os dados financeiros são armazenados LOCALMENTE no seu dispositivo e SÃO CRIPTOGRAFADOS usando Web Crypto API (AES-GCM-256). Dados sincronizados com servidor devem usar HTTPS/TLS. Nunca compartilharemos dados com terceiros.</p>
              <p><strong>2.3. Perspectiva de Segurança:</strong> Em versões futuras será implementado armazenamento em servidor com criptografia end-to-end. Por enquanto, os dados residem apenas no seu dispositivo local.</p>
              <p><strong>2.4. Não-Compartilhamento:</strong> Seus dados financeiros são seus. Não vendemos, alugamos ou compartilhamos suas informações pessoais ou financeiras com terceiros para fins de marketing.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">3. Uso do Serviço</h4>
              <p><strong>3.1. Responsabilidade:</strong> O Flow Finance é uma ferramenta de gestão. Não oferecemos consultoria financeira, legal ou tributária. As decisões tomadas com base nos dados do app são de sua inteira responsabilidade.</p>
              <p><strong>3.2. Conduta:</strong> É proibido utilizar a plataforma para atividades ilícitas, fraudulentas ou que violem direitos de terceiros.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">4. Propriedade Intelectual</h4>
              <p>Todo o design, código-fonte, logotipos e textos são propriedade exclusiva do Flow Finance ou de seus licenciadores, protegidos pelas leis de direitos autorais vigentes.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">5. Alterações</h4>
              <p>Reservamo-nos o direito de atualizar estes termos periodicamente. O uso contínuo do serviço após as alterações constitui aceitação dos novos termos.</p>
            </div>
            
            <p className="text-xs text-slate-400 pt-4">Última atualização: Fevereiro de 2026</p>
          </div>
        );
      case 'copyright':
        return (
          <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-700">
              <p className="font-black text-2xl text-slate-800 dark:text-white tracking-tighter">© 2026 Flow Finance</p>
              <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">Todos os direitos reservados</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">Declaração de Propriedade</h4>
              <p>O software Flow Finance, incluindo mas não se limitando a sua arquitetura, código-fonte (frontend e backend), algoritmos, design de interface (UI), experiência do usuário (UX), logotipos, ícones e textos, é propriedade intelectual exclusiva de seus desenvolvedores.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">Restrições de Uso</h4>
              <p>É estritamente proibida a cópia, reprodução, engenharia reversa, descompilação, distribuição ou criação de obras derivadas de qualquer parte deste software sem a autorização expressa e por escrito dos detentores dos direitos autorais.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">Tecnologias e Licenças</h4>
              <p>Este projeto foi desenvolvido utilizando tecnologias modernas como React, TypeScript, Vite e Tailwind CSS. As bibliotecas de código aberto utilizadas neste projeto são regidas por suas respectivas licenças (MIT, Apache 2.0, etc.), e seus créditos são devidamente reconhecidos.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wide text-xs">Marca Registrada</h4>
              <p>"Flow Finance" e o logotipo do Flow são marcas comerciais. O uso indevido destas marcas é passível de ação legal.</p>
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
              {type === 'privacy' && <ShieldCheck size={20} />}
              {type === 'terms' && <FileText size={20} />}
              {type === 'copyright' && <Copyright size={20} />}
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{getTitle()}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {getContent()}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <button onClick={onClose} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-wide transition-colors shadow-lg shadow-indigo-500/20">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
