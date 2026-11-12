# Vacinação e Infarto no Brasil

Painel estático (Astro) que estuda a associação entre vacinação contra influenza e infarto nas 27 UFs, de 2010 a 2025. Desfechos: óbitos (SIM) e internações (SIH/SUS), CID-10 I21–I22. Foco na população de 60 anos ou mais.

A pessoa escolhe uma pergunta, ajusta os filtros e só então vê resposta, gráfico e tabela.

## Rodar

Requisitos: Node 20 ou mais recente. Python 3.10+ só para refazer os dados.

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:4321. Para gerar e conferir o site final:

```bash
npm run build
```

```bash
npm run preview
```

Checagem de tipos:

```bash
npm run check
```

## Publicar na Vercel

A Vercel detecta Astro e publica `dist/`. Nada foi publicado nesta etapa; a versão em https://vacinacao-infarto.vercel.app ainda é a anterior.

```bash
npx vercel deploy --prod
```

O `.vercelignore` deixa `raw/`, `scripts/` e `legacy/` fora do envio. `public/data/` precisa ir junto: o build lê esses arquivos.

## Estrutura

| Caminho | O que é |
|---|---|
| `src/pages/index.astro` | Painel: formulário guiado e área de resultado. |
| `src/pages/fontes.astro` | Catálogo de fontes, lacunas investigadas e divergências. |
| `src/pages/metodologia.astro` | Definições, padronização, quebra de método e regra da associação. |
| `src/scripts/painel.ts` | Fluxo da consulta e renderização de cada pergunta. |
| `src/scripts/consulta.ts` | Leitura e validação dos filtros, resumo da consulta. |
| `src/scripts/graficos.ts` | Gráficos D3: linha por segmentos, dispersão, mapa em quadrados. |
| `src/scripts/dados.ts`, `tipos.ts` | Leitura dos arquivos e tipos. |
| `src/data/fontes.json` | Catálogo de fontes e registro das lacunas (editado à mão). |
| `public/data/` | `painel.json`, `rotina.csv`, `covid.csv`, gerados pelos scripts. |
| `scripts/` | Extração e preparação em Python. |
| `raw/` | Respostas brutas das fontes oficiais. |
| `legacy/` | Versão anterior (HTML único) e seus dados, só para referência. |

Não foi preciso React: os controles são campos nativos de formulário e os gráficos são D3 puro.

## Refazer os dados

```bash
npm run dados
```

Isso roda `scripts/build_data.py` (junta `raw/` em `scripts/data.json`) e `scripts/prepare.py` (taxas brutas e padronizadas, registros de gripe com qualidade, associações, conferências). Depois rode `npm run build`.

Para baixar de novo das fontes (a partir de `scripts/`):

| Script | Fonte | Saída em `raw/` |
|---|---|---|
| `get_sim.py`, `get_sih.py`, `get_pop.py` | TabNet: SIM, SIH/SUS, IBGE | `sim.json`, `sih.json`, `pop.json` |
| `get_idade.py [sim] [pop] [sih] [sih60] [sih faixa=20]` | TabNet por faixa etária, para padronizar. `faixa=NN` baixa uma faixa só, em arquivo próprio, para rodar várias em paralelo. | `idade_*.json` |
| `get_sipni.py 2015 ... 2020` | SI-PNI Web, campanha de influenza | `sipni_AAAA.json` |
| `get_gripe_doses_tabnet.py` | TabNet, doses de influenza em 60+ (2010) | `gripe_doses_tabnet.json` |
| `get_pni.py all` | TabNet, cobertura de rotina (precisa de `raw/pni.htm`) | `pni.json` |

Coletados à mão, sem script: gripe 2011–2014 (`raw/cob_AA.htm`, páginas do PNI/DATASUS), gripe 2024–2025 (`raw/gripe_rnds.json`, lido na tela do painel da RNDS) e COVID-19 (valores dentro de `build_data.py`, lidos na tela do Vacinômetro). A série nacional de 2021–2023 está em `prepare.py` (`SERIE_MS`).

## Fontes incorporadas

| Fonte | Indicador | Período |
|---|---|---|
| SIM (TabNet) | Óbitos por infarto, I21–I22, por UF de residência e idade | 2010–2025 (2025 preliminar) |
| SIH/SUS (TabNet) | Internações por infarto, por UF de residência e idade | 2010–2025 |
| IBGE, projeção ed. 2024 (TabNet) | População por UF e idade | 2010–2025 |
| PNI/DATASUS, consulta de campanhas | Gripe em idosos: doses, população-alvo, cobertura por UF | 2011–2014 |
| SI-PNI Web | Gripe em idosos: doses, população, cobertura por UF | 2015–2020 |
| Painel do Ministério (RNDS) | Gripe em 60+: numerador, denominador, cobertura por UF de residência | 2024–2025 |
| TabNet, doses aplicadas | Doses de gripe de campanha em 60+ por UF | 2010 |
| Ministério da Saúde, apresentação à Câmara (11/06/2025) | Cobertura nacional de gripe em 60+ | 2021–2023, só Brasil |
| TabNet, cobertura (seção secundária) | 24 vacinas de rotina por UF | 2010–2022 |
| Vacinômetro COVID-19 (seção secundária) | Doses acumuladas por UF | até 24/04/2026 |

Links, filtros e datas de extração estão na página Fontes e em `src/data/fontes.json`.

## Lacunas que continuam

| Lacuna | Situação | Caminho sugerido |
|---|---|---|
| Gripe 2010 por UF | Só doses. Falta a população-alvo, então não há cobertura. | Informe da campanha de 2010 ou relatório do TCU, não localizados. |
| Gripe 2021 por UF | Só o valor nacional (70,9%). Por UF existe apenas um gráfico sem números no informe da 24ª campanha. | Pedir ao Ministério a tabela do LocalizaSUS de 04/02/2022. |
| Gripe 2022 por UF | Só o valor nacional (70,2%). Boletins estaduais encontrados são parciais. | Informe federal da 25ª campanha e boletins de encerramento. |
| Gripe 2023 por UF | Só o valor nacional (63,3%). | Agregar os microdados de doses do Portal de Dados Abertos do SUS. |
| COVID-19 do Tocantins | Valor derivado por diferença, marcado na tabela. | Reler o Vacinômetro. |
| Internações fora do SUS | Internações pagas exclusivamente por planos de saúde ou particulares ficam fora do SIH/SUS. | ANS, fora do escopo atual. |
| Etapa causal | Não faz parte do painel. | Dados mensais ou individuais. |

## Decisões de análise

- Período principal da associação: 2011–2019. Sensibilidade: 2011–2020. Série recente (2024–2025, RNDS) sempre à parte.
- Um mesmo Pearson nunca mistura SI-PNI com RNDS.
- Óbitos e internações são calculados separadamente, em 60 anos ou mais, com taxa padronizada por idade (população padrão: Brasil 2022).
- A consulta de infarto também oferece taxas padronizadas em todas as idades. Para internações, as contagens por idade foram conferidas com os totais do SIH/SUS para Brasil e 27 UFs, de 2010 a 2025. As tabelas por faixa estão em `raw/idade_sih*.json` (o `prepare.py` junta todos os arquivos com esse prefixo).
- Ausências ficam nulas. Um valor nacional nunca é atribuído a uma UF.
