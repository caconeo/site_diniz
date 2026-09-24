---
name: verificacao-funcionalidades
description: >-
  Audita e valida funcionalidades, componentes e alterações no site de Cássio Diniz
  sob a perspectiva multi-especialista sênior (UX/UI 30+ anos, Engenharia de Software,
  Arquitetura de Sistemas e Marketing Digital 40+ anos). Gera Scorecard e atualiza o MASTER_PROCESSOS.md.
---

# Skill: Verificação de Funcionalidades e Auditoria Quádrupla

Esta skill é ativada quando o usuário ou o fluxo de trabalho solicita a validação, auditoria ou verificação de uma nova funcionalidade adicionada ao site.

---

## Procedimento de Execução Passo a Passo

### Etapa 1: Leitura e Mapeamento da Alteração
1. Identificar o código adicionado ou modificado (`index.html`, arquivos CSS/JS, assets ou metadados).
2. Compreender a intenção de negócio e o caso de uso da nova funcionalidade.

### Etapa 2: Aplicação do Scorecard Quádruplo (0 a 100)
Avaliar a alteração em 4 categorias de 25 pontos cada:

1. **UX/UI Design & Ergonomia (0 a 25 pts):**
   - Hierarquia visual, contraste, tipografia e ritmo.
   - Usabilidade tátil em mobile (touch targets ≥ 44px).
   - Acessibilidade WCAG AA (foco visível, leitores de tela).
2. **Engenharia de Software & Performance (0 a 25 pts):**
   - Semântica HTML5 estrita e CSS limpo.
   - JS Vanilla modular sem memory leaks e tratamento de erros.
   - Otimização de Core Web Vitals (sem impacto negativo em LCP, CLS e INP).
3. **Arquitetura de Sistemas (0 a 25 pts):**
   - Coesão, modularidade e desacoplamento de componentes.
   - Conformidade com o padrão do projeto e ausência de complexidade acidental.
4. **Marketing Digital & CRO (0 a 25 pts):**
   - Clareza da Proposta Única de Valor (UVP) e tom de voz nobre.
   - Eficiência do funil de conversão (facilidade para acionar o WhatsApp).
   - SEO On-page e microdados.

### Etapa 3: Emissão do Parecer Go / No-Go
- **Aprovado (Nota ≥ 90/100 sem falhas críticas):** A funcionalidade está apta para produção.
- **Aprovado com Ressalvas (Nota 75 a 89/100):** Pequenos ajustes cosméticos ou secundários recomendados.
- **Reprovado (Nota < 75 ou falha crítica de acessibilidade/responsividade/conversão):** Retorno imediato com correções obrigatórias.

### Etapa 4: Atualização do MASTER_PROCESSOS.md
Assim que a funcionalidade for validada ou homologada:
1. Criar a nova entrada `[PROC-XXX]` no arquivo `MASTER_PROCESSOS.md`.
2. Atualizar a tabela da **Matriz de Status Atual das Funcionalidades**.
3. Registrar a versão e a data da homologação.

---

## Formato do Relatório de Auditoria a ser Exibido

```markdown
# Relatório de Auditoria de Funcionalidade: [Nome da Funcionalidade]

## 1. Resumo Executivo
- **ID do Processo:** PROC-XXX
- **Status:** [APROVADO / REPROVADO / APROVADO COM RESSALVAS]
- **Pontuação Geral:** XX / 100

## 2. Avaliação dos 4 Pilares
- **🎨 UX/UI Design Sênior (+30 anos):** [Nota/25] — [Parecer detalhado]
- **💻 Engenharia de Software:** [Nota/25] — [Parecer detalhado]
- **🏛️ Arquitetura de Sistemas:** [Nota/25] — [Parecer detalhado]
- **📈 Marketing Digital Sênior (+40 anos):** [Nota/25] — [Parecer detalhado]

## 3. Apontamentos e Otimizações Recomendadas
- [Item 1 com instrução de melhoria se houver]

## 4. Registro no Master
- [x] Entrada gerada no MASTER_PROCESSOS.md
```
