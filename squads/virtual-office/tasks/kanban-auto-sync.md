# Task: Kanban Auto-Sync

**ID:** kanban-auto-sync
**Agent:** kanban-sync (Flow)
**Priority:** P1
**Depends on:** agent-states

## Objetivo
Tasks se movem automaticamente no Kanban conforme agentes mudam de estado.

## Regras de Auto-Move

| Evento | Task move para |
|--------|---------------|
| Agente aceita dispatch com task_id | `in_progress` |
| Agente reporta "working on it" | `in_progress` |
| Agente reporta "done" / "completed" | `review` |
| Agente reporta "blocked" | `blocked` |
| Review aprovado | `done` |
| Dispatch timeout (5min sem resposta) | permanece (log warning) |

## Funcionalidades

### 1. Task-Sync API
- POST /api/office/task-sync
- Payload: `{ agent_name, task_id, action: "start|progress|complete|block" }`
- Atualiza coluna do Kanban automaticamente

### 2. Badge Visual
- Agente com task ativa mostra mini-badge no office
- Badge mostra título abreviado da task
- Cor do badge indica prioridade (P0=red, P1=yellow, P2=gray)

### 3. Delegation → Task Creation
- Quando Jota delega task via chat para Caio:
  1. Task criada no Kanban (se não existe)
  2. assigned_to = caio
  3. Status = in_progress
  4. Caio recebe dispatch com task_id

## Acceptance Criteria
- [ ] API /api/office/task-sync funcional
- [ ] Tasks auto-movem no Kanban baseado em eventos
- [ ] Badge de task ativa visível no personagem
- [ ] Delegation via chat cria/atualiza task no Kanban
- [ ] Histórico de quem moveu cada task (audit trail)
