# OptiLoad 3D 🚛📦

**Otimização inteligente de cargas com visualização 3D.**

O OptiLoad 3D é uma aplicação web para planejar o carregamento de caminhões. Você informa as dimensões do baú e os objetos a transportar (com peso, ordem de entrega e quanto peso cada um aguenta por cima). Um motor de otimização em Python calcula onde cada objeto deve ficar, e o resultado aparece em uma cena 3D interativa.

É um problema de **3D Bin Packing** com restrições logísticas: além de não sobrepor objetos, a disposição precisa ser fisicamente estável e permitir descarregar na ordem das entregas.

🔗 **Aplicação publicada:** https://optiload3d.vercel.app

> Projeto acadêmico da disciplina de Computação Gráfica (UNASP).

---

## ✨ Funcionalidades

- **Vários caminhões na mesma cena**, cada um com largura, altura e comprimento próprios.
- **Objetos prontos**: caixa, mesa, cadeira, sofá, cama, geladeira, fogão, máquina de lavar, tambor, bola, saco e prisma poligonal.
- **Editor de objetos personalizados**: monte formas compostas de até 24 peças (bloco, esfera/oval, cilindro e prisma), movendo, redimensionando e girando (90°) cada peça direto na cena 3D.
- **Restrições logísticas** por objeto: peso, ordem de entrega, carga máxima sobre ele e permissão de giro horizontal.
- **Organização automática** (`Organizar Carga`): sem sobreposição, com apoio integral, limite de peso por pilha, centro de massa baixo e retirada em ordem pela porta.
- **Diagnóstico de transporte**: aponta risco de deslizamento e tombamento em freadas e curvas (para cargas só de caixas).
- **Visualização 3D**: rotação, zoom, seleção de objetos e **corte de altura** para inspecionar as camadas internas.
- **Organizações salvas no banco de dados** (salvar, substituir, abrir e excluir), além de **importação/exportação em JSON** e **exportação da vista em PNG**.

## 🛠️ Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, Vite, JavaScript/JSX, CSS Modules, Three.js, React Three Fiber, Drei |
| Backend | Python 3.12, FastAPI, Pydantic, Uvicorn |
| Banco de dados | SQLite (local) ou PostgreSQL (produção, via `DATABASE_URL`) |
| Deploy | Vercel (frontend estático + função Python em `api/index.py`) |

## 📁 Estrutura do repositório

```text
optiload3d/
├── api/index.py          # Ponto de entrada da função Python na Vercel
├── backend/
│   ├── main.py           # API FastAPI e motor para caixas simples
│   ├── search.py         # Busca em feixe por colunas/pilhas
│   ├── compound.py       # Motor para objetos compostos e formas curvas
│   ├── shapes.py         # Catálogo de formas e validação de peças
│   ├── transport.py      # Diagnóstico de freadas e curvas
│   ├── storage.py        # Organizações salvas (SQLite/PostgreSQL)
│   └── test_*.py         # Testes do backend
├── frontend/
│   └── src/
│       ├── pages/        # Página principal com a cena 3D
│       ├── components/   # Caminhão, objetos, editor, modais e painéis
│       └── utils/        # Normalização de cargas, modelagem e arquivos
├── exemplos/             # Cargas prontas para importar (veja abaixo)
└── vercel.json
```

---

## 🚀 Como executar localmente

Pré-requisitos: **Python 3.12+** e **Node.js 20+**.

São dois processos: a API (porta 8000) e o frontend (porta 5173). O Vite já encaminha as chamadas para `/api` para a porta 8000.

### 1. Backend (na raiz do repositório)

```bash
python -m venv backend/venv

# Windows
backend\venv\Scripts\activate
# Linux / macOS
source backend/venv/bin/activate

pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload
```

A API fica em `http://localhost:8000` (documentação interativa em `http://localhost:8000/docs`). Sem `DATABASE_URL`, as organizações salvas vão para um SQLite local em `backend/data/`.

