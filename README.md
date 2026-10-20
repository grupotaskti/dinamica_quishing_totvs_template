# Dinâmica de conscientização sobre quishing

Aplicação demonstrativa com interface inspirada no TOTVS Linha RM, formulário de acesso simulado e painel de métricas locais. Destinada exclusivamente a exercícios autorizados de conscientização. Não é um serviço de autenticação e não integra o TOTVS, Active Directory ou banco CorporeRM.

> **Estado atual:** protótipo com persistência no navegador. Publicar no Azure não transforma as métricas locais em uma base centralizada. A página de métricas não possui autenticação no código analisado. Revisar os bloqueadores de publicação antes de expor a aplicação.

## 2. O que a aplicação faz

1. Ao abrir a tela principal, executa `AccessTracker.init()`, registra uma visita no armazenamento local e coleta atributos disponibilizados pelo navegador.
2. Gera um identificador local composto por hash de atributos e sufixo aleatório, persistido em `localStorage`.
3. Consulta `/api/client-info` para informações de rede. Se essa consulta falhar, tenta um serviço externo de IP público.
4. Valida no navegador se usuário e senha estão preenchidos.
5. Ao submeter um formulário válido, registra localmente horário, usuário parcialmente mascarado e status de teste. O fluxo analisado não envia a senha ao servidor nem a persiste no tracker; ela é lida e permanece no campo/variável durante o fluxo da página. Isso não equivale a uma garantia de eliminação da memória.
6. Após aproximadamente 350 ms, redireciona para o portal corporativo definido em `js/app.js`.
7. Exibe registros locais em `metricas.html`, com exportação CSV/JSON, simulação de dispositivos e reset.

O seletor de ambiente é lido pelo formulário, mas não aciona conexão com banco ou autenticação real.

## 3. Arquitetura e limites de persistência

```text
Navegador
  ├── HTML / CSS / JavaScript
  ├── localStorage: identificador, visitas, registros e tentativas
  ├── BroadcastChannel / evento storage: atualização entre abas
  └── GET /api/client-info
          ↓
      Node.js (HTTP nativo)
          ├── serve arquivos do diretório do projeto
          └── responde informações de rede e do host servidor

Opcional no ambiente local:
Navegador → Nginx :8080 → Node.js :3000
```

**Não há endpoint de gravação de métricas nem banco de dados no servidor analisado.** O painel aberto pelo organizador não recebe automaticamente os acessos de outros participantes.

O registro pertence ao armazenamento do navegador e à origem utilizada. Não existe mecanismo de sincronização entre computadores no código. Trocar de navegador, perfil, domínio, protocolo ou porta pode resultar em outro conjunto de registros. A limpeza do armazenamento remove os registros locais. O identificador não comprova identidade de máquina física e pode mudar; o hash simples não é um identificador criptográfico ou garantia de unicidade.

`BroadcastChannel` e o evento `storage` atualizam abas que compartilham o contexto de armazenamento aplicável; não são um canal de telemetria central.

## 4. Mapa de arquivos

```text
dinamica_quinshing/
├── index.html                 # Formulário público
├── metricas.html              # Painel local, sem autenticação implementada
├── dados-maquinas.html        # Redirecionamento para metricas.html
├── server.js                  # HTTP nativo, arquivos estáticos e client-info
├── package.json               # Metadados e scripts npm
├── README.md                  # Este documento
├── js/
│   ├── fingerprint.js         # DeviceInfo: atributos, ID e consulta de rede
│   ├── tracker.js             # AccessTracker: persistência e contadores
│   ├── app.js                 # Formulário, atalhos e redirecionamento
│   └── metricas.js            # Renderização, exportação e ações do painel
├── css/
│   ├── style.css              # Referenciado por index.html; não inspecionado
│   └── metricas.css           # Referenciado por metricas.html; não inspecionado
└── assets/
    └── img/                   # Logotipos, ícones e favicon referenciados
```

