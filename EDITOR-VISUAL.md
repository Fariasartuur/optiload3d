# Modelagem 3D — interface atual

A área central agora é uma cena 3D interativa. O antigo desenho por vistas Frente/De cima/Lado foi removido. A biblioteca e os modelos prontos permanecem no estúdio em tela cheia.

- Clique na peça para selecionar; use Mover e arraste as setas X/Y/Z.
- Em Redimensionar, arraste os quadrados dos eixos para alterar largura, altura ou profundidade. O controle central escala as três dimensões.
- Arraste o fundo para orbitar, use a roda para zoom e o botão direito para deslocar a câmera. Enquadrar objeto recupera a visão da montagem.
- Esferas novas têm 0,50 m nos três diâmetros. Os campos e controles independentes permitem criar ovais.
- Arrastar um cartão da biblioteca para a cena coloca a nova peça no piso. Clique no cartão para anexar à peça selecionada.
- Cada gesto concluído entra no histórico de desfazer/refazer. Os limites continuam conservadores por contornos retangulares, inclusive para curvas; o modelo precisa estar conectado para concluir.

Validação: 15 testes de geometria/importação do frontend; build e lint dos arquivos alterados; teste manual no navegador dos três eixos da esfera, desfazer/refazer, seleção em 3D e inclusão na carga. Captura: `testes/editor-modelagem-3d.png`.

As seções abaixo registram versões anteriores da interface.

---

# Editor visual e carga variada

## Criar usando o mouse

1. Selecione um caminhão e clique em **Adicionar objeto**.
2. Escolha um formato pronto ou **Criar meu objeto**. Qualquer formato pronto pode ser aberto no editor visual.
3. Na barra de ferramentas, escolha **Bloco**, **Esfera / oval**, **Cilindro** ou **Polígono**. Clique e arraste na área quadriculada para desenhar. A espessura na terceira direção fica no painel lateral.
4. Em **Selecionar / mover**, arraste a peça. Puxe os quatro cantos para redimensionar. Troque entre **Frente**, **De cima** e **Lado** para trabalhar nas três direções.
5. Use **Duplicar**, **Girar 90°**, **Excluir peça**, **Desfazer** e **Refazer**. A grade pode ser desligada; o encaixe pelas bordas continua ativo. A prévia 3D permite selecionar peças e girar a câmera.
6. Encoste as peças pelas bordas. O limite físico bloqueia sobreposição durante desenho, arraste, redimensionamento, rotação, duplicação e ajustes precisos. O arraste verifica também o trajeto entre eventos do mouse, impedindo atravessar peças com movimentos rápidos. A mensagem abaixo do editor indica contato ou peças separadas. As coordenadas estão em **Ajustes precisos (opcional)**.
7. Informe peso e entrega, depois adicione à carga. O editor ajusta automaticamente a origem e calcula as dimensões totais.

Atalhos dentro do editor: Delete exclui a seleção; Ctrl+Z desfaz; Ctrl+Shift+Z refaz; Escape cancela o gesto. Até 24 peças por objeto e 40 ações de histórico. O histórico dura enquanto o editor permanece aberto.

## Biblioteca

Caixa/armário, mesa, cadeira, sofá, cama, geladeira, fogão, máquina de lavar, tambor, bola/esfera, saco cheio e prisma poligonal. São modelos simplificados e dimensionáveis. Geladeira e lavadora usam o volume externo, sem mecanismos internos. Sacos usam um oval e não têm deformação física simulada.

Primitivas: `box`, `ellipsoid`, `cylinder`, `prism`. Cilindros e prismas ficam verticais. `sides` aceita 3 a 12; `yaw` aceita 0 a 3 quartos de volta no eixo vertical. Alterar as proporções de um prisma produz uma versão escalada da seção regular. As propriedades geométricas acompanham importação, organização, salvamento e PNG.

## Testar o algoritmo

Importe **`testes/carga_carreto_variada.json`**, uma lista de 16 objetos, em um caminhão de **2,4 × 2,4 × 6 m** e clique em **Organizar Carga**. Também é útil comparar com 3 × 3 × 6 m ou reduzir o comprimento para observar objetos não acomodados.

A carga inclui sofá, cama, geladeira, fogão, lavadora, mesa, duas cadeiras, tambor, bola, saco, prisma hexagonal, duas caixas, uma mesa redonda composta e um prisma triangular personalizado. Há três ordens de entrega e pesos diferentes. Não é uma prova de ótimo: a busca continua heurística e limitada em tempo.