### 2. Frontend (em outro terminal)

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`.

---

## 🎮 Como usar

1. **Adicionar caminhão:** clique em `+` e informe largura (X), altura (Y) e comprimento (Z) em metros.
2. **Adicionar objetos:** com o caminhão selecionado, escolha um tipo pronto, crie um objeto no editor ou **importe um JSON** (veja `exemplos/`).
3. **Ajustar propriedades:** peso (kg), ordem de entrega e carga máxima sobre o objeto (kg).
4. **Organizar:** clique em **Organizar Carga (Auto-Pack)**. Objetos que não couberem ficam listados no painel e entram de novo na próxima tentativa.
5. **Inspecionar:** arraste para girar, use a roda do mouse para zoom e a barra **Altura de Corte** para ver as camadas internas.
6. **Salvar/exportar:** clique em **Salvar / Exportar** no topo do painel lateral. No modal, dê um nome e clique em **Salvar no banco**; se o nome já existir, o sistema pergunta se deve substituir. Para reabrir ou apagar, escolha na lista **Organizações salvas** e clique em **Abrir** ou **Excluir**. Também é possível exportar/abrir a cena em JSON e exportar a vista em PNG.

## 📦 Cargas de exemplo

A pasta [`exemplos/`](exemplos) tem cargas prontas para importar em um caminhão de **2,4 × 2,4 × 6 m**:

| Arquivo | Objetos | O que demonstra |
| --- | ---: | --- |
| [`01_ecommerce_entregas.json`](exemplos/01_ecommerce_entregas.json) | 21 | Só caixas, três paradas. As cores indicam a entrega (🟩 1, 🟨 2, 🟦 3) e o vermelho marca itens frágeis, que não recebem peso por cima. A entrega 1 fica mais perto da porta. |
| [`02_moveis.json`](exemplos/02_moveis.json) | 5 | Objetos compostos: mesa (5 peças), duas cadeiras (6 peças), caixa e um banco personalizado. |
| [`03_mudanca_residencial.json`](exemplos/03_mudanca_residencial.json) | 17 | Mudança completa: eletrodomésticos, sofá, cama, formas curvas (tambor, bola, saco), prisma hexagonal e caixas. |
| [`04_carga_excedente.json`](exemplos/04_carga_excedente.json) | 40 | Cerca de 48 m³ de paletes para um baú de 34,56 m³. Parte da carga fica de fora e aparece como não acomodada. |

## 🧾 Formato do JSON de carga

O arquivo é uma **lista de objetos** (ou um único objeto). Medidas em **metros**, pesos em **quilogramas**.

```json
[
  {
    "id": "caixa-1",
    "name": "Caixa média",
    "shape": "box",
    "width": 0.6, "height": 0.5, "depth": 0.5,
    "weight": 15,
    "delivery_order": 1,
    "max_load": 60,
    "allow_rotation": true,
    "color": "#2ecc71"
  }
]
```

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `id` | recomendado | Identificador único. Se faltar, o frontend gera um. |
| `width`, `height`, `depth` | sim | Dimensões externas (X, Y, Z), maiores que zero. |
| `shape` | não | `box` (padrão), `table`, `chair`, `sofa`, `bed`, `fridge`, `stove`, `washer`, `drum`, `sphere`, `bag`, `polygon` ou `custom`. |
| `weight` | não | Peso em kg (padrão 10). |
| `delivery_order` | não | Inteiro ≥ 1. Menor valor sai primeiro (padrão 1). |
| `max_load` | não | Peso máximo (kg) aceito acima do objeto. `0` impede empilhar. Vazio em caixas significa "não informado". |
| `allow_rotation` | não | Permite giro horizontal; a altura nunca muda (padrão `true`). |
| `color` | não | Cor de exibição em hexadecimal. |
| `name` | não | Nome exibido na interface. |
| `parts` | só em `custom` | Peças do objeto: `x`, `y`, `z`, `width`, `height`, `depth`, `kind` (`box`, `ellipsoid`, `cylinder`, `prism`), `sides` (3–12, prismas) e `yaw` (0–3 quartos de volta). As peças começam em (0,0,0), coincidem com as dimensões externas, não se sobrepõem e precisam estar conectadas. |

Formas com peças curvas ou poligonais nunca recebem carga por cima, mesmo que `max_load` seja maior que zero.

## 🧠 Sobre o algoritmo

**Sistema de coordenadas:** X é a largura, Y a altura e Z o comprimento. O piso fica em Y = 0, o fundo do baú em Z = 0 e a porta em Z = comprimento.

O motor é uma **heurística com tempo limitado** (cerca de 8 segundos):

1. Testa quatro ordenações gulosas (por entrega, peso e volume) e dois modos de posicionamento.
2. Para caixas, monta pilhas/colunas por **busca em feixe** e depois remove e reconstrói pilhas para tentar melhorar o resultado.
3. Objetos compostos e curvos usam um motor próprio (`compound.py`), com contornos conservadores por peça.

A melhor disposição é escolhida, nesta ordem, por: **maior volume transportado**, **mais objetos**, **menos casos de tombamento** nos cenários de transporte e **centro de massa mais baixo**.

Toda solução precisa respeitar estas restrições:

- sem sobreposição;
- apoio integral em um único objeto;
- `max_load` respeitado por toda a pilha acima;
- objeto de cima não mais pesado que sua base;
- retirada em linha reta pela porta (+Z) na ordem das entregas.

Não há prova de ótimo global. Hipóteses físicas, limites e o contrato da API estão em [`backend/README.md`](backend/README.md).

## 🧪 Testes

```bash
# Backend (na raiz, com o venv ativo)
python -B -m unittest discover -s backend -p "test_*.py"

# Frontend
node --test frontend/src/utils/*.test.js
cd frontend && npm run lint && npm run build
```

> ⚠️ Alguns testes de regressão leem fixtures em `testes/` (`carga_desafio/`, `formatos_referencia.json`, `carga_carreto_variada.json`, `carga_moveis.json`, `carreto_com_objeto_azul.json`). Essa pasta ainda não está versionada; sem ela, esses testes falham com `FileNotFoundError`.

## ☁️ Deploy

O projeto é publicado na Vercel a partir da raiz do repositório. O passo a passo, incluindo o banco PostgreSQL, está em [`PUBLICAR-VERCEL.md`](PUBLICAR-VERCEL.md).

## 📚 Documentação adicional

- [`backend/README.md`](backend/README.md): motor, física, diagnóstico de transporte e API.
- [`OBJETOS-COMPOSTOS.md`](OBJETOS-COMPOSTOS.md): mesas, cadeiras e formas personalizadas.
- [`EDITOR-VISUAL.md`](EDITOR-VISUAL.md): editor por mouse e primitivas curvas.
- [`BUSCA-ORGANIZACAO.md`](BUSCA-ORGANIZACAO.md): revisão da busca e resultados comparativos.

## 👥 Equipe

Artur Farias Salomão · Bartolomeu Gomes Rabelo Neto · Octávio França Koch · Pedro Ribeiro de Oliveira · Victória Ester de Oliveira Jesus
