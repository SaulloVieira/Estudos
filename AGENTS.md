# AGENTS.md

## Arquitetura
Site estático, sem etapa de build. `netlify.toml` publica `public/`.

- `public/index.html` — duas abas (`#tab-simulado`, `#tab-cronograma`) alternadas via `hidden`. A aba Simulado contém três telas (`#screen-home`, `#screen-train`, `#screen-report`), também alternadas via `hidden`.
- `public/style.css` — tema escuro; `body[data-tab]` = aba ativa; `body.over` = questão acima de 3:30, `body.flash` = animação ao atingir o limite (o fundo vermelho só aparece com `data-tab="simulado"`).
- `public/app.js` — lógica do Simulado e navegação entre abas, em uma IIFE.
- `public/schedule.js` — lógica do Cronograma (visualização, modo edição), em uma IIFE separada.

## Decisões não óbvias
- **Tempo por timestamps reais**: cada questão guarda `startedAt = Date.now()`; o tempo exibido é sempre `Date.now() - startedAt`. O `setInterval` só redesenha a tela, então o throttling de abas em segundo plano não afeta a precisão. Tempos armazenados em milissegundos.
- **Alarme agendado no AudioContext**: ao iniciar cada questão, os bipes são agendados em `ctx.currentTime + 210s`; o relógio de áudio não é limitado em segundo plano. Ao trocar de questão, os nós agendados são cancelados. Se não houver áudio agendado (ex.: página recarregada), o loop de render toca o bipe ao detectar o limite.
- **"Dentro dos 3:30"** significa `tempo <= 210000 ms`.
- **Excesso total** = soma de `max(0, tempo - 3:30)` por questão (questões abaixo do limite não compensam).
- **Abas pelo hash**: a aba ativa fica em `location.hash` (`#cronograma`; Simulado = sem hash), trocada com `history.replaceState`, sem recarregar. O cronômetro continua rodando ao trocar de aba; a aba Simulado mostra um indicador com o tempo atual.
- Atalhos `Espaço`/`Enter` do treino só valem na aba Simulado e nunca dentro de campos de texto.
- **Cronograma**: salvo em `localStorage` (`ritmo-enem:schedule:v1`, formato `{ days: [[{id,title,detail}] × 7] }`, segunda → domingo). Cada alteração salva na hora; ao sair do modo edição, atividades vazias são descartadas. Cor de cada atividade vem de um hash do título.
- Estado da sessão persiste em `localStorage` (`ritmo-enem:session:v1`) — é estado local do navegador, não dados de servidor.

## Convenções
- Interface em português (pt-BR); formatos `mm:ss` no cronômetro e `mm:ss.d` no relatório.
- Sem frameworks; manter o app leve e instantâneo.
