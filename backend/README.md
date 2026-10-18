# Motor de empacotamento e diagnóstico de transporte

Na raiz do repositório:

```sh
python -m uvicorn backend.main:app --reload
python -B -m unittest discover -s backend -p "test_*.py" -v
```

## Busca

`main.py` mantém a API. `search.py` implementa composição de colunas por subconjuntos de alturas, busca em feixe (32 disposições candidatas) e remoção/reconstrução de pilhas. Não consulta arquivos de referência e não interpreta nomes ou cores das caixas. Quatro ordenações gulosas continuam como alternativas iniciais.

O objetivo é, nesta ordem: quantidade, volume, menos ocorrências de tombamento nos cenários de transporte e menor momento vertical do peso. Como solicitado, a necessidade de contenção não exclui caixas. O orçamento aproximado de busca é de oito segundos, dividido entre as fases. Uma validação em andamento e o diagnóstico final podem ultrapassar esse tempo. A solução permanece heurística, sem prova de ótimo global.

## Geometria, peso e descarga

- Unidades: metros e quilogramas; X largura, Y altura, Z comprimento. Piso em Y=0, fundo em Z=0, porta em Z=truck_d.
- Caixas rígidas e homogêneas, com centro de massa geométrico. Giro horizontal opcional, sem mudar a altura.
- Caixa elevada exige um único apoio, cobrindo integralmente a base. Não aceita pontes entre várias caixas.
- Centro de massa da subpilha estritamente dentro do contato; pesos e momentos acumulados chegam até o chão.
- A caixa de cima não pode ser mais pesada que sua base. `max_load` limita, separadamente, todo o peso acima da caixa; ausente significa capacidade não informada.
- Menor `delivery_order` sai primeiro, com retirada reta em +Z e caixas superiores saindo antes da base. Prioridade compara corredores sobrepostos, sem exigir distância globalmente ordenada entre corredores independentes.
- Retirar contrapesos não pode desestabilizar as caixas restantes.

## Freadas e curvas

`transport.py` faz análise quase-estática de inércia em cada interface caixa/piso e caixa/caixa. Considera toda a massa acima do apoio e a altura do centro de massa combinado relativa a esse apoio.

Para acelerações adimensionais `ax` e `az` em unidades de g:

- Deslizamento: força horizontal = massa × g × sqrt(ax² + az²). O atrito disponível é μ × massa × g.
- Tombamento: o ponto necessário para a reação normal fica em `(x_cm + ax × altura_cm, z_cm + az × altura_cm)`. Fora do contato, ou na borda marginal, há risco.
- Calcula também a demanda adicional de força horizontal e momentos em cada interface. Esses valores NÃO equivalem ao dimensionamento de cintas: faltam geometria, ângulos, capacidade e pré-tensão. Não somar interfaces da mesma pilha.

Cenários: frenagem rumo ao fundo (-Z), aceleração rumo à porta (+Z), curvas nos dois sentidos de X e, por padrão, combinações longitudinal/lateral. A avaliação é repetida após cada entrega, quando o caminhão volta a circular.

Parâmetros opcionais no corpo de `POST /api/optimize`:

```json
"transport": {
  "braking_g": 0.8,
  "lateral_g": 0.5,
  "rearward_g": 0.5,
  "floor_friction": 0.3,
  "box_friction": 0.3,
  "combined_maneuvers": true,
  "rigid_walls": true,
  "rear_door_closed": true
}
```

Estes são os padrões. Os coeficientes 0,8/0,5/0,5 são uma referência de cenários da [Diretiva europeia 2014/47, Anexo III](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32014L0047), e não uma declaração de conformidade brasileira. O atrito 0,3 é uma hipótese explícita, não uma medição ou valor universal. Combinar os máximos simultaneamente é uma opção conservadora do simulador, não uma exigência atribuída à diretiva.

Por padrão, paredes e porta fechada são idealizadas como rígidas e resistentes (`rigid_walls=true`, `rear_door_closed=true`). Não se presume a presença de cintas. A resistência real de paredes e embalagens não foi informada nem dimensionada. Não há simulação temporal, impacto, deformação, suspensão, carga por eixo ou tombamento do veículo. A análise diz onde falta contenção no modelo; não certifica transporte seguro. Os parâmetros são configuráveis pela API; a interface atual mostra os valores usados, mas não tem editor desses parâmetros.

## Contrato e interface

`GET /api` retorna o estado do serviço. `POST /api/optimize` recebe `truck_w`, `truck_h`, `truck_d`, `boxes` e o objeto opcional `transport`. Cada caixa exige `id`, `width`, `height`, `depth`, `color`; `weight` padrão 10, `delivery_order` padrão 1, `max_load` opcional e `allow_rotation` padrão true. Valores inválidos retornam HTTP 422.

A resposta preserva `packed_boxes`, metadados e `max_volume` (nome legado do volume encontrado). Também retorna `packed_count`, `unpacked_boxes`, `volume_utilization`, `unloading_order`, `search_truncated`, `search_details` e `optimality_proven=false`.

