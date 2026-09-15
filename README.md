# OptiLoad 3D 🚛📦

OptiLoad 3D é uma aplicação web para otimização e visualização de empacotamento de cargas (3D Bin Packing Problem). Ele permite que os usuários configurem as dimensões de baús de caminhões, adicionem caixas (manualmente ou via importação JSON) e utilizem um motor matemático para calcular a disposição espacial ideal das caixas, maximizando o volume utilizado e evitando sobreposições.

## 🛠️ Tecnologias Utilizadas

**Frontend:**
* [React](https://reactjs.org/) (via Vite)
* [Three.js](https://threejs.org/) & [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/) (Renderização 3D)
* CSS Modules (Estilização isolada)

**Backend:**
* [Python 3](https://www.python.org/)
* [FastAPI](https://fastapi.tiangolo.com/) (API REST de alta performance)
* Algoritmo *Branch and Bound* com detecção de colisão (AABB)

---

## 🚀 Como Executar o Projeto Localmente

Para rodar a aplicação, você precisará iniciar o servidor do Backend (Python) e o servidor do Frontend (React) simultaneamente em dois terminais separados.

### Pré-requisitos
* [Node.js](https://nodejs.org/) (Versão 16+ recomendada)
* [Python](https://www.python.org/downloads/) (Versão 3.8+ recomendada)

---

### Passo 1: Configurando o Backend (Motor de Otimização)

1. Abra um terminal na pasta raiz onde se encontra o arquivo `main.py`.
2. Crie um ambiente virtual para isolar as dependências:
   ```bash
   python -m venv venv
   ```
3. Ative o ambiente virtual:
   * **Windows:**
     ```bash
     venv\Scripts\activate
     ```
   * **Linux / macOS:**
     ```bash
     source venv/bin/activate
     ```
4. Instale as bibliotecas necessárias:
   ```bash
   pip install fastapi "uvicorn[standard]" pydantic
   ```
5. Inicie o servidor da API:
   ```bash
   uvicorn main:app --reload
   ```
   *O backend estará rodando em `http://localhost:8000`.*

---

### Passo 2: Configurando o Frontend (Interface Web)

1. Abra um **novo** terminal na pasta raiz do projeto React (onde está localizado o `package.json`).
2. Instale as dependências do Node.js:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse a aplicação no seu navegador através do link gerado no terminal (geralmente `http://localhost:5173` ou `http://localhost:3000`).

---

## 🎮 Como Usar

1. **Adicionar Caminhão:** Clique no botão flutuante `+` para criar um novo baú, definindo Largura (X), Altura (Y) e Comprimento (Z).
2. **Adicionar Caixas:** Com o caminhão selecionado, clique em "Adicionar" no painel lateral. Você pode inserir caixas manualmente ou importar um arquivo `.json` com uma lista de caixas.
3. **Otimizar Carga:** Clique no botão **"Organizar Carga (Auto-Pack)"**. O frontend enviará os dados para o backend em Python, que calculará a melhor posição matemática para cada caixa.
4. **Visualização:** Utilize o mouse para rotacionar (clique e arraste), dar zoom (scroll) ou mover a câmera. Ajuste a barra de "Altura de Corte" para inspecionar as camadas internas da carga.

---

## 🧠 Sobre o Algoritmo

O motor de organização utiliza uma variação do algoritmo de **Maximização de Volume em Bin 3D**. Ele opera gerando coordenadas de "cantos de envelope" 3D e realiza uma busca exata do tipo *Branch and Bound*. Para garantir o desempenho em uma aplicação web, o algoritmo implementa:
* **Detecção de Colisão AABB** para impedir a sobreposição de volumes.
* **Mecanismo de Poda (Pruning)** para descartar ramos matematicamente ineficientes.
* **Timeout de Segurança** para retornar a melhor solução encontrada caso a explosão combinatória ultrapasse o tempo limite, garantindo que a interface não trave.