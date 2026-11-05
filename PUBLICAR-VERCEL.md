# Publicação do OptiLoad na Vercel

Projeto existente: https://optiload3d.vercel.app

## O que já está preparado no código

- Frontend Vite e API FastAPI no mesmo projeto/domínio.
- Build e saída definidos em `vercel.json`; `/api` e `/api/*` encaminhados para `api/index.py`.
- Função com duração máxima configurada de 60 segundos, para acomodar a busca e suas verificações.
- Python 3.12 em `.python-version` e driver PostgreSQL nas dependências.
- PostgreSQL selecionado por `DATABASE_URL` ou `POSTGRES_URL`. Sem conexão remota, SQLite continua funcionando somente fora da Vercel.
- Não há fallback para SQLite ou `/tmp` na Vercel, mesmo que `OPTILOAD_DB_PATH` esteja definido.
- TLS obrigatório em produção; conexão fechada por requisição, compatível com URL de pooler.
- A tabela `layouts` é criada automaticamente no primeiro acesso. O usuário do banco precisa de permissão para criar tabela no schema padrão. Uma trava transacional impede a criação inicial simultânea por funções distintas.
- Snapshots limitados a 4 MB, deixando margem para o envelope da requisição dentro do limite da plataforma.
- Banco local, ambientes virtuais, node_modules, segredos e arquivos de teste excluídos do upload da CLI pela `.vercelignore`.

## 1. Criar e conectar o PostgreSQL

No painel da Vercel, abra o projeto associado a **optiload3d.vercel.app**. Na área **Storage / Marketplace**, crie um banco **Neon (Postgres)** e conecte-o ao projeto. Confira o plano/custos apresentados antes de confirmar a contratação.

Escolha uma região próxima da função da Vercel. Se houver opção de conexão com pooling, use a URL com pooler. Complete a autorização da integração na sua própria conta.

Em **Settings → Environment Variables**, confirme uma variável chamada **DATABASE_URL**, com a conexão PostgreSQL fornecida pela integração. `POSTGRES_URL` também é aceita pelo código. Se a integração tiver usado outro prefixo, adicione `DATABASE_URL` com o mesmo valor pelo painel. Não envie a senha no chat e não use prefixo `VITE_`.

A URL deve preservar os parâmetros de TLS do provedor, por exemplo `sslmode=require`. Selecione o ambiente **Production**. Para testar previews, configure também **Preview**, preferencialmente com um banco/branch separado.

## 2. Atualizar o projeto existente

Envie as alterações locais ao repositório/branch que o projeto da Vercel utiliza. Essa etapa não foi executada automaticamente: existem alterações locais do trabalho em andamento e não foi confirmado qual branch é o de produção.

No projeto da Vercel, use a **raiz do repositório**, que contém `vercel.json`, `api/`, `backend/` e `frontend/`. Não configure Root Directory como `frontend`, pois isso deixaria o backend fora da publicação.

Configuração preparada no arquivo:

| Campo | Valor |
| --- | --- |
| Framework Preset | Other (framework null no arquivo) |
| Root Directory | raiz do repositório |
| Install Command | npm ci --prefix frontend |
| Build Command | npm run build --prefix frontend |
| Output Directory | frontend/dist |

Remova overrides conflitantes no painel. Faça um novo deploy depois de configurar o banco: variáveis adicionadas depois de um deploy só ficam disponíveis no próximo.

## 3. Verificar o deploy

1. Abra `https://optiload3d.vercel.app/api`: deve responder `{"status":"online"}`.
2. Abra `https://optiload3d.vercel.app/api/layouts`: deve responder com uma lista JSON, inicialmente vazia. Esta chamada também inicializa a tabela.
3. No site, crie um caminhão e uma caixa, salve uma organização, recarregue e reabra a versão salva.
4. Teste o botão de organizar e a exportação PNG. O PNG continua sendo gerado no navegador, sem depender do banco.
5. Abra o site em outro navegador para confirmar que o registro veio do banco remoto.

Se `/api/layouts` retornar 503, confira a variável de conexão, a permissão do usuário do banco e a existência de um deploy novo. O erro retornado ao navegador não expõe credenciais. Se a página funcionar mas `/api` retornar 404, confira Root Directory e overrides de build.

## Escopo dos dados e acesso

O banco remoto começa separado do SQLite local: organizações já salvas neste computador não são migradas automaticamente. Mantenha o arquivo local como backup. A implementação atual é compartilhada, sem login: todos que acessam a aplicação podem listar, abrir e salvar organizações. Use cargas de demonstração; isolamento por grupo/usuário exigiria autenticação.

## Validação executada

O driver PostgreSQL foi instalado no ambiente virtual e os testes verificam seleção do banco, TLS, placeholders parametrizados e falhas sem fallback para arquivo local. O fluxo SQLite permanece coberto. Ainda é necessário testar uma conexão real após criar o banco e realizar um deploy: testes com conexão simulada não comprovam acesso ao Neon.

## Referências oficiais

- [Python na Vercel](https://vercel.com/docs/functions/runtimes/python)
- [Configuração de projetos](https://vercel.com/docs/project-configuration/vercel-json)
- [PostgreSQL pelo Marketplace](https://vercel.com/docs/postgres)
- [Limites de funções](https://vercel.com/docs/functions/limitations)
- [Driver Psycopg](https://www.psycopg.org/psycopg3/docs/basic/install.html)
