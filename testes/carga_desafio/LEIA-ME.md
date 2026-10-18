# Carga de desafio — referência conhecida

## Como usar na interface

1. Crie um caminhão vazio com largura **2,4**, altura **2,4** e comprimento **6**. Use ponto decimal se o campo exigir.
2. Em Adicionar Caixa > Importar JSON, selecione `carga_desafio.json`.
3. Clique em Organizar Carga (Auto-Pack).
4. Para repetir o teste, esvazie a carga e importe novamente o arquivo original. A interface remove da lista as caixas não colocadas; organizar novamente apenas o resultado anterior não repete este teste.

O arquivo é uma lista de caixas, no formato aceito pelo importador atual. As dimensões do caminhão são configuradas separadamente. As coordenadas iniciais são zero: a sobreposição antes de organizar é esperada.

## O que está sendo testado

São 63 caixas: 60 com solução conhecida e 3 propositalmente impossíveis. A ordem foi embaralhada com semente fixa 20261018.

- Entrega 1: vermelho; entrega 2: laranja; entrega 3: verde; entrega 4: azul. Menor número sai primeiro.
- Pesos de 90, 35 e 8 nas caixas viáveis, com diferentes alturas, larguras e profundidades.
- Parte das dimensões está invertida no plano horizontal para exercitar rotação.
- As combinações entre tamanho, peso e prioridade dificultam a seleção gulosa e produzem espaços residuais.
- `FORA-altura`: altura 2,5, superior à altura interna 2,4.
- `FORA-base`: base 2,5 x 2,5, maior que a largura em qualquer giro permitido.
- `FORA-comprimento`: lado 6,1, superior tanto à largura quanto ao comprimento do caminhão.

As três caixas pretas precisam ficar de fora. Não são necessários campos opcionais que o frontend não encaminha.

## Referência e métricas

`solucao_referencia.json` contém uma disposição factível das 60 caixas: volume 34,56, ocupação 100%, pesos decrescentes nas pilhas e quatro faixas de entrega ao longo do comprimento. As caixas têm apoio integral em uma única base. A disposição foi validada quanto a colisão, limites, apoio, equilíbrio e ordem de descarga pelo backend. A construção em faixas e colunas também permite conferência geométrica direta.

Como as outras três caixas não cabem individualmente, 60 é o máximo possível neste conjunto. Assim, este teste permite medir a qualidade da solução, além do tempo de execução.

Para visualizar a referência, importe `solucao_referencia.json` em OUTRO caminhão vazio com as mesmas dimensões e não clique em Organizar: as coordenadas já estão preenchidas e as dimensões já estão orientadas.

Resultado observado em uma execução local do backend atual:

| Métrica | Resultado | Referência |
| --- | ---: | ---: |
| Caixas acomodadas | 46 | 60 |
| Fração da quantidade possível | 76,67% | 100% |
| Ocupação volumétrica | 63,75% | 100% |
| Volume utilizado | 22,032 | 34,56 |
| Tempo | 2,668 s | Depende do computador |
| Busca interrompida pelo orçamento | Não | — |
| Caixas impossíveis aceitas | 0 | 0 |

`resultado_medido.json` guarda a resposta completa, incluindo caixas excluídas e sequência de descarga. Os números medidos não são critérios mínimos de aprovação: registram uma limitação atual da heurística. Este caso não comprova eficiência em todas as cargas e não cobre frenagem, atrito ou pontes entre várias bases.

Além de contar caixas, confira ausência de sobreposição, caixas suspensas e inversão de peso nas pilhas. A sequência de retirada deve respeitar as entregas sem remover primeiro uma base que ainda sustenta outra caixa. A proximidade da porta é exigida por corredor de acesso, não como ordenação global entre corredores independentes.

## Resultado com busca em feixe e reconstrução

Na versão posterior à implementação inicial, o mesmo conjunto chegou a **58 caixas e 97,22% de ocupação**, em aproximadamente **8,10 s**. A resposta completa está em `resultado_melhorado.json`. O arquivo anterior foi preservado para comparação.

A versão nova também avalia frenagem, curvas e necessidade de contenção; mantém as caixas que precisam de amarração, conforme o modo solicitado. A referência de 60 caixas comprova viabilidade geométrica/estática, não adequação para transporte sem cintas. Os avisos e hipóteses aparecem no painel “Freadas e curvas”.
