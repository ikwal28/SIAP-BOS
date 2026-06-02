import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogIn, User, Lock, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleDemoLogin = async () => {
    setLoadingDemo(true);
    const toastId = toast.loading('Sedang menyiapkan Akun Demo...');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getDataSekolah`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          role: 'master_admin'
        }),
        redirect: 'follow'
      });

      const data = await response.json();
      let selectedDemoSchool: any = null;

      if (data.success && data.data && data.data.length > 0) {
        let rows = data.data;
        if (rows[0] && (rows[0][0] === "ID" || rows[0][0] === "id" || typeof rows[0][0] === "string" && rows[0][0].toLowerCase() === "id" || rows[0][0] === "NPSN")) {
          rows = rows.slice(1);
        }

        const formattedData = rows.map((row: any) => {
          if (row.length >= 9 && (row[0] && row[0].toString().length === 8 && !row[1])) {
             return {
               id: new Date().getTime(),
               npsn: row[0],
               nama: row[1],
               kecamatan: row[2],
               kabupaten: row[3],
               provinsi: row[4],
               kepsek: row[5],
               nipKepsek: row[6],
               bendahara: row[7],
               nipBendahara: row[8],
               operator: row[9],
               tipeAkses: row[10] || 'permanen',
               batasWaktu: row[11] || ''
             };
          }
          return {
            id: row[0],
            npsn: row[1],
            nama: row[2],
            kecamatan: row[3],
            kabupaten: row[4],
            provinsi: row[5],
            kepsek: row[6],
            nipKepsek: row[7],
            bendahara: row[8],
            nipBendahara: row[9],
            operator: row[10],
            tipeAkses: row[11] || 'permanen',
            batasWaktu: row[12] || ''
          };
        });

        // Cari sekolah yang tipe aksesnya 'demo' atau namanya ada unsur 'demo'
        selectedDemoSchool = formattedData.find((item: any) => 
          String(item.tipeAkses).toLowerCase() === 'demo' || 
          String(item.nama).toLowerCase().includes('demo') ||
          String(item.operator).toLowerCase().includes('demo')
        );
      }

      if (selectedDemoSchool) {
        const demoUser = {
          username: selectedDemoSchool.operator || 'Demo Operator',
          role: 'admin_sekolah',
          sekolah: selectedDemoSchool.nama,
          tipeAkses: 'demo',
          batasWaktu: selectedDemoSchool.batasWaktu || ''
        };
        login(demoUser);
        toast.dismiss(toastId);
        toast.success(`Berhasil Masuk: ${selectedDemoSchool.nama} (DEMO)`);
        navigate('/dashboard');
      } else {
        const fallbackDemo = {
          username: 'Demo Operator',
          role: 'admin_sekolah',
          sekolah: 'SD NEGERI DEMO',
          tipeAkses: 'demo',
          batasWaktu: ''
        };
        login(fallbackDemo);
        toast.dismiss(toastId);
        toast.success("Berhasil Masuk ke Akun Demo (Sistem Default)");
        navigate('/dashboard');
      }
    } catch (error) {
      console.error(error);
      const fallbackDemo = {
        username: 'Demo Operator',
        role: 'admin_sekolah',
        sekolah: 'SD NEGERI DEMO',
        tipeAkses: 'demo',
        batasWaktu: ''
      };
      login(fallbackDemo);
      toast.dismiss(toastId);
      toast.success("Berhasil Masuk ke Akun Demo (Offline Mode)");
      navigate('/dashboard');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          username,
          password
        }),
        redirect: 'follow'
      });

      const data = await response.json();

      if (data.success) {
        login(data.data);
        navigate('/dashboard');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat login. Pastikan URL API sudah benar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="backdrop-blur-xl bg-white/5 border border-white/10 p-10 rounded-3xl shadow-2xl w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h2 className="text-4xl font-extrabold text-white tracking-tighter">SIAP BOS</h2>
          <p className="text-indigo-200 mt-2 font-semibold text-sm">Sistem Administrasi Pengelolaan BOS</p>
          <p className="text-[11px] text-purple-200 italic mt-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl leading-relaxed">
            "Aplikasi Ini Di Tenagai Dengan Engine SIAP BOS Terbaru Dan AI Super Cepat"
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-indigo-300" size={20} />
            <input 
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/5 text-white placeholder-indigo-200/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-indigo-300" size={20} />
            <input 
              type="password"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/5 text-white placeholder-indigo-200/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition duration-300"
          >
            {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />} {loading ? 'Memproses...' : 'Login'}
          </button>

          <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading || loadingDemo}
              className="w-1/2 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loadingDemo && <Loader2 className="animate-spin" size={14} />}
              DEMO
            </button>
            <button
              type="button"
              onClick={() => toast.info('Membuka Formulir Pendaftaran... Silakan hubungi operator pusat!')}
              className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer text-center"
            >
              DAFTAR
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
