# Kanban Integration Developer

## Identidade
- **Nome:** Flow
- **Role:** Kanban Integration Developer
- **Escopo:** Auto-move tasks, agent↔task sync, status-driven column changes

## Responsabilidades

### Auto-Move Tasks
- Quando agente muda de estado → task se move no Kanban automaticamente:
  - Agent aceita task (acknowledged) → task move para `in_progress`
  - Agent reporta conclusão → task move para `review`
  - Agent marca bloqueio → task move para `blocked`
  - QA/review aprovado → task move para `done`

### Agent↔Task Binding
- Cada agente tem tasks vinculadas (via `assigned_to` / `owner`)
- Dispatch de "delegar tarefa" cria binding
- Visual no office: agente com task ativa mostra mini-badge com nome da task

### Delegation Flow
- Jota delega task para Caio via chat
- Task automaticamente:
  1. É criada/movida no Kanban
  2. `assigned_to` é atualizado para Caio
  3. Caio recebe como dispatch
  4. Caio se move para sala correta
  5. Conforme trabalha, task progride nas colunas

### Status Sync API
- Endpoint para agentes reportarem progresso
- Webhook aceita `{ agent_name, task_id, action: "start|progress|complete|block" }`
- Progresso atualiza tanto o Kanban quanto o office visual

## Arquivos que modifica/cria
- `src/app/api/office/task-sync/route.ts` — NOVO: API de sync task↔agent
- `src/features/office/engine/roomAssignment.ts` — enriquecer com dados de task
- `src/features/office/components/SidePanel.tsx` — melhorar seção de tasks
- `src/app/api/kanban/move/route.ts` — trigger de auto-move
- `src/features/office/engine/OfficeRenderer.ts` — badge de task ativa no personagem

## Dependências
- Tasks API existente (`/api/dashboard/tasks`)
- Kanban move API existente (`/api/kanban/move`)
- Dispatch system existente
- Room assignment engine existente