`transport_assessment` inclui hipóteses, IDs afetados e ocorrências por apoio e etapa de entrega. Cada ocorrência lista cenários de deslizamento/tombamento e demandas adicionais em N e N·m. `after_delivery=null` indica a carga inicial; um número indica o trecho após aquela entrega.

O painel “Freadas e curvas” mostra as hipóteses e permite selecionar cada caixa que encabeça uma subpilha com risco. Caixas que precisam de contenção permanecem visíveis. O diagnóstico é invalidado ao adicionar/remover caixas ou mudar dimensões. Caixas não acomodadas ficam na resposta, com sua quantidade no painel; a interface ainda substitui a lista visual pelas caixas acomodadas.

## Verificação e referência

35 testes cobrem API, geometria, apoio, torque acumulado, descarga, atrito vetorial, frenagem, curvas, transmissão de inércia até o piso, parâmetros, reparação e busca sem IDs semânticos. Build do frontend e lint do componente alterado verificados. O comando genérico de lint do projeto também percorre dependências em node_modules e apresenta problemas fora do componente alterado.

No desafio de 63 caixas (60 possíveis): antes 46 caixas / 63,75%; após a mudança, 58 / 97,22%, em aproximadamente 8,10 segundos na execução registrada. A solução de referência de 60 caixas continua sendo um alvo estático; nenhuma dessas taxas comprova contenção adequada durante o transporte. Veja `testes/carga_desafio/resultado_melhorado.json`.


## Contato direcional com paredes e caixas

O diagnóstico agora reconhece bloqueio em −X, +X, −Z e +Z separadamente. Um contato só exerce compressão: encostar à esquerda não impede o movimento à direita. A porta oferece apoio apenas quando `rear_door_closed=true`; `rigid_walls=false` desativa todo o crédito para paredes e, consequentemente, para cadeias de vizinhos.

Uma cadeia de caixas só recebe crédito quando há contato sem folga até uma parede. A face lateral inteira precisa estar coberta; vários vizinhos podem cobri-la em conjunto. Uma caixa baixa não elimina o risco de tombamento de uma caixa alta, e uma folga não é tratada como encosto. Esse critério é conservador: apoios parciais não recebem crédito, mesmo que alguns pudessem resistir com dimensões e resistência adequadas.

Para cada massa da pilha, a componente de inércia bloqueada é absorvida pelo contato idealizado. As componentes não bloqueadas continuam na verificação de atrito e momentos de cada apoio. O modelo não atribui proteção automática às caixas superiores porque apenas a base está encostada. Não resolve forças de contato ou resistência à compressão: o crédito é geométrico, condicionado à hipótese de paredes e caixas rígidas/resistentes.

A avaliação é refeita após as entregas, removendo os vizinhos já descarregados. `initial_affected_box_ids` identifica riscos na saída; `after_delivery_affected_box_ids` identifica riscos em trechos posteriores. `affected_box_ids` continua sendo a união. O painel separa os momentos e informa as manobras com risco.

Regressão: as 60 caixas da solução de referência, sem folgas e preenchendo o baú, não recebem avisos na saída; 45 podem receber avisos depois das entregas, quando os espaços abertos removem parte dos apoios. Isso não comprova a resistência estrutural do baú. Uma disposição diferente, com espaços ou apoios parciais, ainda pode apresentar muitos avisos corretamente.


## Baús de dimensões variadas

A busca compara colunas limitadas a 60%, 80% e 100% da altura do baú. Uma caixa individual mais alta que o limite exploratório pode continuar no piso, desde que caiba no caminhão. A altura útil inteira deixou de ser a única composição de pilha avaliada.

Toda caixa elevada agora exige base integralmente apoiada (tolerância numérica relativa de 1e-9). Antes, 60% eram suficientes quando o centro de massa passava no teste; isso permitia balanços que agora são rejeitados. A verificação de torque acumulado continua existindo. Antes de retornar a solução, uma validação independente da geração confere IDs, limites, colisões, suporte, peso e sequência de descarga.

Nos casos informados, usando carga_desafio.json, foram observadas 61 caixas em 3x3x6 e 62 em 4x4x6, com topo das pilhas elevadas até 2,4 m (antes 3 m e 4 m). A caixa individual FORA-altura tem 0,4 x 2,5 x 0,4 m e cabe nesses baús, portanto continua podendo aparecer no piso com um alerta dinâmico legítimo. FORA-base também passa a caber em alguns caminhões maiores. Os nomes dessas caixas indicavam inviabilidade apenas para o caminhão original 2,4x2,4x6.

A resposta inclui static_stability.validated e minimum_base_support=1.0. O painel separa initial_tipping_box_ids de initial_sliding_box_ids; equilíbrio estático não elimina deslizamento com o atrito presumido. Não foram reduzidas arbitrariamente acelerações nem aumentados coeficientes de atrito para apagar avisos. O modo continua mostrando cargas que exigem contenção, conforme solicitado.
