import { useEffect, useState } from "react";
import { api, Model } from "../api";
import { Icon } from "../icons";

const EMPTY: Partial<Model> = { id: "", base_url: "http://host.docker.internal:1234/v1", model: "", api_key: "not-needed", temperature: 0, max_tokens: 2048, timeout_s: 180, thinking: 0 };

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [form, setForm] = useState<Partial<Model>>(EMPTY);

  const load = () => api.models().then(setModels).catch(console.error);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.id || !form.model) return alert("id and model are required");
    await api.saveModel(form);
    setForm(EMPTY);
    load();
  };

  return (
    <>
      <div className="panel">
        <h2>Add / edit a model</h2>
        <div className="row">
          <input placeholder="id (e.g. qwen3.5-9b)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <input placeholder="model name on server" style={{ flex: 1 }} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input placeholder="base_url" style={{ flex: 1 }} value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
          <input placeholder="api key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="muted">temp <input type="number" step="0.1" style={{ width: 70 }} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: +e.target.value })} /></label>
          <label className="muted">max_tokens <input type="number" style={{ width: 90 }} value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: +e.target.value })} /></label>
          <label className="muted">timeout_s <input type="number" style={{ width: 80 }} value={form.timeout_s} onChange={(e) => setForm({ ...form, timeout_s: +e.target.value })} /></label>
          <label className="chip" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.thinking} onChange={(e) => setForm({ ...form, thinking: e.target.checked ? 1 : 0 })} /> thinking
          </label>
          <button className="btn" onClick={save}><Icon name="plus" size={15} /> Save model</button>
        </div>
      </div>

      <div className="panel">
        <h2>Models ({models.length})</h2>
        <table>
          <thead><tr><th>id</th><th>model</th><th>base_url</th><th>thinking</th><th></th></tr></thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td className="mono">{m.model}</td>
                <td className="mono muted">{m.base_url}</td>
                <td>{m.thinking ? "yes" : "—"}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn ghost" style={{ padding: "6px 12px" }} onClick={() => setForm(m)}><Icon name="pencil" size={14} /> edit</button>
                    <button className="btn ghost" style={{ padding: "6px 10px" }} onClick={async () => { await api.deleteModel(m.id); load(); }}><Icon name="trash" size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
          Tip: from inside Docker, reach a model server on the host via <span className="mono">host.docker.internal</span>.
        </p>
      </div>
    </>
  );
}
