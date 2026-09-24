# Regra de Auditoria Sênior de Funcionalidades e Qualidade

Esta regra governa a avaliação de qualquer código ou modificação no projeto `site_diniz`.

## Checklist de Conformidade dos 4 Pilares

### Pilar 1: UX/UI Design Sênior (+30 anos)
- **Hierarquia Visual:** O elemento mais importante tem o maior peso visual? O fluxo de leitura do olho (Z-pattern ou F-pattern) é natural?
- **Tipografia:** Famílias consistentes, line-height proporcional (1.4 a 1.6 para leitura, 1.0 a 1.2 para títulos grandes), contraste mínimo de cor atendendo WCAG AA (4.5:1 para texto normal, 3:1 para títulos).
- **Espaçamento e Ritmo:** Padding e margins proporcionais e consistentes com o sistema de grid.
- **Interatividade:** Estados `:hover`, `:active`, `:focus-visible` claramente definidos, transições suaves (150ms-250ms com timing ease).
- **Acessibilidade:** Alvos de toque (touch targets) com no mínimo 44x44px no mobile; sem perda de contexto ao fechar modais.

### Pilar 2: Engenharia de Software
- **Semântica HTML5:** Utilização de tags semânticas corretas (`button` para ações, `a` para links, `dialog` para modais, tags de cabeçalho hierárquicas H1 -> H2 -> H3).
- **CSS Limpo e Eficiente:** Sem declarações `!important` desnecessárias, uso de variáveis do tema `:root`, ausência de seletores excessivamente aninhados.
- **JavaScript Seguro:** Tratamento de elementos nulos (`optional chaining` ou guard clauses), delegação de eventos limpa, prevenção de vazamento de memória e cleanup de listeners.
- **Performance:** Imagens com `loading="lazy"`, formatos modernos (WebP/SVG), atributos `width` e `height` presentes para evitar layout shift.

### Pilar 3: Arquitetura de Sistemas
- **Modularidade:** Componentes isolados e previsíveis. Modais e popups devem ser desacoplados do conteúdo estático.
- **Coesão e Baixo Acoplamento:** O CSS e o JavaScript não devem depender de IDs ou classes mágicas sem contexto.
- **Integridade da Estrutura de Arquivos:** Manter arquivos organizados na raiz e assets nomeados de forma semântica (`book-*.webp`, `whatsapp-qr.svg`).

### Pilar 4: Marketing Digital Sênior (+40 anos)
- **Proposta Única de Valor (UVP):** O visitante compreende em menos de 5 segundos quem é o Cássio Diniz, o que ele faz e qual o benefício de contratá-lo?
- **Copywriting Persuasivo:** Tom de voz seguro, sóbrio, elegante e de altíssimo nível. Sem jargões baratos ou clichês de marketing apelativo.
- **Jornada de Conversão (CRO):** O caminho até o botão do WhatsApp ou e-mail é visível, direto e sem fricção?
- **Contextualização de Contato:** Os links do WhatsApp incluem mensagens pré-preenchidas pertinentes ao serviço clicado?
- **SEO & Metadados:** Título conciso, meta description atrativa, meta tags de compartilhamento e dados estruturados.

---

## Procedimento em Caso de Reprovação
Caso qualquer critério crítico falhe, o auditor deve:
1. Apontar a linha exata e a natureza do problema.
2. Explicar a justificativa técnica e humana da falha.
3. Fornecer a correção recomendada em código pronto para substituição.
