import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { 
  Loader2, Plus, Users, School, Shield, Building2,
  Wallet, TrendingUp, Calendar, Activity, CheckCircle2, ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ALL_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [operatorName, setOperatorName] = useState(user?.username);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });
  const [rkasTotal, setRkasTotal] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<{ month: string; total: number; hasData: boolean }[]>([]);
  const [stats, setStats] = useState({
    totalSekolah: 0,
    totalAkun: 0
  });

  const formatValueIfDate = (val: any, isDateColumn: boolean): string => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (str === '') return '';
    if (str.includes('(')) str = str.split('(')[0].trim();
    const isDateObjectString = str.includes('GMT') || str.includes('UTC') || /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d+/.test(str);
    if (isDateObjectString) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return isDateColumn ? `${dd}/${mm}/${yyyy}` : `${dd}.${mm}.${String(yyyy % 100).padStart(2, '0')}.`;
      }
    }
    return str;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Basic Stats Fetching
      const cacheKey = `sekolah_data_${user?.role}_${user?.sekolah || 'all'}`;
      let cachedData = sessionStorage.getItem(cacheKey);
      let parsedData = null;

      if (cachedData) {
        try {
          parsedData = JSON.parse(cachedData);
        } catch (e) {}
      }

      if (!parsedData) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getDataSekolah`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ role: user?.role, sekolah: user?.sekolah })
          });
          const data = await response.json();
          if (data.success && data.data && data.data.length > 0) {
            let rows = data.data;
            if (rows[0] && (rows[0][0] === "ID" || rows[0][0] === "id" || (typeof rows[0][0] === "string" && rows[0][0].toLowerCase() === "id") || rows[0][0] === "NPSN")) {
              rows = rows.slice(1);
            }
            parsedData = rows.map((row: any) => {
              if (row.length === 9 || (row[0] && row[0].toString().length === 8 && !row[1])) {
                return { operator: row[9] };
              }
              return { operator: row[10] };
            });
            sessionStorage.setItem(cacheKey, JSON.stringify(parsedData));
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (parsedData && parsedData.length > 0) {
        setStats({
          totalSekolah: parsedData.length,
          totalAkun: user?.role === 'master_admin' ? parsedData.length * 2 + 1 : 1
        });
        if (user?.role === 'admin_sekolah') {
          setOperatorName(parsedData[0]?.operator || user?.username);
        }
      }

      // Detailed Data for Admin Sekolah
      if (user?.role === 'admin_sekolah' && user?.sekolah) {
        try {
          // 1. Fetch RKAS Phased for total budget
          const rkasCacheKey = `RKAS_PHASED_${user.sekolah}_${activeYear}`;
          let rkasRows = [];
          const cachedRkas = sessionStorage.getItem(rkasCacheKey);
          if (cachedRkas) {
            rkasRows = JSON.parse(cachedRkas);
            let totalAnggaran = 0;
            rkasRows.forEach((it: any) => {
              const h = parseFloat(String(it.tarifHarga || it.harga || 0).replace(/[^0-9.-]+/g, '')) || 0;
              const v = parseFloat(it.volume || 0) || 0;
              totalAnggaran += h * v;
            });
            setRkasTotal(totalAnggaran);
          }
          
          // Refresh RKAS in background and update if changed
          fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ sekolah: user.sekolah, tahun: activeYear, tipe: 'RKAS_PHASED' })
          }).then(res => res.json()).then(rkasRes => {
            if (rkasRes.success && rkasRes.rows) {
              sessionStorage.setItem(rkasCacheKey, JSON.stringify(rkasRes.rows));
              let totalAnggaran = 0;
              rkasRes.rows.forEach((it: any) => {
                const h = parseFloat(String(it.tarifHarga || it.harga || 0).replace(/[^0-9.-]+/g, '')) || 0;
                const v = parseFloat(it.volume || 0) || 0;
                totalAnggaran += h * v;
              });
              setRkasTotal(totalAnggaran);
            }
          }).catch(() => {});

          // 2. Fetch BKU Months status AND Totals in ONE request!
          const monthsResponse = await fetch(`${import.meta.env.VITE_API_URL}?action=checkBkuMonths`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ sekolah: user.sekolah, tahun: activeYear })
          });
          const monthsData = await monthsResponse.json();
          const activeMonths: string[] = monthsData.success && monthsData.months ? monthsData.months : [];
          const backendTotals: Record<string, number> = monthsData.success && monthsData.totals ? monthsData.totals : {};

          // Generate stats without 12 extra requests
          const mStats = ALL_MONTHS.map(m => ({
            month: m,
            total: backendTotals[m] || 0,
            hasData: activeMonths.includes(m)
          }));
          
          setMonthlyStats(mStats);
        } catch (e) {
          console.error("Dashboard detailed fetch error:", e);
        }
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  if (user?.role === 'admin_sekolah') {
    return (
      <div className="space-y-4 max-w-6xl mx-auto mt-4 px-4 pb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full blur-[60px] transform -translate-x-1/3 translate-y-1/3"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-indigo-50 border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                <Shield size={12} className="text-emerald-400" />
                <span>Portal Admin {user?.sekolah}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
                Selamat Datang, <br className="md:hidden" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
                  {operatorName}
                </span>
              </h2>
              <p className="text-indigo-100 text-base max-w-lg font-medium opacity-90 leading-relaxed">
                Platform SIAP BOS siap membantu transparansi dan akuntabilitas pengelolaan dana BOS Anda.
              </p>
            </div>
            
            <div className="hidden lg:flex p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-inner group transition-transform hover:scale-105 duration-500">
              <div className="relative">
                <Building2 size={56} className="text-white/80" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full blur-sm"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid for Admin Sekolah */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-lg border border-gray-100 dark:border-gray-800 flex items-center gap-5 group hover:shadow-xl transition-all duration-300"
          >
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Anggaran Tahunan {activeYear}</p>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                Rp {rkasTotal.toLocaleString('id-ID')}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-600 text-[10px] font-bold">
                <ArrowUpRight size={12} />
                <span>Sesuai Database Aktif</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-lg border border-gray-100 dark:border-gray-800 flex items-center gap-5 group hover:shadow-xl transition-all duration-300"
          >
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Realisasi BOS</p>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                Rp {monthlyStats.reduce((acc, curr) => acc + curr.total, 0).toLocaleString('id-ID')}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-indigo-600 text-[10px] font-bold">
                <Calendar size={12} />
                <span>Data Akumulasi BKU</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Realization Table Per Month */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden relative"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
                <Activity size={24} className="text-indigo-500" />
                Realisasi Dana BOS Per Bulan
              </h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mt-0.5">Data penyerapan anggaran berdasarkan catatan BKU terkini.</p>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest self-start sm:self-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              Lampu Hijau: Terinput
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthlyStats.length > 0 ? (
              monthlyStats.map((st, idx) => (
                <div 
                  key={idx} 
                  className={`relative overflow-hidden group p-4 rounded-2xl border transition-all duration-500 ${
                    st.hasData 
                      ? 'bg-white dark:bg-gray-800 border-emerald-100 dark:border-emerald-900/10 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm hover:shadow-lg' 
                      : 'bg-gray-50/50 dark:bg-gray-950/30 border-gray-100 dark:border-gray-800 opacity-60'
                  }`}
                >
                   {st.hasData && (
                     <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
                   )}

                  <div className="flex justify-between items-start relative z-10 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 group-hover:text-gray-600 transition-colors">
                      {st.month}
                    </span>
                    {st.hasData && (
                      <motion.div 
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-emerald-500" 
                      />
                    )}
                  </div>
                  
                  <div className="relative z-10">
                    <p className={`text-lg font-black tabular-nums transition-colors ${st.hasData ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                      Rp {st.total.toLocaleString('id-ID')}
                    </p>
                    {st.hasData && (
                      <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                        <CheckCircle2 size={10} />
                        Data Ada
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              // Skeletal loading or placeholder
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-50 animate-pulse rounded-2xl" />
              ))
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard Overview</h2>
        {user?.role === 'master_admin' && (
          <button 
            onClick={() => navigate('/sekolah/tambah')}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"
          >
            <Plus size={20} /> Tambah Sekolah
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Sekolah</p>
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.totalSekolah}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-xl">
              <School size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Akun</p>
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.totalAkun}</h3>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-500 rounded-xl">
              <Users size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Role Anda</p>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mt-1 capitalize">{user?.role?.replace('_', ' ')}</h3>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-500 rounded-xl">
              <Shield size={24} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* User Info Card Default */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl"
      >
        <h3 className="text-2xl font-bold mb-2">Selamat Datang, {user?.username}</h3>
        <p className="text-indigo-100">Anda login sebagai {user?.role.replace('_', ' ')}. Kelola administrasi sekolah dengan mudah dan cepat melalui SIAP BOS.</p>
      </motion.div>
    </div>
  );
}
