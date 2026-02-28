function resolveAgentChannel(agentId: string): string {
  const fallback = process.env.DISCORD_FALLBACK_CHANNEL_ID || '';
  try {
    const mapStr = process.env.DISCORD_AGENT_CHANNEL_MAP || '{}';
    const map = JSON.parse(mapStr);
    return map[agentId] || fallback;
  } catch {
    console.warn('Error parsing DISCORD_AGENT_CHANNEL_MAP fallback using', fallback);
    return fallback;
  }
}

async function sendDiscordMessage(channelId: string, content: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) {
    console.warn('Discord missing valid channel or token, skipping:', content);
    return;
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after') || '1';
        console.warn(`Discord rate limit, retry after ${retryAfter}s`);
        setTimeout(() => sendDiscordMessage(channelId, content), parseInt(retryAfter) * 1000);
      } else {
        const text = await res.text();
        console.error(`Discord message failed: ${res.status} ${text}`);
      }
    }
  } catch (e) {
    console.error('Failed to send discord message:', e);
  }
}

export async function notifyAgentEvent(payload: { type: string; agent_id: string; task_id?: string; stage?: string; message?: string }) {
  const { type, agent_id, task_id, stage, message } = payload;
  const channel = resolveAgentChannel(agent_id);
  
  let content = '';

  switch (type) {
    case 'ack':
      content = `🟦 **[ACK]** O agente **${agent_id}** atestou recebimento da tarefa \`${task_id}\`.\n**Próximos passos / Stage:** ${stage}\n**Bloqueios:** Nenhum no momento.\n**Mensagem:** ${message || 'Sem mensagem'}`;
      break;
    case 'running':
      content = `🟨 **[RUNNING]** O agente **${agent_id}** iniciou a execução da tarefa \`${task_id}\`.`;
      break;
    case 'progress':
      content = `🟧 **[PROGRESS]** Atualização na tarefa \`${task_id}\`.\n**Stage:** ${stage}\n**Mensagem:** ${message || 'Trabalhando...'}`;
      break;
    case 'done':
      content = `🟩 **[DONE]** O agente **${agent_id}** concluiu a tarefa \`${task_id}\`.\n**Resultado:** ${message || 'Sucesso'}`;
      break;
    case 'failed':
      content = `🟥 **[FAILED]** Falha na tarefa \`${task_id}\` pelo agente **${agent_id}**.\n**Erro:** ${message || 'Erro desconhecido'}`;
      break;
    case 'timeout':
      content = `🚨 **[TIMEOUT]** Tarefa \`${task_id}\` excedeu o tempo limite para o agente **${agent_id}**.`;
      break;
    case 'offline':
      content = `🚨 **[OFFLINE]** Agente **${agent_id}** parou de enviar heartbeats há mais de 3 minutos.`;
      break;
  }

  if (content) {
    await sendDiscordMessage(channel, content);
  }
}
