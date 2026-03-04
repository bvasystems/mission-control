const fs = require('fs');
let content = fs.readFileSync('src/app/kanban/page.tsx', 'utf8');

content = content.replace(
  'type Task = {',
  'type Task = {\n  subtasks_total?: string | number;\n  subtasks_done?: string | number;'
);

content = content.replace(
  'type EvidenceType = "print" | "log" | "link";',
  'type EvidenceType = "print" | "log" | "link";\ntype Subtask = { id: string; title: string; status: "todo"|"doing"|"done"; owner?: string; };'
);

content = content.replace(
  '// evidence count cache (lazy',
  `// subtasks state
  const [taskSubtasks, setTaskSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [submittingSubtask, setSubmittingSubtask] = useState(false);
  
  // saved filters
  const [savedFilters, setSavedFilters] = useState<{id:string, name:string, filters:any}[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "sprint" | "report">("kanban");
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (userName) {
      fetch(\`/api/dashboard/filters?owner=\${encodeURIComponent(userName)}\`)
        .then(r => r.json())
        .then(j => { if (j.ok) setSavedFilters(j.data); });
    }
  }, [userName]);

  const loadReport = async () => {
    setViewMode("report");
    const r = await fetch("/api/dashboard/weekly-report").then(x=>x.json());
    if (r.ok) setReportData(r.data);
  };
  
  // evidence count cache (lazy`
);

content = content.replace(
  'const [taskEvidences, setTaskEvidences] = useState<Evidence[]>([]);',
  'const [taskEvidences, setTaskEvidences] = useState<Evidence[]>([]);\n  const [taskSubtasks, setTaskSubtasks] = useState<Subtask[]>([]);'
);

content = content.replace(
  'setTaskUpdates(up.data ?? []);',
  'setTaskUpdates(up.data ?? []);\n      const subs = await fetch(`/api/dashboard/tasks/${task.id}/subtasks`).then(r=>r.json());\n      setTaskSubtasks(subs.data ?? []);'
);

content = content.replace(
  'function closeTask() {',
  'function closeTask() {\n    setTaskSubtasks([]);'
);

content = content.replace(
  'async function submitEvidence() {',
  `async function submitSubtask() {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    setSubmittingSubtask(true);
    try {
      const res = await fetch(\`/api/dashboard/tasks/\${selectedTask.id}/subtasks\`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle.trim(), owner: userName }),
      });
      const j = await res.json();
      if (res.ok) {
        setTaskSubtasks(prev => [...prev, j.data]);
        setNewSubtaskTitle("");
      }
    } finally { setSubmittingSubtask(false); }
  }

  async function updateSubtaskStatus(subId: string, status: string) {
    if (!selectedTask) return;
    setTaskSubtasks(prev => prev.map(s => s.id === subId ? { ...s, status: status as any } : s));
    await fetch(\`/api/dashboard/tasks/\${selectedTask.id}/subtasks/\${subId}\`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    refresh();
  }

  async function submitEvidence() {`
);

content = content.replace(
  '<div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">',
  `{viewMode === "report" ? (
          <div className="glass rounded-xl border border-white/10 p-6 space-y-6">
            <h2 className="text-xl font-semibold mb-4 text-indigo-400">Relatório Automático (MVP 7d)</h2>
            {!reportData ? <p>Carregando...</p> : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Dem. Criadas</p>
                    <p className="text-2xl font-light text-zinc-200">{reportData.created7d}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Dem. Concluídas</p>
                    <p className="text-2xl font-light text-zinc-200">{reportData.done7d}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Throughput</p>
                    <p className="text-2xl font-light text-zinc-200">{reportData.throughput} / semana</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Gargalo / Bloqueio</p>
                    <p className="text-2xl font-light text-orange-400">{reportData.blockedPercent}%</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm border-b border-zinc-800 pb-2 mb-2">Principais DEMs Bloqueadas</h3>
                  {reportData.bottlenecks.length === 0 && <p className="text-xs text-zinc-500">Sem demandas em bottleneck aberto.</p>}
                  {reportData.bottlenecks.map((b: any) => (
                    <div key={b.dem_id} className="text-xs flex gap-2 p-2 border-b border-zinc-800 last:border-0">
                      <span className="text-red-400 font-mono">{b.dem_id}</span>
                      <span className="text-zinc-300">{b.title}</span>
                      <span className="text-zinc-500">@{b.owner}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : viewMode === "sprint" ? (
           <div className="glass rounded-xl border border-white/10 p-6 w-full">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400">Visão de Sprint</h2>
            <div className="flex gap-4 p-4 bg-zinc-900 rounded-xl">
               <div className="flex-1">
                 <p className="text-zinc-500 text-xs">Aberto (Planejado)</p>
                 <p className="text-xl font-light">{columns.backlog.length + columns.assigned.length + columns.in_progress.length + columns.review.length + columns.approved.length}</p>
               </div>
               <div className="flex-1">
                 <p className="text-emerald-500 text-xs">Entregue (Done)</p>
                 <p className="text-xl font-light">{columns.done.length}</p>
               </div>
               <div className="flex-1">
                 <p className="text-red-500 text-xs">Bloqueado</p>
                 <p className="text-xl font-light">{columns.blocked.length}</p>
               </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">`
);

content = content.replace(
  '</div>\n      </div>\n\n      {/* Quick action drawer',
  '</div>\n      {viewMode === "kanban" && </div>}\n      </div>\n\n      {/* Quick action drawer'
);

content = content.replace(
  '<button onClick={() => setShowWip(v => !v)}',
  `<div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
              <button onClick={() => setViewMode("kanban")} className={\`px-2 py-1 text-xs rounded \${viewMode === "kanban" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}\`}>Kanban</button>
              <button onClick={() => setViewMode("sprint")} className={\`px-2 py-1 text-xs rounded \${viewMode === "sprint" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}\`}>Sprint</button>
              <button onClick={loadReport} className={\`px-2 py-1 text-xs rounded \${viewMode === "report" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}\`}>Report</button>
            </div>
            <button onClick={() => setShowWip(v => !v)}`
);

fs.writeFileSync('src/app/kanban/page.tsx', content, 'utf8');
