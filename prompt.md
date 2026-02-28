Você é um engenheiro sênior de backend/fullstack.
Implemente sincronização 100% confiável entre Painel (Kanban) ↔ Agentes ↔ Discord com foco em consistência de estado, idempotência e observabilidade.

Objetivo de negócio

• Quando eu criar uma tarefa no painel e escolher um agente, a tarefa deve ser delegada.
• O agente deve executar e enviar eventos de progresso.
• O painel deve refletir em tempo real (mudança de status e coluna do kanban).
• O Discord deve receber atualizações dos eventos.
• Health check deve marcar offline/timeout corretamente e reconciliar drift.

Stack/Contexto

• Backend: Node.js + Express + PostgreSQL
• Banco já existe com tabelas: tasks, agent_events, agents_status, health_checks, incidents, agent_stats, cron_jobs, memory_events
• Auth via header x-mc-token (process.env.MC_TOKEN)
• Base URL e token já existem em .env.sync (MC_URL, MC_TOKEN)

Requisitos obrigatórios (não-negociáveis)

1. Idempotência

• tasks.command_id único
• agent_events.event_id único
• eventos duplicados não podem duplicar efeito

2. Transação atômica no endpoint de eventos

• cada evento atualiza em transação única:
• agent_events (append-only)
• tasks (status/stage/timestamps/erro)
• agents_status (snapshot atual)

3. Contrato único de estado

• type: heartbeat|ack|running|progress|done|failed
• status: queued|ack|running|done|failed|timeout
• stage: backlog|todo|doing|review|done|blocked

4. Realtime no painel

• publicar evento WS/SSE a cada atualização de task

5. Fan-out Discord

• notificar por evento relevante (ack/progress/done/failed/offline)

6. Reconciliação periódica

• endpoint interno POST /api/internal/reconcile-agents
• cron a cada 5 min
• regras:
• offline se heartbeat > 180s
• task queued sem ack > 2 min => retry/timeout
• task running sem eventos > 15 min => timeout
• corrigir drift snapshot vs eventos

Endpoints a implementar/ajustar

1) Criar e delegar tarefa

POST /api/dashboard/tasks

• Input:

{
"title": "string",
"agent_id": "string",
"payload": {},
"stage": "todo"
}

• Ações:
• gerar task_id e command_id
• inserir em tasks com status='queued', stage='todo'
• publicar comando para agente (mockável inicialmente)
• Output:

{
"ok": true,
"task_id": "tsk_...",
"command_id": "cmd_..."
}

2) Receber eventos do agente

POST /api/agents/events

• Input (contrato):

{
"event_id": "evt_...",
"agent_id": "agt_...",
"task_id": "tsk_...",
"command_id": "cmd_...",
"type": "progress",
"status": "running",
"stage": "review",
"message": "string",
"meta": {},
"occurred_at": "ISO8601"
}

• Ações:
• validar payload
• transação:
• insert agent_events
• update tasks
• upsert agents_status
• emitir evento realtime (WS/SSE)
• notificar Discord
• Output: 202 { ok: true, ... }

3) Heartbeat

POST /api/agents/heartbeat

• Pode delegar internamente para /api/agents/events com type=heartbeat

4) Reconciliação

POST /api/internal/reconcile-agents

• executar regras de drift/offline/timeout
• registrar em health_checks
• abrir incidents quando crítico
• output com resumo: checked_agents, offline_marked, timed_out_tasks, drift_fixed

Regras de transição de task

• queued -> ack -> running -> done
• running -> failed|timeout
• progress pode mudar stage sem finalizar
• done força stage='done'
• failed força stage='blocked'

Discord templates

• ACK: 🟦 [ACK] {agent_id} recebeu {task_id} | etapa: {stage}
• RUNNING: 🟨 [RUNNING] {agent_id} iniciou {task_id}
• PROGRESS: 🟧 [PROGRESS] {task_id} -> {stage} | {message}
• DONE: 🟩 [DONE] {task_id} concluída por {agent_id}
• FAILED: 🟥 [FAILED] {task_id} | {error_code} | {message}
• OFFLINE: 🚨 [OFFLINE] {agent_id} sem heartbeat há {minutes} min

Entregáveis de código

1. Migrações SQL (ALTER/INDEX/CONSTRAINT) necessárias
2. Rotas Express completas com validação
3. Serviço de transição de estado (função centralizada)
4. Publisher realtime (WS/SSE)
5. Notifier Discord (função isolada)
6. Job/rota de reconciliação
7. Testes mínimos (unit + integração dos fluxos críticos)
8. README curto com como rodar e testar

Critérios de aceite (obrigatório passar todos)

1. Criar task no painel -> queued/todo
2. Evento ack -> ack/todo
3. Evento running -> running/doing
4. Evento progress com stage=review -> move coluna no kanban
5. Evento done -> done/done e notifica Discord
6. Sem heartbeat por 3 min -> agente offline
7. Task running sem evento por 15 min -> timeout
8. Reprocessar mesmo event_id não duplica efeito
9. Repetir mesmo command_id não duplica execução

Restrições

• Não quebrar APIs existentes
• Não remover tabelas existentes
• Código limpo, tipado quando possível, com logs estruturados
• Se precisar assumir algo, documentar claramente no PR/README

Implemente agora e entregue:

1. diff dos arquivos alterados
2. instruções de deploy
3. checklist de validação pós-deploy

───