A configuração Nginx é externa ao projeto na instalação local informada: `C:\nginx-1.30.6\conf\nginx.conf`. O arquivo Nginx enviado anteriormente é um bloco `server` para inclusão dentro de `http`, não uma configuração completa independente. Conferir o arquivo efetivamente instalado: o bloco enviado usa porta 80, enquanto o teste local posterior foi orientado para 8080.

Os HTMLs analisados referenciam `js/`, não `assets/js/`. Se os scripts forem movidos para `assets/js/`, atualizar os caminhos nos dois HTMLs.

## 5. Dependências e requisitos

### Servidor

- Node.js e npm para usar os scripts do pacote.
- Módulos nativos utilizados: `http`, `fs`, `path`, `os` e `dns`. O módulo `dns` é importado, mas não é utilizado no código analisado.
- Nenhuma dependência npm externa declarada no manifesto enviado.
- Nenhuma etapa de build ou bundler declarada.
- Nenhuma versão mínima de Node.js definida em `engines`. **Sugestão de implantação:** selecionar uma versão LTS suportada pelo destino e registrar a versão efetivamente validada.
- Nginx é opcional e executado separadamente; não é instalado pelo npm.

### Navegador e serviços externos

- JavaScript e acesso a `localStorage` são necessários para o fluxo de métricas.
- `BroadcastChannel` é opcional; há tratamento de indisponibilidade e listener de `storage`.
- Canvas 2D é usado no fingerprint, com fallback quando indisponível.
- Google Fonts é referenciado pelos HTMLs.
- `api.ipify.org` é consultado como fallback para IP público em `fingerprint.js`.
- Links externos do portal e do rodapé estão em `index.html`; o redirecionamento final está em `app.js`.

Revisar a necessidade dessas conexões externas antes de publicar. Não há SDK do Azure nem integração de identidade Microsoft no código recebido.

## 6. Execução local no Windows

No PowerShell:

```powershell
Set-Location "C:\Users\RafaelLuizdaSilva\Projetos\dinamica_quinshing"
node --version
npm --version
npm start
```

Alternativa equivalente:

```powershell
node .\server.js
```

