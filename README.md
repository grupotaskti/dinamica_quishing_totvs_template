# TOTVS Linha RM - Interface de Acesso & Usabilidade

Aplicação web frontend moderna inspirada na tela de boas-vindas do **TOTVS Linha RM**, desenvolvida com **HTML5, CSS3 e JavaScript puro**. O projeto tem como foco o aprendizado prático de **usabilidade**, **responsividade multiplataforma**, **reaproveitamento dos dados disponibilizados pelo dispositivo** do usuário e **contabilização de acessos únicos por máquina**.

---

## 🎨 Identidade Visual & Cores Utilizadas

A paleta e os elementos visuais foram baseados estritamente na interface oficial e nas especificações informadas:

- **Boas-vindas (Subtítulo)**: `#29b6c5`
- **Botão de "Acessar"**: `#0C9ABE`
- **Fundo dos campos (Inputs e Select)**: `#FBFBFB`
- **Texto e Links do Rodapé**: `#0E547E`
- **Linha RM (Título Principal)**: `#636b73` (Cinza institucional leve)
- **Logotipos e Ícones Oficiais**:
  - `totvs_logo.png` (cabeçalho)
  - `totvs_cinza.png` (rodapé)
  - `icon_pessoa.png` (campo de usuário/e-mail)
  - `icon_cadeado.png` (campo de senha)
  - `icon_dados.png` (seletor de base CorporeRM)

---

## 🚀 Como Executar a Aplicação

A aplicação não necessita de nenhuma dependência externa! Você pode executá-la de duas formas:

### Opção 1: Servidor Local Node.js (Recomendado)
No terminal, dentro da pasta do projeto (`c:\Users\RafaelLuizdaSilva\Projetos\dinamica_quinshing`):
```bash
npm start
# ou
node server.js
```
Em seguida, acesse no navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

### Opção 2: Abertura Direta
Abra o arquivo `index.html` diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).

---

## 💡 Recursos de Usabilidade Implementados

1. **Visibilidade de Senha**: Botão interativo para revelar e ocultar a senha com ícone dinâmico e suporte a leitor de telas.
2. **Detector de Caps Lock**: Alerta visual instantâneo avisando caso a tecla Caps Lock esteja ativada ao digitar a senha.
3. **Validação Inline em Tempo Real**: Feedback visual em caso de campos não preenchidos, com remoção do erro assim que o usuário digita.
4. **Navegação por Teclado (WCAG)**: Contornos de foco evidentes (`focus-visible`), suporte a `Tab` e submissão com `Enter`.
5. **Notificações Toast**: Feedback animado ao submeter o formulário, recuperar senha ou clicar nos links.
6. **Alternador de Responsividade na Barra Superior**:
   - **Fluido**: Ajusta livremente com a largura da tela.
   - **Desktop**: Simula a visualização desktop aberta (conforme imagem 1).
   - **Mobile**: Enquadra o formulário em moldura de celular 390px (conforme imagem 2).

---

## 🖥️ Dados da Máquina & Contabilização de Acessos

### 1. Dados Coletados do Dispositivo
A aplicação extrai e apresenta em tempo real (no painel retrátil e na barra superior):
- Sistema Operacional e Versão
- Navegador e Engine
- Resolução física da tela vs. Viewport ativo (com atualização ao vivo no redimensionamento)
- Densidade de Pixels (`devicePixelRatio`) e Profundidade de Cores
- Idioma local e Fuso Horário
- Núcleos de CPU e Estimativa de Memória RAM
- Suporte a Touchscreen vs. Teclado/Mouse
- Status da Conexão (Online / Offline)
- Impressão digital gráfica via **Canvas Fingerprint**

### 2. Diferenciação Máquina a Máquina
- **Identificador Único Persistente**: Cada máquina recebe um ID baseado na combinação do seu hardware/ambiente com persistência local.
- **Regra de Contabilização**:
  - Se a **mesma máquina** recarregar a página ou abrir novas abas:
    - O número de **visitas totais** incrementa.
    - O número de **máquinas únicas permanece 1**!
  - Uma nova máquina só incrementa a contagem de **máquinas únicas** se for um dispositivo novo.
- **Sincronização em Tempo Real**: Usa `BroadcastChannel` para manter todas as abas abertas sincronizadas automaticamente.
- **Ferramentas de Teste no Painel**:
  - ➕ **Simular Nova Máquina**: Permite simular a entrada de novos computadores para ver o contador de máquinas únicas subindo.
  - ⚡ **Preencher Dados de Teste**: Popula o formulário com dados válidos de teste.
  - 🗑️ **Resetar Métricas**: Reinicia o contador para novos ciclos de experimento.

---

## 📁 Estrutura de Pastas

```
dinamica_quinshing/
├── index.html              # Estrutura semântica HTML5
├── server.js               # Servidor local Node.js
├── package.json            # Scripts de execução
├── README.md               # Documentação completa
├── css/
│   ├── style.css           # Estilos principais da tela e responsividade
│   └── dashboard.css       # Estilos da gaveta de métricas e KPIs
├── js/
│   ├── fingerprint.js      # Identificação de máquina e dados do dispositivo
│   ├── tracker.js          # Lógica de contabilização de acessos e testes
│   └── app.js              # Controlador de interface e usabilidade
└── assets/
    └── img/
        ├── icon_cadeado.png
        ├── icon_dados.png
        ├── icon_pessoa.png
        ├── totvs_cinza.png
        └── totvs_logo.png
```
