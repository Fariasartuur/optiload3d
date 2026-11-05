> Atualização: o editor por mouse, as primitivas curvas e suas restrições estão em [EDITOR-VISUAL.md](EDITOR-VISUAL.md). As instruções abaixo descrevem a primeira versão com peças retangulares.

# Objetos compostos: mesas, cadeiras e formas personalizadas

## Experimentar na aplicação

1. Adicione e selecione um caminhão.
2. Em **Adicionar objeto**, escolha Caixa, Mesa, Cadeira ou Personalizado.
3. Informe dimensões em metros, peso total em kg, ordem de entrega e carga suportada sobre o objeto.
4. Para mudar pés, assento, encosto ou tampo, use **Personalizar pés, tampo e demais peças**. Cada peça tem dimensões e posição local X/Y/Z. A prévia acompanha a edição.
5. Clique em **Organizar Carga (Auto-Pack)**. Salvar organizações e exportar PNG também preservam/exibem os novos objetos.

Exemplo importável: `testes/carga_moveis.json`. Experimente um caminhão de 2,4 × 2,4 × 6 m. Contém mesa, duas cadeiras, caixa e banco personalizado.

## Representação e compatibilidade

Os campos antigos `boxes` e `packed_boxes` continuam na API por compatibilidade. Cada registro agora pode representar um objeto inteiro. `shape` aceita `box` (padrão), `table`, `chair` ou `custom`.

`parts` descreve até 24 paralelepípedos rígidos, com `x`, `y`, `z`, `width`, `height`, `depth`, relativos à origem do objeto. Não são caixas independentes: giram, se movem e são retirados juntos. Não podem se sobrepor; precisam formar uma estrutura conectada por faces. Os limites das peças devem corresponder às dimensões externas e começar em (0,0,0).

Mesas e cadeiras sem `parts` recebem um modelo proporcional às dimensões externas. Quando `parts` é fornecido, a geometria explícita é preservada — inclusive após uma rotação ou salvamento. Caixas antigas continuam válidas.

## Organização e física

- Cargas só com caixas usam a busca anterior. Cargas com peças usam `backend/compound.py`, com quatro ordens de tentativa e rotações horizontais de 0°, 90°, 180° e 270°. A busca é heurística, limitada em tempo, sem garantia de ótimo global.
- Colisões são verificadas entre peças. Os vãos ficam livres, inclusive abaixo de tampos e assentos. Pontos de colocação são gerados a partir das faces das peças.
- Todas as faces inferiores mais baixas (pés ou base) devem ficar integralmente apoiadas no piso ou em um único objeto. Apoios distribuídos por objetos independentes não são aceitos nesta versão.
- O centro de massa é calculado pelo volume das peças, supondo densidade uniforme. O peso acumulado e seus momentos são propagados aos apoios. A projeção do centro de massa deve ficar estritamente dentro do polígono convexo formado pelos contatos.
- O limite `max_load` é cumulativo. Para objetos compostos, ausência de limite significa **zero**, impedindo empilhamento até o usuário informar capacidade. Para caixas, o comportamento anterior de limite não informado foi mantido.
- Objetos mais pesados não são colocados sobre apoios mais leves. Um objeto apoiado deve sair até a entrega do seu apoio.
- A retirada é reta na direção +Z. O volume percorrido por cada peça deve estar livre; o algoritmo verifica a ordem de entrega e revalida o apoio após cada retirada.
- `max_volume` e `volume_utilization` usam o volume material das peças, não o volume externo que inclui vãos. Um móvel vazado pode ocupar uma área grande e ter baixo volume material.

São aproximações por peças retangulares, em pé. Não há importação de malhas livres, superfícies curvas, deformação, desmontagem nem rotações que deitem o móvel. A resistência interna das peças/conexões não é calculada. A simulação de freadas e curvas para cargas compostas retorna `not_evaluated`; o modelo antigo de caixas maciças não é aplicado a móveis vazados.

## Verificação

```powershell
.\backend\venv\Scripts\python.exe -B -m unittest discover -s backend -p 'test_*.py' -q
node --test frontend/src/utils/cargo.test.js
npm.cmd run build --prefix frontend
```

`backend/test_compound.py` cobre aproveitamento do vão, colisão com pés, caminho de saída, centro de massa assimétrico, apoio sobre assento/tampo, limite de peso, falta de apoio, rotação, validação e persistência. Inclui caminhões de 2,4, 3 e 4 metros de largura/altura.
