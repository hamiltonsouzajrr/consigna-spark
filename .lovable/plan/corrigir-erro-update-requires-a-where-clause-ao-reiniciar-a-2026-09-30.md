# Corrigir erro "UPDATE requires a WHERE clause" ao reiniciar a base

## O que aconteceu
A prévia funciona, mas ao tocar em "Reiniciar agora" o banco trava por segurança. Um passo interno, o que conta quantos leads cada consultora já tem, altera todas as linhas de uma lista temporária sem filtro, e o banco não permite isso. Nenhum lead foi alterado: a operação foi cancelada inteira.

## Correção
- Recriar a função de reinício com esse passo filtrado (`WHERE a.id IS NOT NULL`), sem mudar mais nada na regra.
- Conferir os outros passos da mesma função: todos já têm filtro.

Depois disso, basta tocar em "Ver prévia" e depois em "Reiniciar agora" de novo.

## Detalhes técnicos
Migration com `CREATE OR REPLACE FUNCTION public.reiniciar_prospect_leads(...)` com o mesmo corpo de antes, trocando só `UPDATE _alvos a SET carga = (...)` por `UPDATE _alvos a SET carga = (...) WHERE a.id IS NOT NULL`. Os grants continuam os mesmos.
