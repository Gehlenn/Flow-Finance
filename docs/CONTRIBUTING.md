# Guia de Contribuição e Manutenção

Para garantir que a documentação do projeto **Flow Finance** permaneça sempre atualizada e útil, seguimos rigorosamente as diretrizes abaixo.

## 🔄 Política de Atualização Contínua

Toda alteração no código que impacte a arquitetura, o fluxo de dados ou a interface do usuário **DEVE** ser acompanhada de uma atualização correspondente na documentação.

### Regra de Ouro
> **"Se não está documentado, não existe."**

### Checklist de Pull Request / Commit

Antes de finalizar qualquer tarefa, verifique:

1.  **Novos Arquivos:** Se você criou novos arquivos ou pastas, execute o script de atualização automática:
    ```bash
    npm run docs:update
    ```
    Isso atualizará a árvore de arquivos no `README.md`.

2.  **Novas Funcionalidades:**
    -   Adicione uma breve descrição na seção "Funcionalidades" do `README.md`.
    -   Se houver mudança no fluxo de dados, atualize o diagrama no `ARCHITECTURE.md`.

3.  **Alteração de Dependências:**
    -   Se adicionou uma nova biblioteca, explique o motivo no `README.md` (seção Arquitetura Técnica).

4.  **Variáveis de Ambiente:**
    -   Se criou uma nova variável, adicione-a ao `.env.example` e explique seu uso no `README.md`.

## 🛠️ Ferramentas de Automação

### Script de Atualização da Estrutura (`docs:update`)

Criamos um script personalizado para manter a seção "Estrutura de Pastas" do README sempre sincronizada com o projeto real.

**Como usar:**
```bash
npm run docs:update
```

**O que ele faz:**
1.  Lê a estrutura atual de diretórios do projeto.
2.  Ignora arquivos irrelevantes (`node_modules`, `.git`, etc.).
3.  Gera uma árvore de texto formatada.
4.  Substitui automaticamente o bloco de código na seção `## 📂 Estrutura de Pastas` do `README.md`.

---

## 📝 Padrões de Documentação

### README.md
Deve ser o ponto de partida para qualquer pessoa. Mantenha-o conciso e focado em:
-   O que é o projeto?
-   Como rodar?
-   Como testar?

### ARCHITECTURE.md
Destinado a desenvolvedores que precisam entender o funcionamento interno.
-   Use diagramas (Mermaid) sempre que possível.
-   Explique o "porquê" das decisões técnicas.

### Comentários no Código
-   Use JSDoc para funções complexas.
-   Evite comentários óbvios (ex: `// const x = 1; // define x como 1`).
-   Explique a intenção do código, não o que ele faz (o código já diz o que faz).
