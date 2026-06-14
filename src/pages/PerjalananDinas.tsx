import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  Milestone, Plus, Trash2, Edit2, Printer, Search, Calendar, User, MapPin, Briefcase, Save, X, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface TravelCostItem {
  id: string;
  namaKebutuhan: string; // e.g. Uang Harian / Saku, Transport Darat, Uang Penginapan
  nilaiBiaya: number;
}

interface PerjalananDinasData {
  id: string;
  nomorSpd: string;
  tanggal: string;
  namaPelaksana: string;
  nipPelaksana: string;
  jabatanPelaksana: string;
  maksudPerjalanan: string;
  tujuan: string;
  tanggalBerangkat: string;
  tanggalKembali: string;
  items: TravelCostItem[];
  kepsek: string;
  nipKepsek: string;
  bendahara: string;
  nipBendahara: string;
  catatan?: string;
  activeYear: string;
}

function kekata(n: number): string {
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 12) return angka[n];
  if (n < 20) return kekata(n - 10) + " Belas";
  if (n < 100) return kekata(Math.floor(n / 10)) + " Puluh " + kekata(n % 10);
  if (n < 200) return "Seratus " + kekata(n - 100);
  if (n < 1000) return kekata(Math.floor(n / 100)) + " Ratus " + kekata(n % 100);
  if (n < 2000) return "Seribu " + kekata(n - 1000);
  if (n < 1000000) return kekata(Math.floor(n / 1000)) + " Ribu " + kekata(n % 1000);
  if (n < 1000000000) return kekata(Math.floor(n / 1000000)) + " Juta " + kekata(n % 1000000);
  if (n < 1000000000000) return kekata(Math.floor(n / 1000000000)) + " Milyar " + kekata(n % 1000000000);
  return "";
}

function getTerbilangString(num: number): string {
  if (!num || num <= 0) return 'Nol Rupiah';
  const rawSpelled = kekata(Math.floor(num)).trim();
  return (rawSpelled ? rawSpelled + ' Rupiah' : 'Nol Rupiah').replace(/\s+/g, ' ');
}

