import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, AlertCircle, Clock, Calendar, MessageCircle, CheckCircle } from 'lucide-react';

type Tab = 'overdue' | 'today' | 'tomorrow' | 'upcoming';

export default function Followups() {
  const [tab, setTab] = useState<Tab>('today');
  const [data, setData] = useState<Record<Tab, any[]>>({ overdue: [], today: [], tomorrow: [], upcoming: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const [overdueRes, todayRes, tomorrowRes, upcomingRes] = await Promise.all([
      supabase.from('appointments').select('*').lt('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")').order('next_visit', { ascending: false }),
      supabase.from('appointments').select('*').eq('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")'),
      supabase.from('appointments').select('*').eq('next_visit', tomorrow).not('status', 'in', '("Completed","Cancelled","Deleted")'),
      supabase.from('appointments').select('*').gt('next_visit', tomorrow).lte('next_visit', in7days).not('status', 'in', '("Completed","Cancelled","Deleted")').order('next_visit', { ascending: true }),
    ]);

    setData({
      overdue: overdueRes.data || [],
      today: todayRes.data || [],
      tomorrow: tomorrowRes.data || [],
      upcoming: upcomingRes.data || [],
    });
    setLoading(false);
  };

  const markCompleted = async (id: number) => {
    await supabase.from('appointments').update({ status: 'Completed' }).eq('id', id);
    fetchAll();
  };

  const waMessage = (a: any) =>
    `https://wa.me/91${a.phone}?text=${encodeURIComponent(`Hi ${a.name}, this is a reminder for your dental appointment at Sri Chaitanya Dental Care on ${a.next_visit}${a.appointment_time ? ' at ' + a.appointment_time : ''}. Please confirm your visit. Thank you!`)}`;

  const tabs: { id: Tab; label: string; icon: typeof Bell; color: string }[] = [
    { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-500' },
    { id: 'today', label: 'Today', icon: Clock, color: 'text-amber-500' },
    { id: 'tomorrow', label: 'Tomorrow', icon: Calendar, color: 'text-blue-500' },
    { id: 'upcoming', label: 'Upcoming (7d)', icon: Bell, color: 'text-teal-500' },
  ];

  const tabColor: Record<Tab, string> = {
    overdue: 'bg-red-50 text-red-700 border-red-100',
    today: 'bg-amber-50 text-amber-700 border-amber-100',
    tomorrow: 'bg-blue-50 text-blue-700 border-blue-100',
    upcoming: 'bg-teal-50 text-teal-700 border-teal-100',
  };

  const cardColor: Record<Tab, string> = {
    overdue: 'border-red-100',
    today: 'border-amber-100',
    tomorrow: 'border-blue-100',
    upcoming: 'border-teal-100',
  };

  const list = data[tab];

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabs.map(({ id, label, icon: Icon, color }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-3 p-3 rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${tab === id ? 'ring-2 ring-teal-400' : ''}`}>
            <Icon size={20} className={color} />
            <div className="text-left">
              <p className="text-xl font-black text-slate-800">{data[id].length}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab header */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${tabColor[tab]}`}>
        {(() => { const T = tabs.find(t => t.id === tab)!; return <T.icon size={16} />; })()}
        <span className="font-semibold text-sm">
          {tabs.find(t => t.id === tab)?.label} Follow-ups — {list.length} patients
        </span>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-100">
          <CheckCircle size={40} className="mx-auto text-emerald-300 mb-3" />
          <p className="text-slate-400 text-sm">All clear! No {tabs.find(t => t.id === tab)?.label.toLowerCase()} follow-ups.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((a: any) => (
            <div key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${cardColor[tab]}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 font-bold flex-shrink-0">
                  {a.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
                  ${a.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {a.status}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                <p className="text-xs text-slate-600"><span className="text-slate-400">Treatment:</span> {a.treatment}</p>
                <p className="text-xs text-slate-600">
                  <span className="text-slate-400">Scheduled:</span> {a.next_visit}
                  {a.appointment_time && ` at ${a.appointment_time}`}
                </p>
                {Number(a.balance_amount || 0) > 0 && (
                  <p className="text-xs text-red-500"><span className="text-slate-400">Balance:</span> ₹{Number(a.balance_amount).toLocaleString('en-IN')}</p>
                )}
              </div>

              <div className="flex gap-2">
                <a href={waMessage(a)} target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition">
                  <MessageCircle size={13} /> WhatsApp
                </a>
                <button onClick={() => markCompleted(a.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition">
                  <CheckCircle size={13} /> Done
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
