import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import LoadingOverlay from '../components/LoadingOverlay';

export default function EditSekolah() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    npsn: '',
    nama: '',
    namaSekolahLama: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    kepsek: '',
    nipKepsek: '',
    bendahara: '',
    nipBendahara: '',
    operator: '',
  });

  useEffect(() => {
    if (location.state && location.state.sekolah) {
      const s = location.state.sekolah;
      setFormData({
        id: s.id || '',
        npsn: s.npsn || '',
        nama: s.nama || '',
        namaSekolahLama: s.nama || '',
        kecamatan: s.kecamatan || '',
        kabupaten: s.kabupaten || '',
        provinsi: s.provinsi || '',
        kepsek: s.kepsek || '',
        nipKepsek: s.nipKepsek || '',
        bendahara: s.bendahara || '',
        nipBendahara: s.nipBendahara || '',
        operator: s.operator || '',
      });
    } else {
      navigate('/sekolah'); // kalau tidak ada state lempar balik
    }
  }, [location, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=editSekolah`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(formData),
        redirect: 'follow'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Data Sekolah berhasil diubah!');
        const cacheKey = `sekolah_data_${user?.role}_${user?.sekolah || 'all'}`;
        sessionStorage.removeItem(cacheKey); // clear cache to refetch
        navigate('/sekolah');
      } else {
        toast.error(data.message || 'Terjadi kesalahan saat mengubah data sekolah');
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan koneksi saat menyimpan data.');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'master_admin') {
    return (
      <div className="p-8 text-center text-red-500">
        Akses Ditolak. Hanya Master Admin yang dapat mengakses halaman ini.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/sekolah')}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Edit Data Sekolah</h2>
          <p className="text-gray-500 text-sm">Ubah data informasi profil sekolah penerima BOS.</p>
        </div>
      </div>

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        <div className="p-6 space-y-8">
          {/* Bagian Informasi Sekolah */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Informasi Sekolah</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">NPSN</label>
                <input required type="number" name="npsn" value={formData.npsn} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Masukkan NPSN" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nama Sekolah</label>
                <input required type="text" name="nama" value={formData.nama} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Contoh: SMAN 1 Jakarta" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Provinsi</label>
                <input required type="text" name="provinsi" value={formData.provinsi} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Provinsi" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Kabupaten/Kota</label>
                <input required type="text" name="kabupaten" value={formData.kabupaten} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Kabupaten / Kota" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Kecamatan</label>
                <input required type="text" name="kecamatan" value={formData.kecamatan} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Kecamatan" />
              </div>
            </div>
          </section>

          {/* Bagian Pejabat Sekolah */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Informasi Pejabat Penanggung Jawab</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nama Kepala Sekolah</label>
                <input required type="text" name="kepsek" value={formData.kepsek} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Nama Lengkap & Gelar" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">NIP Kepala Sekolah</label>
                <input type="text" name="nipKepsek" value={formData.nipKepsek} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Masukkan NIP (jika ada)" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nama Bendahara BOS</label>
                <input required type="text" name="bendahara" value={formData.bendahara} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Nama Lengkap & Gelar" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">NIP Bendahara BOS</label>
                <input type="text" name="nipBendahara" value={formData.nipBendahara} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Masukkan NIP (jika ada)" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nama Operator Sekolah</label>
                <input required type="text" name="operator" value={formData.operator} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition" placeholder="Nama Operator" />
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/sekolah')}
            className="px-6 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Batal
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 font-semibold shadow-lg transition"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </motion.form>
      <LoadingOverlay isLoading={loading} message="Penyimpanan data sekolah..." />
    </div>
  );
}
