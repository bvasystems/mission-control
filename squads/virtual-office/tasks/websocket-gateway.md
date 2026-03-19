# Task: WebSocket Gateway

**ID:** websocket-gateway
**Agent:** realtime-backend (Pulse)
**Priority:** P1
**Depends on:** inter-agent-chat

## Objetivo
Substituir polling SWR por WebSocket para updates em tempo real.

## Arquitetura

```
Browser ←→ WebSocket Gateway ←→ Event Bus ←→ APIs/DB
```

### Channels
- `agent:state` — status changes (idle→coding→done)
- `agent:message` — inter-agent messages
- `task:update` — Kanban column changes
- `office:dispatch` — commands sent/received
- `incident:alert` — incident open/close

### Implementação
- Socket.io no Next.js (custom server ou API route com upgrade)
- Client hook: `useWebSocket()` substituindo `useAgents()`, `useAllDispatches()`, etc.
- Fallback: se WebSocket falhar, volta para SWR polling
- Reconexão automática com exponential backoff

## Acceptance Criteria
- [ ] WebSocket server funcional no Next.js
- [ ] Client hook useWebSocket() com auto-reconnect
- [ ] Channels implementados (agent:state, agent:message, task:update)
- [ ] SWR hooks migrados para WebSocket (com fallback)
- [ ] Latência < 100ms para updates de estado
- [ ] Suporta múltiplos clientes simultâneos
