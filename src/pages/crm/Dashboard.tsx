import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, isLoggedIn } from '../../lib/auth';
import {
  Users, CalendarCheck, AlertCircle, DollarSign, UserCheck,
  Clock, CheckCircle2, Activity, TrendingUp, ArrowUpRight,
  Plus, Search, FileText, Stethoscope, CalendarPlus, ChevronRight,
  Hourglass, TriangleAlert, Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const TREATMENT_TYPES = ['RCT', 'Scaling', 'Crown', 'Extraction', 'Orthodontics', 'Implant', 'Cleaning', 'Filling'];

export default function CRMDashboard() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayTotal: 0, todayPending: 0, todayCompleted: 0,
    waitingPatients: 0, inTreatment: 0, followupDue: 0,
    overdueFollowups: 0, tomorrowFollowups: 0, upcomingFollowups: 0,
    completedTreatments: 0,
    todayCollection: 0, pendingBalance: 0, monthCollection: 0,
  });
  const [treatmentBreakdown, setTreatmentBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [monthlyCollection, setMonthlyCollection] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoggedIn()) { setLocation('/admin'); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const next7 = new Date(); next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split('T')[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      const [
        patientsRes, todayRes, todayPendingRes, todayCompletedRes,
        waitingRes, inTreatRes, overdueRes, tomorrowRes, upcomingRes,
        completedRes, recentRes, weekRes, monthlyRes,
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).neq('status', 'Cancelled').neq('status', 'Deleted'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Completed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'In Treatment'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).lt('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', tomorrowStr).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gt('next_visit', tomorrowStr).lte('next_visit', next7Str).neq('status', 'Cancelled').neq('status', 'Deleted'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'Completed'),
        supabase.from('appointments').select('*').neq('status', 'Deleted').order('created_at', { ascending: false }).limit(6),
        supabase.from('appointments').select('next_visit, status, treatment, amount_paid, balance_amount').neq('status', 'Deleted').order('next_visit', { ascending: false }).limit(300),
        admin ? supabase.from('appointments').select('next_visit, amount_paid, balance_amount').gte('next_visit', monthStartStr).neq('status', 'Deleted') : Promise.resolve({ data: [] }),
      ]);

      const allData = weekRes.data || [];

      // Weekly appointments chart
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const count = allData.filter((a: any) => a.next_visit === key).length;
        days.push({ day: label, count });
      }
      setWeeklyData(days);

      // Treatment breakdown
      const tMap: Record<string, number> = {};
      allData.forEach((a: any) => {
        if (!a.treatment) return;
        const key = TREATMENT_TYPES.find(t => a.treatment.toLowerCase().includes(t.toLowerCase())) || 'Other';
        tMap[key] = (tMap[key] || 0) + 1;
      });
      const breakdown = Object.entries(tMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
      setTreatmentBreakdown(breakdown);

      // Financial (admin only)
      let todayCollection = 0, pendingBalance = 0, monthCollection = 0;
      if (admin) {
        const monthlyData = (monthlyRes as any).data || [];
        todayCollection = allData.filter((a: any) => a.next_visit === today).reduce((t: number, a: any) => t + Number(a.amount_paid || 0), 0);
        pendingBalance = allData.reduce((t: number, a: any) => t + Number(a.balance_amount || 0), 0);
        monthCollection = monthlyData.reduce((t: number, a: any) => t + Number(a.amount_paid || 0), 0);

        // Monthly collection chart (last 30 days grouped by week)
        const weeks: Record<string, number> = {};
        monthlyData.forEach((a: any) => {
          const d = new Date(a.next_visit);
          const weekLabel = `W${Math.ceil(d.getDate() / 7)}`;
          weeks[weekLabel] = (weeks[weekLabel] || 0) + Number(a.amount_paid || 0);
        });
        setMonthlyCollection(Object.entries(weeks).map(([week, amount]) => ({ week, amount })));
      }

      setStats({
        totalPatients: patientsRes.count || 0,
        todayTotal: todayRes.count || 0,
        todayPending: todayPendingRes.count || 0,
        todayCompleted: todayCompletedRes.count || 0,
        waitingPatients: waitingRes.count || 0,
        inTreatment: inTreatRes.count || 0,
        followupDue: overdueRes.count || 0,
        overdueFollowups: overdueRes.count || 0,
        tomorrowFollowups: tomorrowRes.count || 0,
        upcomingFollowups: upcomingRes.count || 0,
        completedTreatments: completedRes.count || 0,
        todayCollection, pendingBalance, monthCollection,
      });

      setRecentAppointments(recentRes.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-9 h-9 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading dashboard…</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'Pending') return 'bg-amber-100 text-amber-700';
    if (s === 'Cancelled') return 'bg-red-100 text-red-700';
    if (s === 'In Treatment') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-5 pb-4">

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'teal' },
          { label: "Today's Appts", value: stats.todayTotal, icon: CalendarCheck, color: 'blue' },
          { label: 'Patients Waiting', value: stats.waitingPatients, icon: Hourglass, color: 'amber' },
          { label: 'Follow-ups Due', value: stats.overdueFollowups, icon: AlertCircle, color: 'rose' },
          { label: 'Completed', value: stats.completedTreatments, icon: CheckCircle2, color: 'emerald' },
          admin
            ? { label: 'Pending Balance', value: `₹${Number(stats.pendingBalance).toLocaleString('en-IN')}`, icon: DollarSign, color: 'purple' }
            : { label: 'In Treatment', value: stats.inTreatment, icon: Stethoscope, color: 'indigo' },
        ].map(({ label, value, icon: Icon, color }) => {
          const c: Record<string, string> = {
            teal: 'from-teal-50 to-white border-teal-100 text-teal-600',
            blue: 'from-blue-50 to-white border-blue-100 text-blue-600',
            amber: 'from-amber-50 to-white border-amber-100 text-amber-600',
            rose: 'from-rose-50 to-white border-rose-100 text-rose-600',
            emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-600',
            purple: 'from-purple-50 to-white border-purple-100 text-purple-600',
            indigo: 'from-indigo-50 to-white border-indigo-100 text-indigo-600',
          };
          return (
            <div key={label} className={`bg-gradient-to-b ${c[color].split(' ').slice(0,2).join(' ')} rounded-2xl p-4 border ${c[color].split(' ')[2]} shadow-sm`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-white border ${c[color].split(' ')[2]} shadow-sm`}>
                <Icon size={17} className={c[color].split(' ')[3]} />
              </div>
              <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-tight">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Admin-only Collections Row */}
      {admin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Today's Collections", value: `₹${Number(stats.todayCollection).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'bg-teal-600', sub: 'Payments received today' },
            { label: 'Monthly Collections', value: `₹${Number(stats.monthCollection).toLocaleString('en-IN')}`, icon: Activity, color: 'bg-blue-600', sub: 'This month total' },
            { label: 'Pending Balance', value: `₹${Number(stats.pendingBalance).toLocaleString('en-IN')}`, icon: AlertCircle, color: 'bg-amber-500', sub: 'Outstanding from patients' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Middle Row: Today's Appointments + Patient Queue + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <CalendarCheck size={15} className="text-teal-500" /> Today's Appointments
            </h3>
            <Link href="/crm/appointments">
              <span className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View <ChevronRight size={12} /></span>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Total Today', value: stats.todayTotal, color: 'bg-blue-500', text: 'text-blue-700' },
              { label: 'Pending', value: stats.todayPending, color: 'bg-amber-400', text: 'text-amber-700' },
              { label: 'Completed', value: stats.todayCompleted, color: 'bg-emerald-500', text: 'text-emerald-700' },
            ].map(({ label, value, color, text }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                <span className="text-sm text-slate-600 flex-1">{label}</span>
                <span className={`text-sm font-bold ${text}`}>{value}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-50">
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: stats.todayTotal > 0 ? `${(stats.todayCompleted / stats.todayTotal) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {stats.todayTotal > 0 ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) : 0}% completed
              </p>
            </div>
          </div>
        </div>

        {/* Patient Queue */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <Users size={15} className="text-blue-500" /> Patient Queue
            </h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Waiting', value: stats.waitingPatients, icon: Hourglass, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
              { label: 'In Treatment', value: stats.inTreatment, icon: Stethoscope, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
              { label: 'Follow-up Due', value: stats.followupDue, icon: Bell, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
            ].map(({ label, value, icon: Icon, bg, text, border }) => (
              <div key={label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${bg} ${border}`}>
                <Icon size={15} className={text} />
                <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
                <span className={`text-lg font-black ${text}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Tracker */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <Bell size={15} className="text-rose-500" /> Follow-up Tracker
            </h3>
            <Link href="/crm/followups">
              <span className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View <ChevronRight size={12} /></span>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Overdue', value: stats.overdueFollowups, icon: TriangleAlert, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
              { label: "Today's Follow-ups", value: stats.todayPending, icon: Clock, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
              { label: 'Upcoming (7 days)', value: stats.upcomingFollowups, icon: CalendarCheck, bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
            ].map(({ label, value, icon: Icon, bg, text, border }) => (
              <div key={label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${bg} ${border}`}>
                <Icon size={15} className={text} />
                <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
                <span className={`text-lg font-black ${text}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className={`grid grid-cols-1 ${admin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
        {/* Weekly appointments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-700 text-sm mb-4">Appointments This Week</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
              <Bar dataKey="count" name="Appointments" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Treatment breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-700 text-sm mb-4">Treatment Progress</h3>
          {treatmentBreakdown.length > 0 ? (
            <div className="space-y-2.5">
              {treatmentBreakdown.slice(0, 5).map(({ name, count }, i) => {
                const max = treatmentBreakdown[0].count;
                const pct = Math.round((count / max) * 100);
                const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{name}</span>
                      <span className="text-xs font-bold text-slate-700">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className={`h-1.5 rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {treatmentBreakdown.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-8">No treatment data yet</p>
              )}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No treatment data</div>
          )}
        </div>

        {/* Admin-only: Monthly revenue chart */}
        {admin && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700 text-sm">Monthly Revenue</h3>
              <Link href="/crm/collections">
                <span className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">Details <ArrowUpRight size={11} /></span>
              </Link>
            </div>
            {monthlyCollection.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={monthlyCollection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Collections']} />
                  <Line type="monotone" dataKey="amount" stroke="#0d9488" strokeWidth={2.5} dot={{ fill: '#0d9488', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No revenue data</div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 text-sm mb-4 flex items-center gap-2">
          <Activity size={15} className="text-teal-500" /> Quick Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Add Patient', icon: Plus, href: '/crm/patients', color: 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100' },
            { label: 'New Appointment', icon: CalendarPlus, href: '/crm/appointments', color: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' },
            { label: 'New Treatment', icon: Stethoscope, href: '/crm/treatments', color: 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100' },
            { label: 'Generate Bill', icon: FileText, href: '/crm/billing', color: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' },
            { label: 'Search Patient', icon: Search, href: '/crm/patients', color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
            ...(admin ? [{ label: 'Collections', icon: DollarSign, href: '/crm/collections', color: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' }] : []),
          ].map(({ label, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${color}`}>
                <Icon size={15} />
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <UserCheck size={15} className="text-teal-500" /> Recent Appointments
          </h3>
          <Link href="/crm/appointments">
            <span className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View all <ChevronRight size={12} /></span>
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {recentAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No appointments yet</div>
          ) : recentAppointments.map((a: any) => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition">
              <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                {a.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                <p className="text-xs text-slate-400">{a.treatment || '—'} · {a.phone}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor(a.status)}`}>
                  {a.status}
                </span>
                <p className="text-xs text-slate-400 mt-1">{a.next_visit}</p>
              </div>
              {admin && a.amount_paid > 0 && (
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-xs font-semibold text-emerald-600">₹{Number(a.amount_paid).toLocaleString('en-IN')}</p>
                  {a.balance_amount > 0 && <p className="text-xs text-rose-500">₹{Number(a.balance_amount).toLocaleString('en-IN')} due</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