Acessar [página inicial local](http://localhost:3000) e [painel local](http://localhost:3000/metricas.html).

Manter o processo em execução. Para encerrar no terminal, usar `Ctrl+C`. Não é necessário instalar bibliotecas externas para o manifesto analisado.

### Alterar a porta

O servidor usa `process.env.PORT || 3000`.

```powershell
$env:PORT = "3001"
npm start
```

Nesse caso, ajustar o destino do proxy e acessar a porta correspondente. O código não carrega arquivo `.env` automaticamente.

### Abertura direta do HTML

Não usar a abertura via `file://` como validação de implantação: ela não executa o servidor nem disponibiliza `/api/client-info`. O frontend pode tentar o fallback externo, mas isso não reproduz o fluxo completo.

## 7. Scripts npm

| Comando | Implementação | Efeito real |
| --- | --- | --- |
| `npm start` | `node server.js` | Inicia o servidor HTTP |
| `npm test` | `node -e` com `console.log` | Apenas imprime uma mensagem de sucesso; não executa testes reais |

Não há scripts declarados de build, desenvolvimento com recarga, lint, deploy ou migração. A mensagem de `npm test` não comprova funcionamento ou segurança.

## 8. Páginas e endpoint

| Caminho | Comportamento |
| --- | --- |
| `/` | Serve `index.html` |
| `/index.html` | Formulário simulado |
| `/metricas.html` | Painel de registros locais |
| `/dados-maquinas.html` | Redireciona via HTML para o painel |
| `/api/client-info` | Retorna JSON com dados de rede e do servidor |

### Acesso ao painel

O `app.js` oferece duplo clique ou três cliques no logotipo do rodapé, `Ctrl+Shift+M` ou `F2`. Também é possível acessar o caminho diretamente. Esses atalhos **não constituem autenticação ou autorização**.

### Semântica de client-info

- `rawIp`: cabeçalho `X-Forwarded-For`, quando presente, ou endereço remoto do socket.
- `ip`: valor derivado do anterior; para conexão identificada como local, pode substituir pelo IP LAN do servidor e acrescentar indicação local.
- `hostname`: para acesso local usa o hostname do servidor; para remoto monta o texto `Host (...)` a partir do endereço recebido.
- `osHostname`, `platform` e `lanIp`: descrevem o **servidor Node.js**, não o dispositivo remoto.

O endpoint não faz resolução DNS reversa do cliente. Não documentar o hostname exibido como hostname real da máquina visitante. O cabeçalho de encaminhamento é aceito sem validação de proxy confiável e pode conter múltiplos endereços; precisa ser revisto antes de usar o IP como evidência confiável.

## 9. Responsabilidade dos módulos JavaScript

### fingerprint.js — DeviceInfo

- `collectData()`: SO inferido, navegador, resolução, viewport, DPR, profundidade de cor, idioma, fuso, CPU lógica, memória aproximada quando disponível, touch, estado online e hashes.
- `getMachineId()`: recupera ou cria ID no armazenamento local.
- `fetchNetworkInfo()`: consulta endpoint local, fallback externo e, por último, valores locais de contingência.

As informações são atributos reportados pelo navegador ou inferências simples, não inventário autenticado de hardware. O detector de navegador verifica Chrome antes de Opera, podendo classificar Opera como Chrome.

### tracker.js — AccessTracker

- `init()`: registra acesso e consulta informações de rede.
- `recordTest()`: incrementa contador e guarda usuário mascarado, horário e status; limita o histórico a 50 registros.
- `getStats()`: devolve contadores e registros locais.
- `subscribe()`: notifica a interface sobre alterações.
- `simulateNewMachine()`: adiciona registro sintético marcado `isSimulated` e incrementa visitas.
- `resetAll()`: remove registros e ID locais e registra imediatamente um novo acesso; o resultado não permanece zerado.

O contador de tentativas pode superar 50, embora o histórico mantenha apenas as últimas 50 entradas. O horário das tentativas não inclui uma data completa. O cronômetro começa no carregamento do módulo e não é uma medição consolidada da campanha.

### app.js

Inicializa o tracker, configura atalhos, visibilidade de senha, aviso de Caps Lock, validação de campos, feedback visual, registro de teste e redirecionamento.

**Inconsistência observada:** existe um listener para navegar ao Google adicionado dentro do handler de submit, depois de desabilitar o botão. O fluxo explícito de navegação continua sendo o temporizador para o portal corporativo. Remover o listener redundante e manter um único destino aprovado é uma recomendação, não uma alteração realizada nesta documentação.

### metricas.js

Inicializa o tracker, renderiza tabelas, atualiza o cronômetro, exporta arquivos e executa simulação/reset. Abrir o painel também registra uma visita, pois chama `AccessTracker.init()`.

O JSON inclui contadores, máquinas e histórico de tentativas. O CSV exporta registros de máquinas, não o histórico de tentativas. As exportações refletem apenas os dados disponíveis naquele navegador/origem.

**Inconsistência observada:** o painel tenta exibir DPR, CPU e memória, mas o tracker não persiste esses campos no registro de máquina criado. Assim, a interface pode mostrar valores padrão ou ausência de dados, mesmo quando `collectData()` os disponibiliza.

## 10. Chaves de armazenamento local

| Chave | Conteúdo |
| --- | --- |
| `quinshing_machine_id` | ID persistido no navegador |
| `quinshing_machines_registry` | Registros de dispositivos reais e simulados |
| `quinshing_total_visits` | Contador de visitas |
| `quinshing_tests_count` | Contador de tentativas |
| `quinshing_tests_history` | Histórico limitado a 50 tentativas |

`quinshing_session_start` aparece como constante, mas não é usada para persistir o início da sessão no fluxo analisado.

Não usar a expressão “anonimização garantida”: o usuário é parcialmente mascarado e os registros incluem atributos e identificadores. Definir finalidade, acesso, retenção e descarte antes da campanha. Usar somente dados fictícios nos testes e não solicitar credenciais reais.

## 11. Onde alterar cada comportamento

| Necessidade | Local |
| --- | --- |
| Textos, campos, opções e links auxiliares | `index.html` |
| Aparência da tela principal | `css/style.css` |
| Redirecionamento após formulário | `js/app.js`, temporizador do submit |
| Validação e feedback do formulário | `js/app.js` |
| Atributos coletados e fallback de IP | `js/fingerprint.js` |
| Persistência, máscara e contadores | `js/tracker.js` |
| Colunas, exportação e ações do painel | `metricas.html` e `js/metricas.js` |
| Aparência do painel | `css/metricas.css` |
| Endpoint de rede, arquivos estáticos e porta | `server.js` |
| Comandos npm | `package.json` |
| Proxy local | Configuração externa do Nginx |

A ordem dos scripts nos HTMLs deve preservar `fingerprint.js`, depois `tracker.js`, depois o controlador da página.

## 12. Nginx local

O Nginx não substitui o Node.js. Ambos precisam estar ativos quando o acesso passa pelo proxy.

Na instalação local informada:

```powershell
Set-Location "C:\nginx-1.30.6"
.\nginx.exe -t
```

Após validação bem-sucedida, iniciar, se ainda não estiver em execução:

```powershell
Start-Process -FilePath "C:\nginx-1.30.6\nginx.exe" -WorkingDirectory "C:\nginx-1.30.6"
```

Após alterar a configuração, validar novamente e então recarregar:

```powershell
.\nginx.exe -t
.\nginx.exe -s reload
```

Não executar reload se o teste falhar. Para encerrar de forma controlada:

```powershell
.\nginx.exe -s quit
```

Se o listener configurado for `127.0.0.1:8080`, acessar [aplicação pelo Nginx](http://127.0.0.1:8080). A [porta 3000](http://127.0.0.1:3000) acessa diretamente o Node.js.

O projeto não lê automaticamente um arquivo `nginx.conf` colocado na raiz. Confirmar o arquivo ativo com `nginx.exe -t`. Para acesso externo, a configuração local precisa de desenho de publicação e segurança específico.

## 13. Handoff para implantação no Azure

Esta seção é um checklist proposto, não um procedimento validado de um serviço Azure específico. O destino ainda precisa ser definido: VM, serviço gerenciado ou outro modelo. Não há infraestrutura como código, pipeline, contêiner ou configuração de deploy no material recebido.

### Informações para o responsável

- Entrada do processo: `server.js`.
- Comando de inicialização: `npm start`.
- Build: não declarado; aplicação utiliza arquivos estáticos e Node.js nativo.
- Porta: variável de ambiente `PORT`, com fallback 3000.
- Banco: não implementado.
- Métricas: persistidas no cliente, não no disco da VM nem em banco Azure.
- Autenticação administrativa: não implementada.
- Segredos e integração com identidade: não implementados no código recebido.
- Saúde: não há endpoint dedicado de health check.
- Logs: mensagens de inicialização no console; não há auditoria estruturada de eventos da campanha.

### Decisões e validações antes do deploy

1. Escolher o serviço de hospedagem e validar seu runtime, porta e comando de inicialização na documentação oficial do destino.
2. Definir domínio, HTTPS, acesso administrativo e rede. Não presumir que o Nginx Windows local será necessário no destino.
3. Definir se a campanha exige consolidação entre participantes. Se exigir, implementar API de ingestão, persistência central e painel autenticado antes de considerar a solução funcional para esse objetivo.
4. Restringir arquivos públicos, corrigir tratamento de caminhos e revisar os dados expostos por `client-info`.
5. Configurar processo supervisionado, reinício, logs e monitoramento conforme a plataforma escolhida.
6. Validar os cabeçalhos recebidos do proxy real e a política de confiança de IP.
7. Definir retenção, descarte, autorização da campanha e uso dos elementos visuais.
8. Executar os testes manuais abaixo e registrar o resultado; o script npm de teste não cobre essas verificações.

## 14. Bloqueadores e recomendações de segurança

**Observado no código:**

- O diretório público é `__dirname`. O servidor tenta servir qualquer arquivo existente nesse diretório e subdiretórios, inclusive arquivos de código/configuração que estejam ali. Não há lista explícita de arquivos públicos.
- O painel não exige autenticação.
- O controle de caminhos usa apenas `startsWith(PUBLIC_DIR)`, sem validação robusta de limite de diretório. A decodificação da URL não tem tratamento de exceção no trecho analisado.
- `client-info` expõe hostname, plataforma e IP LAN do servidor e aceita `X-Forwarded-For` sem validação.
- As respostas configuram CORS com origem `*`.
- O painel interpola valores em `innerHTML`, inclusive dados vindos de armazenamento e informações de rede, sem escape explícito nesses trechos.
- O CSV concatena valores sem rotina completa de escape e sem neutralização explícita de fórmulas.
- Não há limitação de requisições, autenticação administrativa ou cabeçalhos de segurança implementados no servidor recebido.

**Recomendações antes da exposição:**

- Criar diretório público separado e servir apenas recursos necessários.
- Autenticar e autorizar acesso administrativo no servidor; esconder atalhos não protege rotas.
- Usar dados fictícios e não coletar senhas reais.
- Revisar renderização para usar texto seguro e sanitização contextual quando necessária.
- Corrigir escape/neutralização das exportações e testar valores adversos.
- Restringir CORS ao necessário e reduzir a resposta de rede ao mínimo.
- Validar URLs e caminhos, tratar erros e revisar confiança de proxy.
- Aplicar HTTPS, limites, cabeçalhos e gestão de logs no desenho de publicação.

Estas são recomendações; nenhuma foi aplicada ao código por esta atualização de README.

## 15. Checklist de validação manual

- [ ] `npm start` inicia sem erro e informa a porta esperada.
- [ ] Página inicial, CSS, JS e imagens carregam sem 404.
- [ ] `/api/client-info` responde e os campos são interpretados conforme sua semântica real.
- [ ] Formulário vazio apresenta validação e não registra tentativa válida.
- [ ] Com dados fictícios, a tentativa é registrada com usuário mascarado.
- [ ] A inspeção de rede confirma ausência de envio de senha no fluxo aprovado.
- [ ] O redirecionamento leva somente ao destino aprovado.
- [ ] O painel exibe os registros do mesmo navegador/origem.
- [ ] Abrir outro navegador não é confundido com consulta de uma base central.
- [ ] Exportações CSV/JSON são verificadas e identificam registros simulados.
- [ ] Reset remove registros anteriores e cria o novo acesso esperado.
- [ ] Abertura do painel e recarga são consideradas na interpretação de visitas.
- [ ] Recursos administrativos exigem autorização após a implementação desse controle.
- [ ] Arquivos de código, configuração e dados privados não podem ser baixados publicamente após a correção.
- [ ] O fluxo funciona atrás do proxy e com a porta do destino escolhido.

## 16. Troubleshooting

| Sintoma | Verificação |
| --- | --- |
| 502 no Nginx | Confirmar Node.js ativo e destino/porta de `proxy_pass`; consultar `logs/error.log` |
| Painel mostra apenas um navegador | Comportamento atual de persistência local, não falha de banco |
| Dados desaparecem ao mudar endereço | Verificar mudança de origem, navegador/perfil ou limpeza de armazenamento |
| Hostname não corresponde ao visitante | Endpoint retorna hostname do servidor ou rótulo montado, não hostname remoto real |
| CPU/RAM/DPR ausentes | Tracker não persiste todos os campos coletados |
| Visitas aumentam ao abrir painel | `metricas.js` também chama `AccessTracker.init()` |
| Teste npm passa sem validar nada | Script atual apenas imprime mensagem |
| Script não carrega | Conferir `js/` versus `assets/js/`, nomes e extensões reais |
| Reset deixa um registro | `resetAll()` registra novo acesso imediatamente |

## 17. Licença e identidade visual

O manifesto declara `MIT`, mas um arquivo de licença não foi apresentado para revisão. Essa declaração não comprova autorização de uso de marcas, logotipos ou outros materiais de terceiros. Confirmar as permissões e a identificação da campanha antes da publicação.
 