import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stethoscope, Search, Plus, X, ClipboardList, CheckCircle2, Clock } from 'lucide-react';

const TREATMENTS = ['Dental Implants', 'Root Canal', 'Teeth Whitening', 'Braces & Aligners', 'Scaling & Polishing', 'Tooth Extraction', 'Fillings', 'Crowns & Bridges', 'Pediatric Dentistry', 'Emergency Care', 'Consultation', 'Other'];
const STAGES = ['Assessment', 'Treatment Started', 'In Progress', 'Review', 'Completed'];

export default function Treatments() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ patient_name: '', phone: '', treatment_type: '', stage: 'Assessment', start_date: '', expected_end_date: '', total_sessions: '', sessions_done: '', treatment_notes: '', doctor_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('treatments').select('*').order('created_at', { ascending: false });
      setRecords(data || []);
    } catch {
      // Table may not exist yet
      setRecords([]);
    }
    setLoading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await supabase.from('treatments').insert([form]);
      setShowModal(false);
      setForm({ patient_name: '', phone: '', treatment_type: '', stage: 'Assessment', start_date: '', expected_end_date: '', total_sessions: '', sessions_done: '', treatment_notes: '', doctor_notes: '' });
      fetch();
    } catch {}
    setSaving(false);
  };

  const updateStage = async (id: number, stage: string) => {
    try { await supabase.from('treatments').update({ stage }).eq('id', id); fetch(); } catch {}
  };

  const filtered = records.filter(r => {
    const s = search.toLowerCase();
    const m = !search || r.patient_name?.toLowerCase().includes(s) || r.phone?.includes(s) || r.treatment_type?.toLowerCase().includes(s);
    const f = filter === 'All' || r.stage === filter;
    return m && f;
  });

  const stageColor: Record<string, string> = {
    'Assessment': 'bg-slate-100 text-slate-600',
    'Treatment Started': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    'Review': 'bg-purple-100 text-purple-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
  };

  const stageIcon: Record<string, JSX.Element> = {
    'Assessment': <ClipboardList size={12} />,
    'Treatment Started': <Clock size={12} />,
    'In Progress': <Clock size={12} />,
    'Review': <Clock size={12} />,
    'Completed': <CheckCircle2 size={12} />,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or treatment…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
          <option value="All">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAGES.map(stage => {
          const count = records.filter(r => r.stage === stage).length;
          return (
            <div key={stage} className={`p-3 rounded-xl border text-center cursor-pointer transition ${filter === stage ? 'ring-2 ring-teal-500' : ''} ${stageColor[stage]}`}
              onClick={() => setFilter(filter === stage ? 'All' : stage)}>
              <p className="text-2xl font-black">{count}</p>
              <p className="text-xs font-medium mt-0.5">{stage}</p>
            </div>
          );
        })}
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Stethoscope size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm">No treatment records found</p>
            <p className="text-slate-300 text-xs mt-1">Note: requires a "treatments" table in Supabase</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(r => (
              <div key={r.id} className="p-4 hover:bg-slate-50 transition cursor-pointer" onClick={() => setSelected(r)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold flex-shrink-0">
                    {r.patient_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{r.patient_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${stageColor[r.stage]}`}>
                        {stageIcon[r.stage]}{r.stage}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{r.treatment_type}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                      {r.start_date && <span>Started: {r.start_date}</span>}
                      {r.total_sessions && <span>Sessions: {r.sessions_done || 0}/{r.total_sessions}</span>}
                      {r.phone && <span>{r.phone}</span>}
                    </div>
                    {r.total_sessions && (
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(100, ((r.sessions_done || 0) / r.total_sessions) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <select value={r.stage} onClick={e => e.stopPropagation()} onChange={e => updateStage(r.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium border-0 cursor-pointer flex-shrink-0 ${stageColor[r.stage]}`}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Treatment Details</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div><span className="text-slate-400 text-xs">Patient</span><p className="font-semibold text-slate-800">{selected.patient_name}</p></div>
              <div><span className="text-slate-400 text-xs">Treatment</span><p className="text-slate-700">{selected.treatment_type}</p></div>
              <div><span className="text-slate-400 text-xs">Stage</span>
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${stageColor[selected.stage]}`}>{selected.stage}</span>
              </div>
              {selected.treatment_notes && <div><span className="text-slate-400 text-xs">Notes</span><p className="text-slate-600 mt-1">{selected.treatment_notes}</p></div>}
              {selected.doctor_notes && <div><span className="text-slate-400 text-xs">Doctor Notes</span><p className="text-slate-600 mt-1">{selected.doctor_notes}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Add Treatment Record</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Patient Name *</label>
                <input value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Treatment Type *</label>
                <select value={form.treatment_type} onChange={e => setForm(f => ({ ...f, treatment_type: e.target.value }))} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  <option value="">Select</option>{TREATMENTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Total Sessions</label>
                  <input type="number" value={form.total_sessions} onChange={e => setForm(f => ({ ...f, total_sessions: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Sessions Done</label>
                  <input type="number" value={form.sessions_done} onChange={e => setForm(f => ({ ...f, sessions_done: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Treatment Notes</label>
                <textarea value={form.treatment_notes} onChange={e => setForm(f => ({ ...f, treatment_notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Treatment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
