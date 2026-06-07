import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, Plus, Phone, MapPin, X, Calendar,
  CheckCircle2, ChevronRight, ArrowRight, AlertCircle, Clock,
  Stethoscope, UserCheck, RotateCcw
} from 'lucide-react';

type PatientStatus = 'Registered' | 'Waiting' | 'In Treatment' | 'Follow-up Required' | 'Completed';

interface Patient {
  id: number; patient_code: string; name: string; phone: string;
  email: string; location: string; created_at: string;
  age?: string; gender?: string; notes?: string;
  patient_status?: PatientStatus;
}

const STATUS_FLOW: PatientStatus[] = ['Registered', 'Waiting', 'In Treatment', 'Follow-up Required', 'Completed'];

const STATUS_STYLE: Record<PatientStatus, { bg: string; text: string; border: string; icon: any }> = {
  Registered:          { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200', icon: UserCheck },
  Waiting:             { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200', icon: Clock },
  'In Treatment':      { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',  icon: Stethoscope },
  'Follow-up Required':{ bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',icon: AlertCircle },
  Completed:           { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200',icon: CheckCircle2 },
};

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PatientStatus>('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', location: '', age: '', gender: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
    setPatients(data || []);
    setLoading(false);
  };

  const openPatient = async (p: Patient) => {
    setSelected(p);
    const { data } = await supabase.from('appointments').select('*').eq('patient_id', p.id).order('created_at', { ascending: false });
    setAppointments(data || []);
  };

  const savePatient = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const code = `SDC-${Date.now()}`;
    const { error } = await supabase.from('patients').insert([{
      ...form, patient_code: code, patient_status: 'Registered'
    }]);
    if (!error) {
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', location: '', age: '', gender: '', notes: '' });
      fetchPatients();
    }
    setSaving(false);
  };

  const moveToStatus = async (patient: Patient, newStatus: PatientStatus) => {
    setUpdatingStatus(true);
    await supabase.from('patients').update({ patient_status: newStatus }).eq('id', patient.id);
    if (selected?.id === patient.id) setSelected({ ...patient, patient_status: newStatus });
    await fetchPatients();
    setUpdatingStatus(false);
  };

  const markCompleted = async (patient: Patient) => {
    setCompletingId(patient.id);
    try {
      // Update patient status to Completed
      await supabase.from('patients').update({
        patient_status: 'Completed',
      }).eq('id', patient.id);

      // Update all pending/in-treatment appointments for this patient to Completed
      await supabase.from('appointments')
        .update({ status: 'Completed' })
        .eq('patient_id', patient.id)
        .in('status', ['Pending', 'In Treatment']);

      if (selected?.id === patient.id) {
        setSelected({ ...patient, patient_status: 'Completed' });
        // Re-fetch appointments to show updated status
        const { data } = await supabase.from('appointments').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false });
        setAppointments(data || []);
      }
      await fetchPatients();
    } catch (e) { console.error(e); }
    setCompletingId(null);
  };

  const getNextStatus = (current?: PatientStatus): PatientStatus | null => {
    if (!current) return 'Waiting';
    const idx = STATUS_FLOW.indexOf(current);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  };

  const filtered = patients.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search) || p.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.patient_status === statusFilter ||
      (!p.patient_status && statusFilter === 'Registered');
    return matchSearch && matchStatus;
  });

  const statusCounts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = patients.filter(p => p.patient_status === s || (!p.patient_status && s === 'Registered')).length;
    return acc;
  }, {} as Record<string, number>);

  const apptStatusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'Pending') return 'bg-amber-100 text-amber-700';
    if (s === 'Cancelled') return 'bg-red-100 text-red-700';
    if (s === 'In Treatment') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, location…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition">
          <Plus size={16} /> Add Patient
        </button>
      </div>

      {/* Workflow stage filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${statusFilter === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
          All ({patients.length})
        </button>
        {STATUS_FLOW.map(s => {
          const style = STATUS_STYLE[s];
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${active ? `${style.bg} ${style.text} ${style.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
              {s} ({statusCounts[s] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Patient table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No patients found</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Patient', 'Code', 'Phone', 'Location', 'Status', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(p => {
                    const status = (p.patient_status || 'Registered') as PatientStatus;
                    const style = STATUS_STYLE[status];
                    const nextStatus = getNextStatus(status);
                    const isCompleting = completingId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {p.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                              {p.age && <p className="text-xs text-slate-400">{p.age}y · {p.gender}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">{p.patient_code}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{p.phone}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.location}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                            <style.icon size={11} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openPatient(p)} className="text-teal-600 hover:underline text-xs font-semibold">View</button>
                            {status !== 'Completed' && nextStatus && (
                              <button
                                onClick={() => nextStatus === 'Completed' ? markCompleted(p) : moveToStatus(p, nextStatus)}
                                disabled={isCompleting || updatingStatus}
                                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition disabled:opacity-50">
                                {isCompleting ? <RotateCcw size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                                {nextStatus === 'Completed' ? 'Complete' : nextStatus}
                              </button>
                            )}
                            {status === 'Completed' && (
                              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 size={12} /> Done
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(p => {
                const status = (p.patient_status || 'Registered') as PatientStatus;
                const style = STATUS_STYLE[status];
                return (
                  <div key={p.id} className="p-4 hover:bg-slate-50 transition" onClick={() => openPatient(p)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold flex-shrink-0">
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.phone} · {p.location}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.bg} ${style.text}`}>{status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Patient detail modal */}
      {selected && (() => {
        const status = (selected.patient_status || 'Registered') as PatientStatus;
        const style = STATUS_STYLE[status];
        const nextStatus = getNextStatus(status);
        const currentIdx = STATUS_FLOW.indexOf(status);
        const isCompleting = completingId === selected.id;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Patient Profile</h3>
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-5">
                {/* Profile header */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {selected.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-lg leading-tight">{selected.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{selected.patient_code}</p>
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border mt-2 ${style.bg} ${style.text} ${style.border}`}>
                      <style.icon size={11} />
                      {status}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                      <Phone size={13} className="text-slate-400" />{selected.phone}
                    </div>
                  )}
                  {selected.location && (
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                      <MapPin size={13} className="text-slate-400" />{selected.location}
                    </div>
                  )}
                  {selected.age && (
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 rounded-xl px-3 py-2 col-span-2">
                      Age: {selected.age} · {selected.gender}
                    </div>
                  )}
                </div>

                {/* Workflow stepper */}
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Patient Journey</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_FLOW.map((s, i) => {
                      const done = i < currentIdx;
                      const active = i === currentIdx;
                      const sStyle = STATUS_STYLE[s as PatientStatus];
                      return (
                        <div key={s} className="flex items-center gap-1.5">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border
                            ${active ? `${sStyle.bg} ${sStyle.text} ${sStyle.border}` :
                              done ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                              'bg-white text-slate-400 border-slate-200'}`}>
                            {done ? <CheckCircle2 size={11} /> : <sStyle.icon size={11} />}
                            {s}
                          </div>
                          {i < STATUS_FLOW.length - 1 && <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  {/* Mark as Completed - primary CTA */}
                  {status !== 'Completed' && (
                    <button
                      onClick={() => markCompleted(selected)}
                      disabled={isCompleting}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-60"
                    >
                      {isCompleting ? (
                        <><RotateCcw size={16} className="animate-spin" /> Completing…</>
                      ) : (
                        <><CheckCircle2 size={16} /> Mark as Completed</>
                      )}
                    </button>
                  )}

                  {/* Move to next stage */}
                  {status !== 'Completed' && nextStatus && nextStatus !== 'Completed' && (
                    <button
                      onClick={() => moveToStatus(selected, nextStatus)}
                      disabled={updatingStatus}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-sm transition disabled:opacity-60"
                    >
                      <ArrowRight size={15} /> Move to: {nextStatus}
                    </button>
                  )}

                  {/* Status picker */}
                  {status !== 'Completed' && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {STATUS_FLOW.filter(s => s !== 'Completed' && s !== status).map(s => (
                        <button key={s} onClick={() => moveToStatus(selected, s as PatientStatus)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-medium">
                          → {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {status === 'Completed' && (
                    <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span className="font-semibold text-emerald-700">Treatment Completed</span>
                    </div>
                  )}
                </div>

                {/* Appointment history */}
                {appointments.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700 text-sm mb-2">Visit History ({appointments.length})</p>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {appointments.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <Calendar size={13} className="text-teal-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{a.treatment || 'Appointment'}</p>
                            <p className="text-xs text-slate-400">{a.next_visit} {a.appointment_time ? `· ${a.appointment_time}` : ''}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${apptStatusColor(a.status)}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add patient modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Add New Patient</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={savePatient} className="p-5 space-y-3">
              {[
                { key: 'name', label: 'Full Name', required: true, type: 'text' },
                { key: 'phone', label: 'Phone Number', required: true, type: 'tel' },
                { key: 'email', label: 'Email', required: false, type: 'email' },
                { key: 'location', label: 'Location / Area', required: false, type: 'text' },
                { key: 'age', label: 'Age', required: false, type: 'text' },
              ].map(({ key, label, required, type }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}{required && ' *'}</label>
                  <input type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                  <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition disabled:opacity-60 shadow-sm">
                {saving ? 'Saving…' : 'Add Patient'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
