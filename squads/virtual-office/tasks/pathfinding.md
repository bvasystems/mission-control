# Task: Pathfinding BFS

**ID:** pathfinding
**Agent:** office-engine (Pixel)
**Priority:** P2
**Depends on:** agent-states

## Objetivo
Agentes andam por portas e corredores sem atravessar paredes usando BFS.

## Implementação

### Grid de Navegação
- Converter o mapa do office em um grid de tiles (24x24px cada)
- Marcar tiles como: walkable, wall, door, furniture
- Portas conectam salas ao corredor

### BFS Pathfinding
- Input: posição atual (x,y) → posição alvo (x,y)
- Output: lista de waypoints [(x1,y1), (x2,y2), ...]
- Agente segue waypoints sequencialmente
- Suavização de caminho (remover waypoints redundantes)

### Waypoint System
- Substituir o `setAgentTarget(x,y)` direto
- Nova função: `setAgentPath(agentId, waypoints[])`
- Agente anda para cada waypoint em sequência
- Animação de virar nos pontos de curva

## Acceptance Criteria
- [ ] Grid de navegação gerado a partir do mapa
- [ ] BFS encontra caminho entre qualquer par de salas
- [ ] Agentes não atravessam paredes
- [ ] Agentes passam por portas corretamente
- [ ] Movimento suave entre waypoints
- [ ] Performance: pathfinding < 5ms por cálculo
