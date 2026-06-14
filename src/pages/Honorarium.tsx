import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  Award, Plus, Trash2, Edit2, Printer, Search, Calendar, User, Percent, HelpCircle, Save, X, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface HonorariumData {
  id: string;
  nomorHonor: string;
  tanggal: string;
  namaPenerima: string;
  nipPenerima: string;
  jabatanLembaga: string; // e.g. Guru GTT, Guru Ekstrakurikuler, Narasumber
  namaKegiatan: string; // e.g. Kegiatan Ekstrakurikuler Pramuka Triwulan I
  peranDalamKegiatan: string; // e.g. Pembina Pramuka, Pemateri Workshop
  volumeKerja: number; // e.g. 3 (bulan / jam)
  satuanKerja: string; // e.g. Bulan, Jam, Sesi
  tarifSatu: number; // e.g. 300000 per unit
  persenPph: number; // e.g. 5% (untuk Pajak Penghasilan Pasal 21)
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

export default function Honorarium() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [honors, setHonors] = useState<HonorariumData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingHonor, setEditingHonor] = useState<HonorariumData | null>(null);
  const [printItem, setPrintItem] = useState<HonorariumData | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Form states
  const [formNomorHonor, setFormNomorHonor] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formNamaPenerima, setFormNamaPenerima] = useState('');
  const [formNipPenerima, setFormNipPenerima] = useState('');
  const [formJabatanLembaga, setFormJabatanLembaga] = useState('');
  const [formNamaKegiatan, setFormNamaKegiatan] = useState('');
  const [formPeranDalamKegiatan, setFormPeranDalamKegiatan] = useState('');
  const [formVolumeKerja, setFormVolumeKerja] = useState(1);
  const [formSatuanKerja, setFormSatuanKerja] = useState('Bulan');
  const [formTarifSatu, setFormTarifSatu] = useState(0);
  const [formPersenPph, setFormPersenPph] = useState(0); // PPh 21 defaults to 0 (non-taxable or direct)
  const [formKepsek, setFormKepsek] = useState('');
  const [formNipKepsek, setFormNipKepsek] = useState('');
  const [formBendahara, setFormBendahara] = useState('');
  const [formNipBendahara, setFormNipBendahara] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  // Load honors on mount
  useEffect(() => {
    const storageKey = `siap_bos_honor_${user?.sekolah || 'default'}_${activeYear}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setHonors(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing saved Honors:", e);
      }
    } else {
      setHonors([]);
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

  // Save to storage
  const saveHonorsToStorage = (updatedList: HonorariumData[]) => {
    const storageKey = `siap_bos_honor_${user?.sekolah || 'default'}_${activeYear}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedList));
    setHonors(updatedList);
  };

  const handleOpenCreateModal = () => {
    setEditingHonor(null);
    setFormNomorHonor(`HON-${Math.floor(100 + Math.random() * 900)}/BOS/${activeYear}`);
    setFormTanggal(new Date().toISOString().substring(0, 10));
    setFormNamaPenerima('');
    setFormNipPenerima('');
    setFormJabatanLembaga('Guru GTT (Honorer)');
    setFormNamaKegiatan('Pembayaran Jasa Guru Pramubakti dan Ekstrakurikuler');
    setFormPeranDalamKegiatan('Pembina Pramuka Kls V');
    setFormVolumeKerja(3); // e.g. 3 bulan
    setFormSatuanKerja('Bulan');
    setFormTarifSatu(500000);
    setFormPersenPph(0); // default
    setFormCatatan('');

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

  const handleOpenEditModal = (h: HonorariumData) => {
    setEditingHonor(h);
    setFormNomorHonor(h.nomorHonor);
    setFormTanggal(h.tanggal);
    setFormNamaPenerima(h.namaPenerima);
    setFormNipPenerima(h.nipPenerima);
    setFormJabatanLembaga(h.jabatanLembaga);
    setFormNamaKegiatan(h.namaKegiatan);
    setFormPeranDalamKegiatan(h.peranDalamKegiatan);
    setFormVolumeKerja(h.volumeKerja);
    setFormSatuanKerja(h.satuanKerja);
    setFormTarifSatu(h.tarifSatu);
    setFormPersenPph(h.persenPph);
    setFormKepsek(h.kepsek);
    setFormNipKepsek(h.nipKepsek);
    setFormBendahara(h.bendahara);
    setFormNipBendahara(h.nipBendahara);
    setFormCatatan(h.catatan || '');
    setShowFormModal(true);
  };

  const handleDeleteHonor = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data honorarium ini?")) {
      const updated = honors.filter(item => item.id !== id);
      saveHonorsToStorage(updated);
      toast.success("Honorarium berhasil dihapus.");
    }
  };

  const handleSaveHonor = () => {
    if (!formNomorHonor.trim()) {
      toast.warning("Nomor Bukti Honor wajib diisi!");
      return;
    }
    if (!formNamaPenerima.trim()) {
      toast.warning("Nama guru/staf penerima honor wajib diisi!");
      return;
    }
    if (formTarifSatu <= 0) {
      toast.warning("Tarif honor harus lebih besar dari 0.");
      return;
    }

    const honorData: HonorariumData = {
      id: editingHonor ? editingHonor.id : Date.now().toString(),
      nomorHonor: formNomorHonor,
      tanggal: formTanggal,
      namaPenerima: formNamaPenerima,
      nipPenerima: formNipPenerima,
      jabatanLembaga: formJabatanLembaga,
      namaKegiatan: formNamaKegiatan,
      peranDalamKegiatan: formPeranDalamKegiatan,
      volumeKerja: formVolumeKerja,
      satuanKerja: formSatuanKerja,
      tarifSatu: formTarifSatu,
      persenPph: formPersenPph,
      kepsek: formKepsek,
      nipKepsek: formNipKepsek,
      bendahara: formBendahara,
      nipBendahara: formNipBendahara,
      catatan: formCatatan,
      activeYear: activeYear
    };

    let updatedList = [...honors];
    if (editingHonor) {
      updatedList = updatedList.map(item => item.id === editingHonor.id ? honorData : item);
      toast.success("Data Honorarium berhasil diperbarui!");
    } else {
      updatedList.unshift(honorData);
      toast.success("Honorarium baru disimpan!");
    }

    saveHonorsToStorage(updatedList);
    setShowFormModal(false);
  };

  const triggerPrint = (h: HonorariumData) => {
    setPrintItem(h);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const calculateGross = (vol: number, rate: number) => vol * rate;
  const calculatePph = (gross: number, ratePercent: number) => Math.round(gross * (ratePercent / 100));
  const calculateNet = (gross: number, pph: number) => gross - pph;

  const filteredHonors = honors.filter(h => 
    h.nomorHonor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.namaPenerima.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.namaKegiatan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gray-800 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Award size={24} />
            </span>
            Kwitansi Honorarium (Jasa Pendidik / Kegiatan)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Realisasi tanda terima pembayaran honorarium guru GTT/PTT, narasumber ahli, dan pembina kegiatan sekolah.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-xs"
          >
            <Plus size={18} />
            Buat Kwitansi Honorarium
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
              placeholder="Cari nomor honor, nama guru, kegiatan BOS..."
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
          {filteredHonors.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-gray-950">
                  <th className="py-3 px-4">No. Bukti Honor</th>
                  <th className="py-3 px-4">Tanggal Pembayaran</th>
                  <th className="py-3 px-4">Penerima Honor (Gelar)</th>
                  <th className="py-3 px-4">Uraian Tugas / Kegiatan</th>
                  <th className="py-3 px-4 text-center">Formulasi Honor</th>
                  <th className="py-3 px-4 text-right">Bersih Diterima</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredHonors.map((h) => {
                  const gross = calculateGross(h.volumeKerja, h.tarifSatu);
                  const pph = calculatePph(gross, h.persenPph);
                  const net = calculateNet(gross, pph);
                  return (
                    <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-gray-900 dark:text-white transition-colors">
                      <td className="py-3 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">{h.nomorHonor}</td>
                      <td className="py-3 px-4">{h.tanggal}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{h.namaPenerima}</div>
                        <div className="text-xs text-gray-500">ID NIP: {h.nipPenerima || '-'} / {h.jabatanLembaga}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        <div className="font-semibold text-xs truncate">{h.namaKegiatan}</div>
                        <div className="text-xs text-gray-400 truncate">Sebagai: {h.peranDalamKegiatan}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {h.volumeKerja} {h.satuanKerja} x Rp {h.tarifSatu.toLocaleString('id-ID')}
                        <div className="text-[10px] text-red-500">Pot. PPh: {h.persenPph}%</div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        Rp {net.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => triggerPrint(h)}
                            title="Cetak Tanda Terima Honor"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(h)}
                            title="Edit"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteHonor(h.id)}
                            title="Hapus"
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
              <Award size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="font-semibold">Belum adar realisasi honorarium</p>
              <p className="text-xs mt-1">Tekan tombol 'Buat Kwitansi Honorarium' di kanan atas untuk mengisinya.</p>
            </div>
          )}
        </div>
      </div>

      {/* Entry Modal Dialog */}
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
                  <Award className="text-indigo-600" />
                  {editingHonor ? 'Edit Pembayaran Honorarium' : 'Buat Bukti Tanda Terima Pembayaran Honor'}
                </h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left col: Core billing */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor Bukti Honor</label>
                    <input
                      type="text"
                      value={formNomorHonor}
                      onChange={(e) => setFormNomorHonor(e.target.value)}
                      placeholder="e.g. HON-04/BOS/2026"
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tanggal Transaksi Honor</label>
                    <input
                      type="date"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/30 space-y-2.5">
                    <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase">Informasi Guru / Penerima</h3>
                    <input
                      type="text"
                      placeholder="Nama & Gelar Lengkap Penerima"
                      value={formNamaPenerima}
                      onChange={(e) => setFormNamaPenerima(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="NIP / No NUPTK (Ketik '-' jika tidak ada)"
                      value={formNipPenerima}
                      onChange={(e) => setFormNipPenerima(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Jabatan di Sekolah (e.g. GTT Komputer / Terapis)"
                      value={formJabatanLembaga}
                      onChange={(e) => setFormJabatanLembaga(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Right col: Formulate work units */}
                <div className="space-y-4">
                  <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100/30 space-y-2.5">
                     <h3 className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase">Formulasi Kontrak Kerja Honor</h3>
                     <div>
                       <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Mata Kegiatan (Sesuai BKU)</label>
                       <input
                         type="text"
                         placeholder="e.g. Pembayaran Guru GTT Bulan Maret"
                         value={formNamaKegiatan}
                         onChange={(e) => setFormNamaKegiatan(e.target.value)}
                         className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                       />
                     </div>
                     <div>
                       <input
                         type="text"
                         placeholder="Uraian Peran / Tugas (Sebagai Pembina Ekskul, dsb)"
                         value={formPeranDalamKegiatan}
                         onChange={(e) => setFormPeranDalamKegiatan(e.target.value)}
                         className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="block text-[10px] text-gray-400 font-semibold mb-0.5">Banyak Alokasi (Vol)</label>
                         <input
                           type="number"
                           value={formVolumeKerja}
                           onChange={(e) => setFormVolumeKerja(Math.max(1, parseInt(e.target.value) || 1))}
                           className="w-full px-3 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-gray-400 font-semibold mb-0.5">Satuan Alokasi</label>
                         <input
                           type="text"
                           value={formSatuanKerja}
                           onChange={(e) => setFormSatuanKerja(e.target.value)}
                           placeholder="Bulan, Jam, Sesi, Org"
                           className="w-full px-3 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                         />
                       </div>
                     </div>
                     <div>
                       <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tarif Per Satuan (Rp)</label>
                       <input
                         type="number"
                         value={formTarifSatu}
                         onChange={(e) => setFormTarifSatu(Math.max(0, parseInt(e.target.value) || 0))}
                         className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Tarif Pajak PPh Pasal 21 (%)</label>
                       <select
                         value={formPersenPph}
                         onChange={(e) => setFormPersenPph(parseInt(e.target.value) || 0)}
                         className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                       >
                         <option value="0">0% (Tidak Dipungut / Golongan I/II / Non-pajak)</option>
                         <option value="5">5% (Golongan III / Swasta Ber-NPWP)</option>
                         <option value="6">6% (Swasta Non-NPWP / Standard 21)</option>
                         <option value="15">15% (Mewakili PNS Golongan IV)</option>
                       </select>
                     </div>
                  </div>
                </div>
              </div>

              {/* Formula calculations boxes */}
              <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white font-mono">Taksiran Neraca Keuangan (Honor) :</h3>
                {(() => {
                  const gross = calculateGross(formVolumeKerja, formTarifSatu);
                  const pph = calculatePph(gross, formPersenPph);
                  const net = calculateNet(gross, pph);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-150 dark:border-gray-850">
                      <div className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/85 rounded-xl">
                        <span className="text-xs text-gray-400 block mb-1 font-semibold uppercase">Honorarium Kotor (Gross)</span>
                        <strong className="text-gray-900 dark:text-white text-base">
                          Rp {gross.toLocaleString('id-ID')}
                        </strong>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/85 rounded-xl">
                        <span className="text-xs text-red-500 block mb-1 font-semibold uppercase">Potongan PPh 21 ({formPersenPph}%)</span>
                        <strong className="text-red-600 dark:text-red-400 text-base">
                          Rp {pph.toLocaleString('id-ID')}
                        </strong>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/30 rounded-xl">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1 font-black uppercase">Honor Bersih Diterima</span>
                        <strong className="text-emerald-700 dark:text-emerald-300 text-lg font-black">
                          Rp {net.toLocaleString('id-ID')}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100/30">
                  <div>
                    <label className="block text-[10px] text-teal-800 dark:text-teal-400 font-bold uppercase mb-0.5">Kepala Sekolah</label>
                    <input
                      type="text"
                      value={formKepsek}
                      onChange={(e) => setFormKepsek(e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-teal-800 dark:text-teal-400 font-bold uppercase mb-0.5">Bendahara BOS</label>
                    <input
                      type="text"
                      value={formBendahara}
                      onChange={(e) => setFormBendahara(e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Catatan Lainnya</label>
                  <input
                    type="text"
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="e.g. Pembayaran tunai untuk honor mengajar guru ekskul bulan berjalan."
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Save */}
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
                  onClick={handleSaveHonor}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-sm text-sm"
                >
                  <Save size={16} />
                  Simpan Honorarium
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT LAYOUT ACCORDING TO FINANCE LAWS */}
      {printItem && (() => {
        const gross = calculateGross(printItem.volumeKerja, printItem.tarifSatu);
        const pph = calculatePph(gross, printItem.persenPph);
        const net = calculateNet(gross, pph);
        return (
          <div id="siap-print-honor-canvas" className="hidden print:block bg-white text-black p-10 max-w-4xl mx-auto font-serif leading-relaxed text-[11px]">
            {/* Double border Kop Surat */}
            <div className="text-center space-y-0.5 mb-6 border-b-[3px] border-double border-black pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider">PEMERINTAH KABUPATEN {user?.kecamatan?.toUpperCase() || 'SIAP_BOS'}</h2>
              <h3 className="text-base font-black uppercase leading-tight">{user?.sekolah?.toUpperCase()}</h3>
              <p className="text-[9px] font-sans text-gray-650 italic">Alamat: Kecamatan {user?.kecamatan || 'Pendidikan'}, Kabupaten {user?.kecamatan || 'Pendidikan'} - Kode Pos 12345</p>
            </div>

            <div className="text-center space-y-0.5 mb-6">
              <h1 className="text-sm font-black underline uppercase">KAPSUL TANDA TERIMA PEMBAYARAN HONORARIUM</h1>
              <p className="font-mono text-[10px]">Serial No Bukti: {printItem.nomorHonor}</p>
            </div>

            <p className="mb-4">
              Telah diserahkan tunai pembayaran honorarium jasa pendidik / penanggung jawab operasional kegiatan yang didelegasikan dari anggaran Bantuan Operasional Sekolah (BOS) kepada personil di bawah ini:
            </p>

            {/* Grid details */}
            <div className="grid grid-cols-12 gap-1.5 pl-4 mb-4 border-l-2 border-black text-xs">
              <span className="col-span-3">Nama Penerima Honor</span>
              <span className="col-span-1 text-center">:</span>
              <strong className="col-span-8 font-black uppercase text-gray-950">{printItem.namaPenerima}</strong>

              <span className="col-span-3">NIP / Kode Identitas</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-8 font-mono">{printItem.nipPenerima || '-'}</span>

              <span className="col-span-3">Jabatan di Sekolah</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-8 font-semibold text-gray-800">{printItem.jabatanLembaga}</span>

              <span className="col-span-3">Uraian Tugas / Kegiatan</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-8 font-medium">{printItem.namaKegiatan} ({printItem.peranDalamKegiatan})</span>

              <span className="col-span-3">Formulasi Kontrak</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-8 font-mono font-bold text-gray-900">{printItem.volumeKerja} {printItem.satuanKerja} x Rp {printItem.tarifSatu.toLocaleString('id-ID')}</span>
            </div>

            <p className="font-semibold mb-2 text-gray-900 underline">FORMULASI REALISASI HONOR & POTONGAN PAJAK:</p>

            <table className="w-full border-collapse border border-black mb-4 font-mono text-[10px]">
              <tbody>
                <tr className="border-b border-black">
                  <td className="border border-black py-2 px-3 font-serif bg-gray-50 w-2/3">Jumlah Honor Kotor (Bruto):</td>
                  <td className="border border-black py-2 px-3 text-right">Rp {gross.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="border-b border-black text-red-600">
                  <td className="border border-black py-2 px-3 font-serif bg-gray-50">Dipotong Pajak Penghasilan (PPh Pasal 21) sebesar {printItem.persenPph}% :</td>
                  <td className="border border-black py-2 px-3 text-right font-bold">(Rp {pph.toLocaleString('id-ID')})</td>
                </tr>
                <tr className="border-b border-black bg-gray-100 text-gray-950 font-bold text-[11px]">
                  <td className="border border-black py-2 px-3 font-serif uppercase">Jumlah Honor Bersih yang Diterima (Net Cash):</td>
                  <td className="border border-black py-2 px-3 text-right underline text-[11.5px]">Rp {net.toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>

            {/* Terbilang block */}
            <div className="border border-black p-2.5 mb-6 bg-gray-50/50">
              <p className="font-bold underline text-[8.5px] mb-0.5">TERBILANG NETTO CASH :</p>
              <p className="italic font-extrabold uppercase text-gray-950">" {getTerbilangString(net)} "</p>
              {printItem.catatan && (
                <p className="mt-1 pb-1 border-t border-dashed border-gray-400 font-sans text-[8.5px] text-gray-600">Catatan Lain: {printItem.catatan}</p>
              )}
            </div>

            <p className="mb-8">
              Pernyataan: Atas pemotongan PPh Pasal 21 di atas, sekolah bertanggung jawab menyetorkannya langsung ke Kas Negara sesuai dengan kode billing pajak perpajakan Indonesia.
            </p>

            {/* Triple approvals signatures */}
            <div className="grid grid-cols-3 gap-2 text-center mt-6 text-xs leading-tight">
              {/* Kepsek */}
              <div className="space-y-12">
                <div>
                  <p className="font-bold">Setuju Dibayar,</p>
                  <p className="font-bold text-[10px]">Kepala Sekolah</p>
                </div>
                <div className="space-y-0.5">
                  <p className="font-black underline">{printItem.kepsek || '...........................................'}</p>
                  <p className="font-mono text-[9px]">NIP. {printItem.nipKepsek || '...........................................'}</p>
                </div>
              </div>

              {/* Bendahara */}
              <div className="space-y-12">
                <div>
                  <p className="font-bold">Lunas Dibayar,</p>
                  <p className="font-bold text-[10px]">Bendahara BOS</p>
                </div>
                <div className="space-y-0.5">
                  <p className="font-black underline">{printItem.bendahara || '...........................................'}</p>
                  <p className="font-mono text-[9px]">NIP. {printItem.nipBendahara || '...........................................'}</p>
                </div>
              </div>

              {/* Recipient */}
              <div className="space-y-12">
                <div>
                  <p className="font-mono text-[9.5px]">Tanggal, {printItem.tanggal}</p>
                  <p className="font-bold text-[10px]">Penerima Jasa / Penerima Honor</p>
                </div>
                <div className="space-y-0.5">
                  <p className="font-black underline uppercase">{printItem.namaPenerima || '...........................................'}</p>
                  <p className="text-[9px] text-gray-500 font-semibold">Tanda Tangan Penerima</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