export default function PerjalananDinas() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [spds, setSpds] = useState<PerjalananDinasData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSpd, setEditingSpd] = useState<PerjalananDinasData | null>(null);
  const [printItem, setPrintItem] = useState<PerjalananDinasData | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Form states
  const [formNomorSpd, setFormNomorSpd] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formNamaPelaksana, setFormNamaPelaksana] = useState('');
  const [formNipPelaksana, setFormNipPelaksana] = useState('');
  const [formJabatanPelaksana, setFormJabatanPelaksana] = useState('');
  const [formMaksudPerjalanan, setFormMaksudPerjalanan] = useState('');
  const [formTujuan, setFormTujuan] = useState('');
  const [formTanggalBerangkat, setFormTanggalBerangkat] = useState('');
  const [formTanggalKembali, setFormTanggalKembali] = useState('');
  const [formItems, setFormItems] = useState<TravelCostItem[]>([]);
  const [formKepsek, setFormKepsek] = useState('');
  const [formNipKepsek, setFormNipKepsek] = useState('');
  const [formBendahara, setFormBendahara] = useState('');
  const [formNipBendahara, setFormNipBendahara] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  // Item states
  const [itemNama, setItemNama] = useState('');
  const [itemBiaya, setItemBiaya] = useState(0);

  // Load spds on mount
  useEffect(() => {
    const storageKey = `siap_bos_spd_${user?.sekolah || 'default'}_${activeYear}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setSpds(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing saved SPDs:", e);
      }
    } else {
      setSpds([]);
    }

    // Default personnel defaults
    const personnelCacheKey = `siap_bos_cache_${user?.sekolah || 'default'}_personnel`;
    const cachedPersonnel = sessionStorage.getItem(personnelCacheKey);
    if (cachedPersonnel) {
      try {
        const info = JSON.parse(cachedPersonnel);
        setFormKepsek(info.kepsek || '');
        setFormNipKepsek(info.nipKepsek || '');
        setFormBendahara(info.bendahara || '');
        setFormNipBendahara(info.nipBendahara || '');
      } catch (e) {}
    }
  }, [user?.sekolah, activeYear]);

  // Save SPD to storage
  const saveSpdsToStorage = (updatedSpds: PerjalananDinasData[]) => {
    const storageKey = `siap_bos_spd_${user?.sekolah || 'default'}_${activeYear}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedSpds));
    setSpds(updatedSpds);
  };

  const handleOpenCreateModal = () => {
    setEditingSpd(null);
    setFormNomorSpd(`052/SPD-BOS/SDN-01/${activeYear}`);
    setFormTanggal(new Date().toISOString().substring(0, 10));
    setFormNamaPelaksana('');
    setFormNipPelaksana('');
    setFormJabatanPelaksana('Guru Kelas');
    setFormMaksudPerjalanan('Mengikuti Kegiatan Workshop BOS / KKG Kecamatan');
    setFormTujuan('Gedung KPRI / Kantor Kecamatan');
    setFormTanggalBerangkat(new Date().toISOString().substring(0, 10));
    setFormTanggalKembali(new Date().toISOString().substring(0, 10));
    setFormCatatan('');
    setFormItems([
      { id: '1', namaKebutuhan: 'Uang Harian / Saku Dinas', nilaiBiaya: 150000 },
      { id: '2', namaKebutuhan: 'Transportasi PP Darat', nilaiBiaya: 50000 }
    ]);

    const personnelCacheKey = `siap_bos_cache_${user?.sekolah || 'default'}_personnel`;
    const cachedPersonnel = sessionStorage.getItem(personnelCacheKey);
    if (cachedPersonnel) {
      try {
        const info = JSON.parse(cachedPersonnel);
        setFormKepsek(info.kepsek || '');
        setFormNipKepsek(info.nipKepsek || '');
        setFormBendahara(info.bendahara || '');
        setFormNipBendahara(info.nipBendahara || '');
      } catch (e) {}
    }
    setShowFormModal(true);
  };

  const handleOpenEditModal = (spd: PerjalananDinasData) => {
    setEditingSpd(spd);
    setFormNomorSpd(spd.nomorSpd);
    setFormTanggal(spd.tanggal);
    setFormNamaPelaksana(spd.namaPelaksana);
    setFormNipPelaksana(spd.nipPelaksana);
    setFormJabatanPelaksana(spd.jabatanPelaksana);
    setFormMaksudPerjalanan(spd.maksudPerjalanan);
    setFormTujuan(spd.tujuan);
    setFormTanggalBerangkat(spd.tanggalBerangkat);
    setFormTanggalKembali(spd.tanggalKembali);
    setFormItems(spd.items);
    setFormKepsek(spd.kepsek);
    setFormNipKepsek(spd.nipKepsek);
    setFormBendahara(spd.bendahara);
    setFormNipBendahara(spd.nipBendahara);
    setFormCatatan(spd.catatan || '');
    setShowFormModal(true);
  };

  const handleDeleteSpd = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus pertanggungjawaban dinas ini?")) {
      const updated = spds.filter(s => s.id !== id);
      saveSpdsToStorage(updated);
      toast.success("Pertanggungjawaban Perjalanan Dinas berhasil dihapus.");
    }
  };

  const handleAddItem = () => {
    if (!itemNama.trim()) {
      toast.warning("Nama rincian biaya wajib diisi!");
      return;
    }
    if (itemBiaya <= 0) {
      toast.warning("Biaya harus lebih besar dari 0.");
      return;
    }

    const newItem: TravelCostItem = {
      id: Date.now().toString(),
      namaKebutuhan: itemNama,
      nilaiBiaya: itemBiaya
    };

    setFormItems([...formItems, newItem]);
    setItemNama('');
    setItemBiaya(0);
    toast.success("Rincian biaya dinas berhasil ditambahkan.");
  };

  const handleRemoveItem = (id: string) => {
    setFormItems(formItems.filter(item => item.id !== id));
  };

  const handleSaveSpd = () => {
    if (!formNomorSpd.trim()) {
      toast.warning("Nomor SPD wajib diisi!");
      return;
    }
    if (!formNamaPelaksana.trim()) {
      toast.warning("Nama pendidik/pelaksana dinas wajib diisi!");
      return;
    }
    if (formItems.length === 0) {
      toast.warning("Rincian pengeluaran dinas minimal 1 baris!");
      return;
    }

    const spdData: PerjalananDinasData = {
      id: editingSpd ? editingSpd.id : Date.now().toString(),
      nomorSpd: formNomorSpd,
      tanggal: formTanggal,
      namaPelaksana: formNamaPelaksana,
      nipPelaksana: formNipPelaksana,
      jabatanPelaksana: formJabatanPelaksana,
      maksudPerjalanan: formMaksudPerjalanan,
      tujuan: formTujuan,
      tanggalBerangkat: formTanggalBerangkat,
      tanggalKembali: formTanggalKembali,
      items: formItems,
      kepsek: formKepsek,
      nipKepsek: formNipKepsek,
      bendahara: formBendahara,
      nipBendahara: formNipBendahara,
      catatan: formCatatan,
      activeYear: activeYear
    };

    let updatedList = [...spds];
    if (editingSpd) {
      updatedList = updatedList.map(item => item.id === editingSpd.id ? spdData : item);
      toast.success("SPD berhasil diperbarui!");
    } else {
      updatedList.unshift(spdData);
      toast.success("SPD baru berhasil disimpan!");
    }

    saveSpdsToStorage(updatedList);
    setShowFormModal(false);
  };

  const triggerPrint = (spd: PerjalananDinasData) => {
    setPrintItem(spd);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const filteredSpds = spds.filter(s => 
    s.nomorSpd.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.namaPelaksana.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.maksudPerjalanan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateTotal = (items: TravelCostItem[]) => {
    return items.reduce((sum, item) => sum + item.nilaiBiaya, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gray-800 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Milestone size={24} />
            </span>
            Kwitansi Transportasi / Perjalanan Dinas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Menerbitkan dan mengelola pembayaran akomodasi perjalanan tugas dinas guru dan staf sekolah.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-xs"
          >
            <Plus size={18} />
            Buat Kwitansi Perjalanan Dinas
          </button>
        </div>
      </div>

      {/* Lists */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xs print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor bukti, nama pelaksana, atau maksud perjalanan..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 transition text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Tahun Aktif:</span>
            <select
              value={activeYear}
              onChange={(e) => {
                setActiveYear(e.target.value);
                localStorage.setItem('siap_bos_active_year', e.target.value);
              }}
              className="py-1.5 px-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredSpds.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-gray-950">
                  <th className="py-3 px-4">No. Bukti SPD</th>
                  <th className="py-3 px-4">Tanggal Bukti</th>
                  <th className="py-3 px-4">Penerima Dinas (Guru / Staf)</th>
                  <th className="py-3 px-4">Maksud Perjalanan & Tujuan</th>
                  <th className="py-3 px-4 text-right">Nilai Pertanggungjawaban</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredSpds.map((spd) => {
                  const totalVal = calculateTotal(spd.items);
                  return (
                    <tr key={spd.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-gray-900 dark:text-white transition-colors">
                      <td className="py-3 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">{spd.nomorSpd}</td>
                      <td className="py-3 px-4">{spd.tanggal}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{spd.namaPelaksana}</div>
                        <div className="text-xs text-gray-500">NIP: {spd.nipPelaksana || '-'} / {spd.jabatanPelaksana}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        <div className="font-medium truncate">{spd.maksudPerjalanan}</div>
                        <div className="text-xs text-gray-500 truncate">Ke: {spd.tujuan}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        Rp {totalVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => triggerPrint(spd)}
                            title="Cetak Bukti SPD"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(spd)}
                            title="Edit SPD"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteSpd(spd.id)}
                            title="Hapus SPD"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Milestone size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="font-semibold">Belum ada pertanggungjawaban dinas</p>
              <p className="text-xs mt-1">Tekan 'Buat Kwitansi Perjalanan Dinas' untuk mencatat transport guru.</p>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs print:hidden overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-5">
                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <Milestone className="text-indigo-600" />
                  {editingSpd ? 'Edit Perjalanan Dinas' : 'Buat Kwitansi Transport Perjalanan Dinas'}
                </h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor Bukti Perlak (SPD)</label>
                    <input
                      type="text"
                      value={formNomorSpd}
                      onChange={(e) => setFormNomorSpd(e.target.value)}
                      placeholder="e.g. 052/SPD-BOS/2026"
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tanggal Keluar Bukti</label>
                    <input
                      type="date"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/30 space-y-2.5">
                    <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase">Penerima Dinas (Guru / Staf)</h3>
                    <div>
                      <input
                        type="text"
                        placeholder="Nama Lengkap & Gelar Pelaksana"
                        value={formNamaPelaksana}
                        onChange={(e) => setFormNamaPelaksana(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="NIP Pelaksana (Isi '-' jika non-PNS)"
                        value={formNipPelaksana}
                        onChange={(e) => setFormNipPelaksana(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Jabatan (e.g. Guru Kelas IV)"
                        value={formJabatanPelaksana}
                        onChange={(e) => setFormJabatanPelaksana(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl border border-amber-100/30 space-y-2.5">
                    <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">Detail Perjalanan Dinas</h3>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Keperluan / Maksud Tugas</label>
                      <input
                        type="text"
                        value={formMaksudPerjalanan}
                        onChange={(e) => setFormMaksudPerjalanan(e.target.value)}
                        placeholder="e.g. Mengikuti Rakor Kurikulum BOS di Kabupaten"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tempat Tujuan Tugas</label>
                      <input
                        type="text"
                        value={formTujuan}
                        onChange={(e) => setFormTujuan(e.target.value)}
                        placeholder="e.g. Ruang Aula Dinas Pendidikan"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Pemberangkatan</label>
                        <input
                          type="date"
                          value={formTanggalBerangkat}
                          onChange={(e) => setFormTanggalBerangkat(e.target.value)}
                          className="w-full px-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Pemulangan</label>
                        <input
                          type="date"
                          value={formTanggalKembali}
                          onChange={(e) => setFormTanggalKembali(e.target.value)}
                          className="w-full px-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100/30 grid grid-cols-2 gap-2">
                    <div className="col-span-2 text-xs font-black text-teal-700 dark:text-teal-400 uppercase">Penandatangan Pejabat</div>
                    <div>
                      <label className="block text-[9px] text-gray-400 font-semibold uppercase">Kepala Sekolah</label>
                      <input
                        type="text"
                        value={formKepsek}
                        onChange={(e) => setFormKepsek(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400 font-semibold uppercase">Bendahara BOS</label>
                      <input
                        type="text"
                        value={formBendahara}
                        onChange={(e) => setFormBendahara(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Travel cost items */}
              <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Rincian Pertanggungbiayaan Biaya Perjalanan</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Komponen Pengeluaran Biaya Dinas</label>
                    <input
                      type="text"
                      value={itemNama}
                      onChange={(e) => setItemNama(e.target.value)}
                      placeholder="e.g. Uang Harian Peserta Workshop (1 Hari x Rp 150.000)"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Jumlah Biaya Pengeluaran (Rp)</label>
                    <input
                      type="number"
                      value={itemBiaya}
                      onChange={(e) => setItemBiaya(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="bg-indigo-600 hover:bg-indigo-705 text-white text-xs font-bold py-1.5 px-4 rounded-lg transition"
                    >
                      + Tambah Baris Pengeluaran
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 bg-gray-50 dark:bg-gray-950 font-bold">
                        <th className="py-2.5 px-3">Komponen Kebutuhan Biaya</th>
                        <th className="py-2.5 px-3 text-right">Biaya Pengeluaran (Rp)</th>
                        <th className="py-2.5 px-3 text-center">Batal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-955 dark:text-white">
                      {formItems.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-semibold">{it.namaKebutuhan}</td>
                          <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">
                            Rp {it.nilaiBiaya.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded-md transition"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formItems.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-gray-400 italic">
                            Belum ada baris pembiayaan harian / dinas yang didaftarkan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-right text-sm">
                    <span className="text-gray-400 font-semibold font-mono">Total Akuntansi Biaya SPD : </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-black text-lg">
                      Rp {calculateTotal(formItems).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-8 pt-5 border-t border-gray-150 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 bg-gray-150 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSpd}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-sm text-sm"
                >
                  <Save size={16} />
                  Simpan SPD
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT SPD ACCORDING TO PUBLIC OFFICIAL ACCOUNTING STANDARDS */}
      {printItem && (
        <div id="siap-print-spd-canvas" className="hidden print:block bg-white text-black p-10 max-w-4xl mx-auto font-serif leading-relaxed text-[11px]">
          {/* Double border Kop Surat */}
          <div className="text-center space-y-0.5 mb-6 border-b-[3px] border-double border-black pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider">PEMERINTAH KABUPATEN {user?.kecamatan?.toUpperCase() || 'SIAP_BOS'}</h2>
            <h3 className="text-base font-black uppercase leading-tight">{user?.sekolah?.toUpperCase()}</h3>
            <p className="text-[9px] font-sans text-gray-650 italic">Alamat: Kecamatan {user?.kecamatan || 'Pendidikan'}, Kabupaten {user?.kecamatan || 'Pendidikan'} - Kode Pos 12345</p>
          </div>

          <div className="text-center space-y-0.5 mb-6">
            <h1 className="text-sm font-black underline uppercase">PERTANGGUNGJAWABAN BIAYA PERJALANAN DINAS (SPD)</h1>
            <p className="font-mono text-[10px]">Nomor: {printItem.nomorSpd}</p>
          </div>

          <p className="mb-4">
            Telah dibayarkan tunai pertanggungjawaban ongkos transportasi beserta uang saku harian perjalanan dinas guru/staf sekolah sebagai pelaksana tugas, bersumber dari dana Alokasi BOS, kepada personil di bawah ini:
          </p>

          <div className="grid grid-cols-12 gap-1.5 pl-4 mb-5 border-l-2 border-black">
            <span className="col-span-3">Nama Lengkap Urusan</span>
            <span className="col-span-1 text-center">:</span>
            <strong className="col-span-8 font-black uppercase">{printItem.namaPelaksana}</strong>

            <span className="col-span-3">Golongan NIP</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-mono">{printItem.nipPelaksana || '-'}</span>

            <span className="col-span-3">Jabatan di Sekolah</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-semibold">{printItem.jabatanPelaksana}</span>

            <span className="col-span-3">Maksud Perjalanan</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8">{printItem.maksudPerjalanan}</span>

            <span className="col-span-3">Tujuan Lokasi</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8 font-bold">{printItem.tujuan}</span>

            <span className="col-span-3">Rentang Tanggal</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-8">{printItem.tanggalBerangkat} s.d. {printItem.tanggalKembali}</span>
          </div>

          <p className="font-semibold mb-2 leading-none text-gray-900 underline">RINCIAN REALISASI BIAYA PERJALANAN:</p>
          
          <table className="w-full border-collapse border border-black text-[10.5px] mb-5">
            <thead>
              <tr className="bg-gray-150 font-bold border-b border-black text-center text-[9.5px]">
                <th className="border border-black py-1.5 px-2 w-8">No</th>
                <th className="border border-black py-1.5 px-2 text-left">Komponen Kebutuhan Pengeluaran</th>
                <th className="border border-black py-1.5 px-2 text-right w-36">Jumlah Ongkos (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {printItem.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-black">
                  <td className="border border-black py-2 text-center">{idx + 1}</td>
                  <td className="border border-black py-2 px-2 font-semibold text-gray-800">{item.namaKebutuhan}</td>
                  <td className="border border-black py-2 px-2 text-right font-bold">Rp {item.nilaiBiaya.toLocaleString('id-ID')}</td>
                </tr>
              ))}
              <tr className="bg-gray-100">
                <td colSpan={2} className="border border-black py-2 px-2 font-black uppercase text-right">JUMLAH SELURUH BIAYA DINAS YANG DISERAHKAN:</td>
                <td className="border border-black py-2 px-2 font-black text-right text-[11.5px] text-gray-950 underline">Rp {calculateTotal(printItem.items).toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          {/* Terbilang block */}
          <div className="border border-black p-2.5 mb-6 bg-gray-50/50 text-[10.5px]">
            <p className="font-bold underline text-[8.5px] leading-tight mb-0.5">TERBILANG :</p>
            <p className="italic font-extrabold uppercase text-gray-900">" {getTerbilangString(calculateTotal(printItem.items))} "</p>
            {printItem.catatan && (
              <p className="mt-1 pb-1 border-t border-dashed border-gray-400 font-sans text-[8.5px] text-gray-600">Catatan/Nota: {printItem.catatan}</p>
            )}
          </div>

          <p className="mb-8">
            Seluruh biaya telah diserahterimakan penuh dari Bendahara BOS sekolah kepada pihak yang bersangkutan dengan bukti sah sesuai peraturan akuntansi yang berlaku nasional.
          </p>

          {/* Tri signatures for travel */}
          <div className="grid grid-cols-3 gap-2 text-center mt-6 text-xs leading-tight">
            {/* Kepsek */}
            <div className="space-y-12">
              <div>
                <p className="font-bold">Setuju Dibayarkan,</p>
                <p className="font-bold text-[10px]">Kepala Sekolah</p>
              </div>
              <div className="space-y-0.5 animate-pulse">
                <p className="font-black underline">{printItem.kepsek || '...........................................'}</p>
                <p className="font-mono text-[9px]">NIP. {printItem.nipKepsek || '...........................................'}</p>
              </div>
            </div>

            {/* Bendahara */}
            <div className="space-y-12">
              <div>
                <p className="font-bold">Lunas Dibayarkan,</p>
                <p className="font-bold text-[10px]">Bendahara BOS</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-black underline">{printItem.bendahara || '...........................................'}</p>
                <p className="font-mono text-[9px]">NIP. {printItem.nipBendahara || '...........................................'}</p>
              </div>
            </div>

            {/* Traveler */}
            <div className="space-y-12">
              <div>
                <p className="font-mono text-[9.5px]">Tanggal, {printItem.tanggal}</p>
                <p className="font-bold text-[10px]">Penerima Dana Perjalanan</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-black underline uppercase">{printItem.namaPelaksana || '...........................................'}</p>
                <p className="font-serif text-[9px]">NIP. {printItem.nipPelaksana || '...........................................'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
