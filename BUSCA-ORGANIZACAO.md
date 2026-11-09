# Revisão da busca de organização

Objetivo: maximizar volume transportado; em empate, quantidade. Para objetos compostos, os desempates seguintes favorecem centro de massa baixo, equilíbrio lateral e menor distância das primeiras entregas à porta. Peso, capacidade acumulada dos apoios, estabilidade e retirada são restrições obrigatórias.

A busca testa quatro ordenações e dois modos de posicionamento, guarda alternativas para até 12 itens e reencaixa árvores de apoio completas. Uma tentativa nunca substitui a melhor disposição se piorar o objetivo. O tempo de busca padrão continua em 8 segundos; não há garantia de ótimo global.

## Comparação local — baú 2,4 × 2,4 × 6 m

| Arquivo | Antes | Depois | Volume depois (m³) | Validação |
|---|---:|---:|---:|---|
| carga_carreto_variada.json | 16 | 16 | 5.001 | Válida |
| carreto_volume_dominante.json | 20 | 21 | 21.401 | Válida |
| carreto_com_objeto_azul.json | 21 | 21 | 21.444 | Válida |

Resultados de uma execução local com o mesmo orçamento de busca; o tempo disponível e a máquina podem alterar os caminhos explorados. Testes de regressão adicionais verificam reencaixe, capacidade somada em uma pilha e sequência de entrega.

Limites mantidos: apoio integral em um único objeto, rota de retirada em +Z, densidade uniforme por peça e rotações horizontais. Curvas usam contornos conservadores e não suportam carga por cima. Freadas/curvas de objetos compostos continuam sem avaliação; esta revisão não adiciona dados de resistência, atrito, eixos do caminhão ou amarração.
