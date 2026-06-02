import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Upload, Edit, Trash2, Clock, RefreshCw, Check, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import LoadingOverlay from '../components/LoadingOverlay';
import PerpanjangAksesModal from '../components/PerpanjangAksesModal';

export default function DataSekolah() {
  const [sekolah, setSekolah] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isPerpanjangOpen, setIsPerpanjangOpen] = useState(false);
  const [itemToPerpanjang, setItemToPerpanjang] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dataActionStatus, setDataActionStatus] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'processing' | 'success';
  } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSekolah();
  }, []);

  const fetchSekolah = async (forceRefetch = false, showSkeleton = true) => {
    const cacheKey = `sekolah_data_${user?.role}_${user?.sekolah || 'all'}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData && !forceRefetch) {
      setSekolah(JSON.parse(cachedData));
      setLoading(false);
    } else if (showSkeleton) {
      setLoading(true);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getDataSekolah`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ role: user?.role, sekolah: user?.sekolah }),
        redirect: 'follow'
      });
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        let rows = data.data;
        if (rows[0] && (rows[0][0] === "ID" || rows[0][0] === "id" || typeof rows[0][0] === "string" && rows[0][0].toLowerCase() === "id" || rows[0][0] === "NPSN")) {
          rows = rows.slice(1);
        }
        
        const formattedData = rows.map((row: any) => {
          // If first column is NPSN instead of ID
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
        setSekolah(formattedData as any);
        sessionStorage.setItem(cacheKey, JSON.stringify(formattedData));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTarikData = async () => {
    console.log("Tombol Perbarui Data ditekan");
    setDataActionStatus({
      show: true,
      title: 'MENARIK DATA DARI SERVER',
      message: 'MOHON TUNGGU SEBENTAR',
      type: 'processing'
    });
    try {
      // Add a modern delay to ensure the beautiful loading modal is visible
      await new Promise(resolve => setTimeout(resolve, 1500));
      await fetchSekolah(true, false);
      console.log("Fetch selesai");
      setDataActionStatus({
        show: true,
        title: 'DATA BERHASIL DI PERBARUI',
        message: 'PROSES UPDATE DATA TELAH SELESAI',
        type: 'success'
      });
    } catch (e) {
      console.error("Error pada tarik data:", e);
      setDataActionStatus(null);
      toast.error("Gagal memperbarui data");
    }
  };

  const openDeleteConfirm = (item: any) => {
    setItemToDelete(item);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsConfirmOpen(false);
    setIsDeleting(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=hapusSekolah`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id: itemToDelete.id, namaSekolah: itemToDelete.nama }),
        redirect: 'follow'
      });
      const data = await response.json();
      
      if (data.success) {
        const updated = sekolah.filter((s:any) => s.id !== itemToDelete.id);
        setSekolah(updated);
        const cacheKey = `sekolah_data_${user?.role}_${user?.sekolah || 'all'}`;
        sessionStorage.setItem(cacheKey, JSON.stringify(updated));
        toast.success("Data sekolah berhasil dihapus.");
      } else {
        toast.error(data.message || 'Gagal menghapus sekolah');
      }
    } catch(err) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setItemToDelete(null);
      setIsDeleting(false);
    }
  };

  const filteredSekolah = sekolah.filter((s: any) => 
    s.nama?.toLowerCase().includes(search.toLowerCase()) || 
    s.npsn?.toString().toLowerCase().includes(search.toLowerCase())
  );

  if (user?.role === 'admin_sekolah') {
    const s: any = sekolah.length > 0 ? sekolah[0] : null; 
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Profil Sekolah</h2>
            <p className="text-gray-500 text-sm">Informasi detail identitas sekolah Anda.</p>
          </div>
          <button 
            onClick={handleTarikData}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-md flex gap-2 items-center"
          >
            <Upload size={18} /> Perbarui Data
          </button>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center text-gray-500 animate-pulse">
            Memuat identitas sekolah...
          </div>
        ) : s ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8"
          >
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl text-indigo-500">
                <Building2 size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{s.nama}</h3>
                <p className="text-gray-500 dark:text-gray-400">NPSN: {s.npsn}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-6">
                <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">Alamat Lengkap</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Provinsi</p>
                    <p className="font-medium text-gray-800 dark:text-white">{s.provinsi || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Kabupaten/Kota</p>
                    <p className="font-medium text-gray-800 dark:text-white">{s.kabupaten || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Kecamatan</p>
                    <p className="font-medium text-gray-800 dark:text-white">{s.kecamatan || '-'}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">Pejabat Sekolah</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Kepala Sekolah</p>
                    <p className="font-medium text-gray-800 dark:text-white">{s.kepsek || '-'}</p>
                    <p className="text-xs text-gray-400 mt-1">NIP: {s.nipKepsek || '-'}</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Bendahara BOS</p>
                    <p className="font-medium text-gray-800 dark:text-white">{s.bendahara || '-'}</p>
                    <p className="text-xs text-gray-400 mt-1">NIP: {s.nipBendahara || '-'}</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Operator Sekolah</p>
                    <p className="font-medium text-gray-800 dark:text-white">{s.operator || '-'}</p>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center text-gray-500">
            Data identitas sekolah belum lengkap atau tidak ditemukan.
          </div>
        )}

        {/* Data Action Modal (Processing/Success) */}
        <AnimatePresence>
          {dataActionStatus?.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
              >
                {dataActionStatus.type === 'processing' ? (
                  <div className="space-y-6 py-2">
                    {/* Concentric Modern Glow Elements */}
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      {/* Ring 1: Glowing Ambient Aura */}
                      <div className="absolute inset-0 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 animate-pulse blur-xl"></div>
                      
                      {/* Ring 2: Fast counter-clockwise dashed border */}
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-300 dark:border-indigo-700/60"
                      />
                      
                      {/* Ring 3: Slow clockwise partial solid border */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="absolute inset-2 rounded-full border-2 border-t-indigo-600 border-r-indigo-400 border-b-transparent border-l-transparent dark:border-t-indigo-400 dark:border-r-indigo-300"
                      />

                      {/* Ring 4: Inner core pulsing icon container */}
                      <div className="absolute inset-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 shadow-inner flex items-center justify-center">
                        <Database className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={24} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-black tracking-widest text-indigo-700 dark:text-indigo-400 uppercase font-sans animate-pulse">
                        {dataActionStatus.title}
                      </h3>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                        {dataActionStatus.message}
                      </p>
                      
                      {/* Tiny animated elegant loading strip */}
                      <div className="w-28 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto overflow-hidden relative">
                        <motion.div
                          initial={{ left: "-100%" }}
                          animate={{ left: "100%" }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                          className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-indigo-600 to-transparent dark:via-indigo-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner relative">
                      <div className="absolute inset-0 rounded-full bg-emerald-100/30 dark:bg-emerald-950/15 animate-ping"></div>
                      <Check size={30} className="relative z-10" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-black tracking-tight text-emerald-700 dark:text-emerald-400 uppercase font-sans">
                        {dataActionStatus.title}
                      </h3>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                        {dataActionStatus.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDataActionStatus(null)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer transition-all duration-300"
                    >
                      Tutup
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Data Sekolah</h2>
          <p className="text-gray-500 text-sm">Kelola dan pantau data sekolah penerima BOS.</p>
        </div>
        <button 
          onClick={() => navigate('/sekolah/tambah')}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-md"
        >
          + Tambah Sekolah
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white outline-none transition"
            placeholder="Cari NPSN atau Nama Sekolah..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
                  <th className="py-3 px-4">NPSN</th>
                  <th className="py-3 px-4">Nama Sekolah</th>
                  <th className="py-3 px-4">Kecamatan</th>
                  <th className="py-3 px-4">Kabupaten/Kota</th>
                  <th className="py-3 px-4">Kepala Sekolah</th>
                  {user?.role === 'master_admin' && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800 animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div></td>
                    <td className="py-4 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div></td>
                    {user?.role === 'master_admin' && <td className="py-4 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 ml-auto"></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
                  <th className="py-3 px-4">NPSN</th>
                  <th className="py-3 px-4">Nama Sekolah</th>
                  <th className="py-3 px-4">Kecamatan</th>
                  <th className="py-3 px-4">Kabupaten/Kota</th>
                  <th className="py-3 px-4">Kepala Sekolah</th>
                  {user?.role === 'master_admin' && <th className="py-3 px-4">Status Hak Akses</th>}
                  {user?.role === 'master_admin' && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredSekolah.length > 0 ? (
                  filteredSekolah.map((item: any, i: number) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={item.id} 
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-300 font-mono text-sm">{item.npsn}</td>
                      <td className="py-4 px-4 font-semibold text-gray-800 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg text-indigo-500"><Building2 size={16}/></div>
                        {item.nama}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">{item.kecamatan}</td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">{item.kabupaten}</td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">{item.kepsek}</td>
                      {user?.role === 'master_admin' && (
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              item.tipeAkses === 'permanen' ? 'bg-green-100 text-green-800 border-green-200' : 
                              item.tipeAkses === 'demo' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                              'bg-blue-100 text-blue-800 border-blue-200'
                            }`}>
                              {item.tipeAkses === 'rentang_waktu' ? 'Rentang Waktu' : String(item.tipeAkses || 'permanen').toUpperCase()}
                            </span>
                            {item.tipeAkses === 'rentang_waktu' && item.batasWaktu && (
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                Hingga: {new Date(item.batasWaktu).toLocaleDateString('id-ID')}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {user?.role === 'master_admin' && (
                        <td className="py-4 px-4 flex gap-2 justify-end">
                          <button onClick={() => { setItemToPerpanjang(item); setIsPerpanjangOpen(true); }} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition" title="Perpanjang Akses">
                            <Clock size={18}/>
                          </button>
                          <button onClick={() => navigate('/sekolah/edit', { state: { sekolah: item } })} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition" title="Edit Data">
                            <Edit size={18}/>
                          </button>
                          <button onClick={() => openDeleteConfirm(item)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition" title="Hapus Data">
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={user?.role === 'master_admin' ? 7 : 5} className="py-12 text-center text-gray-500">Tidak ada data ditemukan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Hapus Data Sekolah"
        message={`Apakah Anda yakin ingin menghapus data sekolah ${itemToDelete?.nama}? Seluruh folder dan akun terkait juga akan dihapus.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsConfirmOpen(false); setItemToDelete(null); }}
        confirmText="Ya, Hapus"
      />
      <PerpanjangAksesModal
        isOpen={isPerpanjangOpen}
        onClose={() => { setIsPerpanjangOpen(false); setItemToPerpanjang(null); }}
        sekolah={itemToPerpanjang}
        onSuccess={() => fetchSekolah(true)}
      />
      <LoadingOverlay isLoading={isDeleting} message="Menghapus data sekolah..." />

      {/* Data Action Modal (Processing/Success) */}
      <AnimatePresence>
        {dataActionStatus?.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              {dataActionStatus.type === 'processing' ? (
                <div className="space-y-6 py-2">
                  {/* Concentric Modern Glow Elements */}
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    {/* Ring 1: Glowing Ambient Aura */}
                    <div className="absolute inset-0 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 animate-pulse blur-xl"></div>
                    
                    {/* Ring 2: Fast counter-clockwise dashed border */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-300 dark:border-indigo-700/60"
                    />
                    
                    {/* Ring 3: Slow clockwise partial solid border */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="absolute inset-2 rounded-full border-2 border-t-indigo-600 border-r-indigo-400 border-b-transparent border-l-transparent dark:border-t-indigo-400 dark:border-r-indigo-300"
                    />

                    {/* Ring 4: Inner core pulsing icon container */}
                    <div className="absolute inset-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 shadow-inner flex items-center justify-center">
                      <Database className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={24} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-black tracking-widest text-indigo-700 dark:text-indigo-400 uppercase font-sans animate-pulse">
                      {dataActionStatus.title}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                      {dataActionStatus.message}
                    </p>
                    
                    {/* Tiny animated elegant loading strip */}
                    <div className="w-28 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto overflow-hidden relative">
                      <motion.div
                        initial={{ left: "-100%" }}
                        animate={{ left: "100%" }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                        className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-indigo-600 to-transparent dark:via-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-100/30 dark:bg-emerald-950/15 animate-ping"></div>
                    <Check size={30} className="relative z-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black tracking-tight text-emerald-700 dark:text-emerald-400 uppercase font-sans">
                      {dataActionStatus.title}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                      {dataActionStatus.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDataActionStatus(null)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer transition-all duration-300"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
