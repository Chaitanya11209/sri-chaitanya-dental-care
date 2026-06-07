import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin } from '../../lib/auth';
import {
  Search, Plus, Phone, MapPin, X, Calendar, ChevronLeft, ChevronRight,
  CheckCircle2, UserCheck, Clock, Stethoscope, AlertCircle, DollarSign,
  FileText, Users, UserPlus, Bell, RotateCcw, ArrowRight, Mail,
  Activity, Eye, MessageCircle, ClipboardList, CreditCard, Wallet
} from 'lucide-react';

type PatientStatus = 'Registered' | 'Waiting' | 'In Treatment' | 'Follow-up Required' | 'Completed';
type TabType = 'demographics' | 'treatments' | 'appointments' | 'followups' | 'billing';

interface Patient {
  id: number;
  patient_code: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  age: string;
  gender: string;
  notes: string;
  patient_status: PatientStatus;
  last_visit_date: string | null;
  next_visit_date: string | null;
  treatment_summary: string | null;
  created_at: string;
}

interface PatientAppointment {
  id: number;
  treatment: string;
  next_visit: string;
  appointment_time: string;
  status: string;
  amount_paid: number;
  balance_amount: number;
  payment_mode: string;
  created_at: string;
}

interface Treatment {
  id: number;
  treatment_type: string;
  stage: string;
  start_date: string;
  expected_end_date: string;
  total_sessions: number;
  sessions_done: number;
  treatment_notes: string;
  status: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const STATUS_OPTIONS: PatientStatus[] = ['Registered', 'Waiting', 'In Treatment', 'Follow-up Required', 'Completed'];

const STATUS_STYLE: Record<PatientStatus, { bg: string; text: string; border: string; icon: typeof UserCheck }> = {
  Registered:          { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   icon: UserCheck },
  Waiting:             { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Clock },
  'In Treatment':      { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',   icon: Stethoscope },
  'Follow-up Required':{ bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200', icon: AlertCircle },
  Completed:           { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
};

export default function Patients() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selected, setSelected] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('demographics');
  const [patientAppointments, setPatientAppointments] = useState<PatientAppointment[]>([]);
  const [patientTreatments, setPatientTreatments] = useState<Treatment[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', location: '', age: '', gender: '', notes: ''
  });

  const [summary, setSummary] = useState({
    total: 0,
    newThisMonth: 0,
    followupsDue: 0,
    activeTreatments: 0
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch summary stats
  useEffect(() => {
    const fetchSummary = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const [totalRes, newRes, followupRes, activeRes] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('patient_status', 'Follow-up Required'),
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('patient_status', 'In Treatment'),
      ]);

      setSummary({
        total: totalRes.count || 0,
        newThisMonth: newRes.count || 0,
        followupsDue: followupRes.count || 0,
        activeTreatments: activeRes.count || 0,
      });
    };
    fetchSummary();
  }, [patients]);

  // Fetch patients with server-side pagination
  useEffect(() => {
    fetchPatients();
  }, [debouncedSearch, statusFilter, currentPage, pageSize]);

  const fetchPatients = async () => {
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' });

    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      query = query.or(`name.ilike.%${searchLower}%,phone.ilike.%${debouncedSearch}%,patient_code.ilike.%${debouncedSearch}%`);
    }

