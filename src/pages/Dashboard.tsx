import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Loader2, Plus, Users, School, Shield, User, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [operatorName, setOperatorName] = useState(user?.username);
  const [stats, setStats] = useState({
    totalSekolah: 0,
    totalAkun: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      const cacheKey = `sekolah_data_${user?.role}_${user?.sekolah || 'all'}`;
      let cachedData = sessionStorage.getItem(cacheKey);
      let parsedData = null;

      if (cachedData) {
        try {
          parsedData = JSON.parse(cachedData);
        } catch (e) {}
      }

      // If no cache or if we need operator name but it's not in cache, fetch it
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
      <div className="space-y-6 max-w-5xl mx-auto mt-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-indigo-50 border border-white/20 text-sm font-medium">
                <Shield size={16} />
                <span>Admin Sekolah</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Selamat Datang, {operatorName}
              </h2>
              <p className="text-indigo-100 text-lg max-w-xl">
                Anda login sebagai representasi dari <span className="font-semibold text-white">{user?.sekolah}</span>. Kelola administrasi sekolah dengan mudah dan cepat melalui SIAP BOS.
              </p>
            </div>
            
            <div className="hidden md:flex p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <Building2 size={64} className="text-white/80" />
            </div>
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
