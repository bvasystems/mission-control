# Task: Agent Activity States

**ID:** agent-states
**Agent:** office-engine (Pixel)
**Priority:** P0
**Depends on:** nenhuma

## Objetivo
Implementar 6 estados de atividade nos personagens do office com animações visuais e speech bubbles contextuais.

## Estados

| Estado | Visual | Speech Bubble | Trigger |
|--------|--------|---------------|---------|
| `thinking` | "..." pulsante sobre a cabeça | "Analisando..." | Dispatch recebido, antes de agir |
| `coding` | Braços para frente, monitor brilha | "Codando..." | Task type=code em in_progress |
| `reading` | Olhando para baixo, segurando algo | "Lendo relatório..." | Task type=bug/improvement |
| `talking` | Speech bubble com nome do interlocutor | "Falando com @{agent}" | Mensagem inter-agent ativa |
| `waiting` | Relógio ou "..." com animação lenta | "Aguardando @{agent}..." | Dispatch enviado, sem resposta |
| `done` | Check verde temporário (3s) | "Concluído!" | Task/dispatch finalizado |

## Acceptance Criteria
- [ ] Tipo `AgentActivityState` adicionado aos types
- [ ] Renderer desenha animação distinta para cada estado
- [ ] Speech bubble mostra texto contextual (não genérico)
- [ ] Estado muda baseado em dados reais (dispatch, tasks, messages)
- [ ] Estado "done" é temporário (3s) e volta para idle
- [ ] Estado é visível mesmo com zoom out (ícone flutuante)

## Arquivos
- `src/features/office/types.ts` — novo type
- `src/features/office/engine/OfficeRenderer.ts` — animações por estado
- `src/features/office/components/OfficeCanvas.tsx` — computar estado por agente
- `src/features/office/config/office-map.ts` — campo activityState no AgentConfig