## Limites físicos desta etapa

- Para blocos, permanece a colisão exata entre paralelepípedos e a verificação de apoio já existente.
- Para curvas e polígonos, o algoritmo usa **contornos retangulares de proteção por peça**. Isso impede interpenetração, mas não explora todos os vãos entre superfícies curvas. Não é um empacotamento exato de esferas/polígonos.
- Objetos com base arredondada (esfera/oval na base) ficam no piso. Cilindros e prismas de base plana podem ficar sobre um apoio integral, respeitando peso, capacidade e entrega. Objetos com peças curvas/poligonais não recebem outros objetos sobre si, mesmo se `max_load` vier maior que zero. A API devolve `max_load: 0` e explica a restrição.
- O volume material e o centro de massa levam em conta esferas/ovais, cilindros e prismas escalados, com densidade uniforme. Os contornos são usados para colisão, retirada e aproximação dos contatos; as conexões internas do objeto são presumidas rígidas.
- Com curvas na carga, `static_stability.validated` é falso e a interface informa que rolamento, apoio curvo e deformação não foram validados. `packing_geometry` é `conservative_part_envelopes`. A posição pode ser exibida sem ser apresentada como certificação de estabilidade.
- Freadas e curvas continuam indisponíveis para objetos compostos.

## Verificação automatizada

```powershell
.\backend\venv\Scripts\python.exe -B -m unittest discover -s backend -p 'test_*.py' -q
node --test frontend/src/utils/cargo.test.js frontend/src/utils/modeling.test.js
npm.cmd run build --prefix frontend
```

Os testes novos cobrem projeção dos gestos nas três vistas, encaixe, normalização da origem, rotações, primitivas, massa/centro de massa, compatibilidade entre catálogos, importação e persistência. `testes/formatos_referencia.json` é a referência de geometria dos modelos para verificar a equivalência frontend/backend.


## Carga com volume dominante

`testes/carreto_volume_dominante.json` contém 21 itens para um baú de 2,4 × 2,4 × 6 m: uma cabine de estande embalada (2,3 × 2,2 × 3,5 m, 420 kg), eletrodomésticos, dois cilindros, cadeira, saco, bola e 12 caixas de mudança. Trata-se de um carreto comercial com um volume principal, e não só pequenas caixas.

O volume principal representa 17,71 m³, aproximadamente 51,2% dos 34,56 m³ do baú. Ele sai na entrega 3; os itens menores saem na entrega 1. No teste local de oito segundos, a busca acomodou 20/21 itens, incluindo o principal, com aproximadamente 61,7% de volume material ocupado. A bola ficou de fora. O resultado é heurístico; não é prova de impossibilidade para o item restante.

Os itens não acomodados agora permanecem em `unpackedBoxes`, são listados no painel e voltam à próxima tentativa de organização, inclusive após alterar as dimensões do caminhão. Não são mais perdidos ao substituir a cena pelos itens acomodados.

A correção de cilindros tem teste específico: um baú de 1 × 2 × 1 m com a caixa de apoio ocupando todo o piso e um cilindro de 1 × 1 × 1 m. O cilindro é colocado sobre a caixa e retirado primeiro. Esferas continuam sem empilhamento. Colisões de curvas ainda usam contornos retangulares de proteção.

## Revisão: volume e biblioteca visual

O solver de objetos compostos compara primeiro o volume efetivamente transportado, depois a quantidade de objetos e o centro de massa. Reserva 25% do tempo para tentar inserir os itens restantes na melhor disposição. Não prova otimalidade e mantém as verificações de colisão, apoio e retirada.

`testes/carreto_com_objeto_azul.json` contém 22 itens, incluindo a cabine grande e uma montagem azul de três blocos iguais (dois girados perpendicularmente). É uma reprodução aproximada: as dimensões do objeto original não foram fornecidas. O teste de regressão exige a presença dos dois objetos e uma disposição válida.

O editor oferece biblioteca à esquerda (clique para anexar, arraste para posicionar), desenho ao centro e prévia/propriedades à direita. A etapa Dados da carga reúne peso e entrega. As peças continuam limitadas pelos contornos físicos conservadores; precisam estar conectadas para salvar.
