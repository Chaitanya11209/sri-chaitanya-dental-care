import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, X, Phone, Clock, Calendar } from 'lucide-react';

const STATUS_OPTIONS = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const TREATMENTS = ['Dental Implants', 'Root Canal', 'Teeth Whitening', 'Braces & Aligners', 'Scaling & Polishing', 'Tooth Extraction', 'Fillings', 'Crowns & Bridges', 'Pediatric Dentistry', 'Emergency Care', 'Consultation', 'Other'];

export default function Appointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', treatment: '', next_visit: '', appointment_time: '', location: '', notes: '', amount_paid: '', balance_amount: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('appointments').select('*').neq('status', 'Deleted').order('created_at', { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: number, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    fetch();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const { data: existing } = await supabase.from('patients').select('id').eq('phone', form.phone).single();
    let patientId = existing?.id;
    if (!patientId) {
      const { data: np } = await supabase.from('patients').insert([{ name: form.name, phone: form.phone, email: form.email, location: form.location, patient_code: `SDC-${Date.now()}` }]).select().single();
      patientId = np?.id;
    }
    await supabase.from('appointments').insert([{ ...form, patient_id: patientId, status: 'Pending', visit_count: 1 }]);
    setShowModal(false);
    setForm({ name: '', phone: '', email: '', treatment: '', next_visit: '', appointment_time: '', location: '', notes: '', amount_paid: '', balance_amount: '' });
    fetch();
    setSaving(false);
  };

  const filtered = appointments.filter(a => {
    const s = search.toLowerCase();
    const matchSearch = !search || a.name?.toLowerCase().includes(s) || a.phone?.includes(s) || a.treatment?.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    const matchDate = !dateFilter || a.next_visit === dateFilter;
    return matchSearch && matchStatus && matchDate;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Completed: 'bg-emerald-100 text-emerald-700',
      Pending: 'bg-amber-100 text-amber-700',
      Confirmed: 'bg-blue-100 text-blue-700',
      Cancelled: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, phone, treatment…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap">
          <Plus size={16} /> Book
        </button>
      </div>

      <div className="text-xs text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-100">
        {filtered.length} appointments
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No appointments found</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Patient', 'Treatment', 'Date & Time', 'Status', 'Amount', 'Balance', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 text-sm">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{a.treatment}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-slate-600"><Calendar size={12} />{a.next_visit}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-400"><Clock size={12} />{a.appointment_time}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-lg font-medium border-0 cursor-pointer ${statusBadge(a.status)}`}>
                          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">₹{a.amount_paid || 0}</td>
                      <td className="px-4 py-3 text-sm text-red-500 font-medium">₹{a.balance_amount || 0}</td>
                      <td className="px-4 py-3">
                        <a href={`https://wa.me/91${a.phone}?text=Hi ${a.name}, your appointment for ${a.treatment} is on ${a.next_visit} at ${a.appointment_time}. Thank you! - Sri Chaitanya Dental Care`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-teal-600 hover:underline font-medium">WhatsApp</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(a => (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{a.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10} />{a.phone}</p>
                    </div>
                    <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium ${statusBadge(a.status)}`}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-slate-600">{a.treatment} · {a.next_visit} {a.appointment_time}</p>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span className="text-emerald-600">Paid: ₹{a.amount_paid || 0}</span>
                    <span className="text-red-500">Balance: ₹{a.balance_amount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Book modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Book Appointment</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              {[
                { key: 'name', label: 'Patient Name', req: true },
                { key: 'phone', label: 'Phone', req: true },
                { key: 'email', label: 'Email', req: false },
                { key: 'location', label: 'Location', req: false },
              ].map(({ key, label, req }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{label}{req && ' *'}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={req}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Treatment *</label>
                <select value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))} required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  <option value="">Select treatment</option>
                  {TREATMENTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
                  <input type="date" value={form.next_visit} onChange={e => setForm(f => ({ ...f, next_visit: e.target.value }))} required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Time</label>
                  <input type="time" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Amount Paid (₹)</label>
                  <input type="number" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Balance (₹)</label>
                  <input type="number" value={form.balance_amount} onChange={e => setForm(f => ({ ...f, balance_amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition disabled:opacity-60">
                {saving ? 'Booking…' : 'Book Appointment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
