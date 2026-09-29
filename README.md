# Ritmo ENEM — cronômetro por questão e cronograma semanal

O site tem duas abas: **Simulado** (treino de tempo por questão) e **Cronograma** (planejamento semanal de estudos).

Ferramenta web para treinar gerenciamento de tempo no ENEM. Cada questão tem um limite ideal de **3:30**: ao atingir o limite, soa um alarme e a tela fica vermelha, mas o cronômetro continua contando para registrar o tempo real. Ao finalizar, um relatório mostra média, excesso total, questões dentro/fora do limite, maior e menor tempo.

## Tecnologias
- HTML, CSS e JavaScript puros (sem build, sem dependências)
- Web Audio API para o alarme (agendado no relógio de áudio, funciona com a aba em segundo plano)
- `localStorage` para não perder a sessão nem o cronograma ao recarregar a página
- Hospedagem estática na Netlify (`public/`)

## Rodar localmente
```bash
netlify dev --port 8889
# ou qualquer servidor estático apontando para ./public
```

## Uso
1. **Começar prova** inicia a Questão 1.
2. **Próxima questão** (ou `Espaço`/`Enter`) salva o tempo e começa a próxima.
3. **Finalizar prova** registra a questão atual e mostra o relatório.
4. **Reiniciar treino** apaga tudo e volta ao início.

## Cronograma
- Clique em **Cronograma** para ver a semana (segunda a domingo); o dia atual fica destacado.
- **Editar cronograma** mostra os controles para adicionar, editar, reordenar (↑ ↓) e excluir atividades. Tudo é salvo automaticamente no navegador.
- **Concluir edição** volta à visualização limpa.
