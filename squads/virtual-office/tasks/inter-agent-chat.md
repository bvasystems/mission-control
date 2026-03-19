# Task: Inter-Agent Chat System

**ID:** inter-agent-chat
**Agent:** chat-system (Echo)
**Priority:** P0
**Depends on:** agent-states

## Objetivo
Sistema de chat entre agentes com @mentions, threads, e delegation chains.

## Funcionalidades

### 1. Mensagens Inter-Agent
- Jota pode enviar `@caio implemente o login` → cria dispatch + task
- Agentes podem responder em thread
- Mensagens persistidas no banco (nova tabela `agent_messages`)

### 2. @mentions
- Parser de @mentions no texto das mensagens
- Roteamento automático para o agente mencionado
- Notificação visual no office (speech bubble no agente)

### 3. Delegation Chains
- Track do fluxo: Jota → Caio → Clara → Jota
- Visualização da cadeia no chat panel
- Cada elo da cadeia é rastreável

### 4. Chat Panel
- Painel lateral dedicado (além do agent detail)
- Todas as conversas visíveis
- Filtro por agente, thread, task
- Real-time updates

## Schema
```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT,
  thread_id TEXT,
  task_id UUID,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'message', -- message, delegation, report, question
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Acceptance Criteria
- [ ] API POST /api/office/messages para enviar mensagens entre agentes
- [ ] API GET /api/office/messages para listar mensagens (filtro por agent/thread)
- [ ] Parser de @mentions funcional
- [ ] Chat panel no office com threads
- [ ] Delegation chain rastreável
- [ ] Speech bubble no agente quando está "talking"
- [ ] Mensagens persistidas no PostgreSQL