    // Status filter with enhanced options
    if (statusFilter === 'new') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      query = query.gte('created_at', startOfMonth);
    } else if (statusFilter === 'returning') {
      query = query.not('last_visit_date', 'is', null).gt('last_visit_date', new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0]);
    } else if (statusFilter === 'followup') {
      query = query.eq('patient_status', 'Follow-up Required');
    } else if (statusFilter === 'ongoing') {
      query = query.eq('patient_status', 'In Treatment');
    } else if (statusFilter === 'completed') {
      query = query.eq('patient_status', 'Completed');
    } else if (statusFilter !== 'all') {
      query = query.eq('patient_status', statusFilter);
    }

    // Order by last visit descending, then created_at descending
    query = query.order('last_visit_date', { ascending: true, nullsFirst: false });
    query = query.order('created_at', { ascending: false });
    query = query.range(from, to);

    const { data, count } = await query;
    setPatients(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const openPatientProfile = async (p: Patient) => {
    setSelected(p);
    setActiveTab('demographics');

    // Fetch related data
    const [apptRes, treatRes] = await Promise.all([
      supabase.from('appointments').select('*').eq('patient_id', p.id).order('created_at', { ascending: false }),
      supabase.from('treatments').select('*').eq('patient_id', p.id).order('created_at', { ascending: false }),
    ]);

    setPatientAppointments(apptRes.data || []);
    setPatientTreatments(treatRes.data || []);
  };

  const savePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const code = `SDC-${Date.now()}`;
    const { error } = await supabase.from('patients').insert([{
      ...form, patient_code: code, patient_status: 'Registered'
    }]);
    if (!error) {
      setShowAddModal(false);
      setForm({ name: '', phone: '', email: '', location: '', age: '', gender: '', notes: '' });
      fetchPatients();
    }
    setSaving(false);
  };

  const updatePatientStatus = async (patient: Patient, newStatus: PatientStatus) => {
    await supabase.from('patients').update({ patient_status: newStatus }).eq('id', patient.id);
    if (selected?.id === patient.id) {
      setSelected({ ...patient, patient_status: newStatus });
    }
    fetchPatients();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const sendWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(`Hi ${name}, this is a reminder from Sri Chaitanya Dental Care about your upcoming appointment. Please confirm your visit. Thank you!`);
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  };

  // Summary cards
  const summaryCards = [
    { label: 'Total Patients', value: summary.total, icon: Users, color: 'text-teal-600 bg-teal-50' },
    { label: 'New This Month', value: summary.newThisMonth, icon: UserPlus, color: 'text-blue-600 bg-blue-50' },
    { label: 'Follow-ups Due', value: summary.followupsDue, icon: Bell, color: 'text-orange-600 bg-orange-50' },
    { label: 'Active Treatments', value: summary.activeTreatments, icon: Activity, color: 'text-indigo-600 bg-indigo-50' },
  ];

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Patients' },
    { value: 'new', label: 'New Patients' },
    { value: 'returning', label: 'Returning Patients' },
    { value: 'followup', label: 'Follow-up Due' },
    { value: 'ongoing', label: 'Treatment Ongoing' },
    { value: 'completed', label: 'Completed Treatment' },
  ];

  const apptStatusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'Pending' || s === 'Confirmed') return 'bg-amber-100 text-amber-700';
    if (s === 'Cancelled') return 'bg-red-100 text-red-700';
    if (s === 'In Treatment') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  const treatmentStatusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'In Progress') return 'bg-blue-100 text-blue-700';
    if (s === 'On Hold') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or Patient ID…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap"
        >
          <Plus size={16} /> Add Patient
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : patients.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No patients found</div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Patient ID', 'Name', 'Phone', 'Age', 'Gender', 'Treatment', 'Last Visit', 'Next Visit', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {patients.map(p => {
                    const status = (p.patient_status || 'Registered') as PatientStatus;
                    const style = STATUS_STYLE[status];
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">{p.patient_code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {p.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800 text-sm">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{p.phone}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.age || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.gender || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 max-w-[150px] truncate">{p.treatment_summary || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.last_visit_date)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.next_visit_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${style.bg} ${style.text}`}>
                            <style.icon size={11} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openPatientProfile(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-600" title="View Profile">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => setLocation(`/crm/appointments`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Add Appointment">
                              <Calendar size={14} />
                            </button>
                            <button onClick={() => setLocation(`/crm/treatments`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-purple-600" title="Add Treatment">
                              <ClipboardList size={14} />
                            </button>
                            {admin && (
                              <button onClick={() => setLocation(`/crm/billing`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-600" title="Generate Bill">
                                <FileText size={14} />
                              </button>
                            )}
                            <button onClick={() => sendWhatsApp(p.phone, p.name)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600" title="Send Reminder">
                              <MessageCircle size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {patients.map(p => {
                const status = (p.patient_status || 'Registered') as PatientStatus;
                const style = STATUS_STYLE[status];
                return (
                  <div key={p.id} className="p-4" onClick={() => openPatientProfile(p)}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold flex-shrink-0">
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{p.patient_code}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${style.bg} ${style.text}`}>
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Phone size={10} /> {p.phone}</span>
                          {p.age && <span>{p.age}y</span>}
                        </div>
                        {p.treatment_summary && (
                          <p className="text-xs text-slate-600 mt-1 truncate">{p.treatment_summary}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 rounded-lg border border-slate-200 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Profile Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  {selected.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{selected.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selected.patient_code}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 py-3 border-b overflow-x-auto flex-shrink-0">
              {[
                { id: 'demographics', label: 'Demographics', icon: Users },
                { id: 'appointments', label: 'Appointments', icon: Calendar },
                { id: 'treatments', label: 'Treatments', icon: ClipboardList },
                { id: 'followups', label: 'Follow-ups', icon: Bell },
                ...(admin ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as TabType)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    activeTab === id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'demographics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Phone</p>
                      <p className="text-sm font-medium text-slate-700">{selected.phone || '-'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Email</p>
                      <p className="text-sm font-medium text-slate-700">{selected.email || '-'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Location</p>
                      <p className="text-sm font-medium text-slate-700">{selected.location || '-'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Age / Gender</p>
                      <p className="text-sm font-medium text-slate-700">{selected.age || '-'} / {selected.gender || '-'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Last Visit</p>
                      <p className="text-sm font-medium text-slate-700">{formatDate(selected.last_visit_date)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Next Visit</p>
                      <p className="text-sm font-medium text-slate-700">{formatDate(selected.next_visit_date)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map(s => {
                        const isActive = (selected.patient_status || 'Registered') === s;
                        const style = STATUS_STYLE[s];
                        return (
                          <button
                            key={s}
                            onClick={() => updatePatientStatus(selected, s)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              isActive ? `${style.bg} ${style.text} ${style.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <style.icon size={11} />
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selected.notes && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Notes</p>
                      <p className="text-sm text-slate-700">{selected.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className="space-y-2">
                  {patientAppointments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No appointments found</div>
                  ) : (
                    patientAppointments.map(appt => (
                      <div key={appt.id} className="bg-slate-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{appt.treatment || 'Appointment'}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(appt.next_visit)} {appt.appointment_time && `at ${appt.appointment_time}`}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${apptStatusColor(appt.status)}`}>
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'treatments' && (
                <div className="space-y-2">
                  {patientTreatments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No treatments found</div>
                  ) : (
                    patientTreatments.map(treat => (
                      <div key={treat.id} className="bg-slate-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{treat.treatment_type}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {treat.stage} · Sessions: {treat.sessions_done}/{treat.total_sessions || '-'}
                            </p>
                            {treat.treatment_notes && (
                              <p className="text-xs text-slate-400 mt-1">{treat.treatment_notes}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${treatmentStatusColor(treat.status)}`}>
                            {treat.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'followups' && (
                <div className="space-y-2">
                  {patientAppointments.filter(a => a.status === 'Pending' || a.status === 'Confirmed').length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No pending follow-ups</div>
                  ) : (
                    patientAppointments
                      .filter(a => a.status === 'Pending' || a.status === 'Confirmed')
                      .map(appt => (
                        <div key={appt.id} className="bg-slate-50 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{appt.treatment || 'Follow-up'}</p>
                              <p className="text-xs text-slate-500">{formatDate(appt.next_visit)}</p>
                            </div>
                            <button
                              onClick={() => sendWhatsApp(selected.phone, selected.name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
                            >
                              <MessageCircle size={12} /> Remind
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {activeTab === 'billing' && admin && (
                <div className="space-y-2">
                  {patientAppointments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No billing history</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Wallet size={14} className="text-emerald-600" />
                            <span className="text-xs text-emerald-600">Total Paid</span>
                          </div>
                          <p className="text-lg font-bold text-emerald-700">
                            ₹{patientAppointments.reduce((sum, a) => sum + (Number(a.amount_paid) || 0), 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign size={14} className="text-red-500" />
                            <span className="text-xs text-red-500">Pending Balance</span>
                          </div>
                          <p className="text-lg font-bold text-red-600">
                            ₹{patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      {patientAppointments.filter(a => a.amount_paid > 0 || a.balance_amount > 0).map(appt => (
                        <div key={appt.id} className="bg-slate-50 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{appt.treatment || 'Appointment'}</p>
                              <p className="text-xs text-slate-500">{formatDate(appt.next_visit)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-600">₹{Number(appt.amount_paid || 0).toLocaleString('en-IN')}</p>
                              {Number(appt.balance_amount) > 0 && (
                                <p className="text-xs text-red-500">Balance: ₹{Number(appt.balance_amount).toLocaleString('en-IN')}</p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">{appt.payment_mode || 'Cash'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-3 border-t flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => sendWhatsApp(selected.phone, selected.name)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition"
              >
                <MessageCircle size={16} /> Send Reminder
              </button>
              <button
                onClick={() => setLocation('/crm/appointments')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-sm transition"
              >
                <Calendar size={16} /> Add Appointment
              </button>
              {admin && (
                <button
                  onClick={() => setLocation('/crm/billing')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold text-sm transition"
                >
                  <FileText size={16} /> Generate Bill
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Add New Patient</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={savePatient} className="p-5 space-y-3">
              {[
                { key: 'name', label: 'Full Name', required: true },
                { key: 'phone', label: 'Phone Number', required: true },
                { key: 'email', label: 'Email', required: false },
                { key: 'location', label: 'Location', required: false },
                { key: 'age', label: 'Age', required: false },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    {label}{required && ' *'}
                  </label>
                  <input
                    value={(form as any)[key]}
                    onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition disabled:opacity-60 shadow-sm"
              >
                {saving ? 'Saving…' : 'Add Patient'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
