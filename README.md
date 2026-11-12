# Vacinação e infarto no Brasil

## Objetivo

Analisar a relação entre a cobertura da vacina contra a gripe e as taxas de óbitos e internações por infarto nas 27 UFs, de 2010 a 2025, com foco na população de 60 anos ou mais.

O painel usa dados do PNI e da RNDS para vacinação, do SIM para óbitos, do SIH/SUS para internações e do IBGE para população.

[Acessar o painel](https://vacinacao-infarto.vercel.app/) · [Fontes](https://vacinacao-infarto.vercel.app/fontes/) · [Metodologia](https://vacinacao-infarto.vercel.app/metodologia/)

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm ci
npm run dev
```

Abra [localhost:4321](http://localhost:4321). O projeto usa Astro, TypeScript e D3.

## Gerar o site

```bash
npm run check
npm run build
```

Para refazer os dados de `public/data/` a partir de `raw/`, use `npm run dados` com Python 3.10 ou superior.
