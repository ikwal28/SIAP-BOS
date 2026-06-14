import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardCheck, Plus, Trash2, Edit2, Printer, Search, Calendar, User, ShieldCheck, MapPin, Save, X, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface BaItem {
  id: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
}

interface BeritaAcaraData {
  id: string;
  nomorBast: string; // Nomor Berita Acara Serah Terima
  nomorBapb: string; // Nomor Berita Acara Pemeriksaan Barang
  tanggal: string;
  namaPenyedia: string;
  pimpinanPenyedia: string;
  alamatPenyedia: string;
  items: BaItem[];
  kepsek: string;
  nipKepsek: string;
  bendahara: string;
  nipBendahara: string;
  pemeriksaBarang: string; // e.g. Guru / Petugas Pemeriksa
  nipPemeriksa?: string;
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

export default function BeritaAcara() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [bas, setBas] = useState<BeritaAcaraData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBa, setEditingBa] = useState<BeritaAcaraData | null>(null);
  const [printItem, setPrintItem] = useState<BeritaAcaraData | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Form states
  const [formNomorBast, setFormNomorBast] = useState('');
  const [formNomorBapb, setFormNomorBapb] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formNamaPenyedia, setFormNamaPenyedia] = useState('');
  const [formPimpinanPenyedia, setFormPimpinanPenyedia] = useState('');
  const [formAlamatPenyedia, setFormAlamatPenyedia] = useState('');
  const [formKepsek, setFormKepsek] = useState('');
  const [formNipKepsek, setFormNipKepsek] = useState('');
  const [formBendahara, setFormBendahara] = useState('');
  const [formNipBendahara, setFormNipBendahara] = useState('');
  const [formPemeriksaBarang, setFormPemeriksaBarang] = useState('');
  const [formNipPemeriksa, setFormNipPemeriksa] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formItems, setFormItems] = useState<BaItem[]>([]);

  // Item states
  const [itemNama, setItemNama] = useState('');
  const [itemJumlah, setItemJumlah] = useState(1);
  const [itemSatuan, setItemSatuan] = useState('Unit');
  const [itemHarga, setItemHarga] = useState(0);

  // Load bas on year/school changes
  useEffect(() => {
    const storageKey = `siap_bos_ba_${user?.sekolah || 'default'}_${activeYear}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setBas(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing Berita Acara:", e);
      }
    } else {
      setBas([]);
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
        setFormPemeriksaBarang(info.bendahara || ''); // fallback
        setFormNipPemeriksa(info.nipBendahara || '');
      } catch (e) {}
    }
  }, [user?.sekolah, activeYear]);

  // Save back to local storage
  const saveBasToStorage = (updatedBas: BeritaAcaraData[]) => {
    const storageKey = `siap_bos_ba_${user?.sekolah || 'default'}_${activeYear}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedBas));
    setBas(updatedBas);
  };

  const handleOpenCreateModal = () => {
    setEditingBa(null);
    setFormNomorBast(`020/BAST-BOS/SDN-01/${activeYear}`);
    setFormNomorBapb(`021/BAPB-BOS/SDN-01/${activeYear}`);
    setFormTanggal(new Date().toISOString().substring(0, 10));
    setFormNamaPenyedia('CV. Sinar Abadi Abadi');
    setFormPimpinanPenyedia('Bambang Irawan');
    setFormAlamatPenyedia('Jl. Pahlawan Karya No. 99');
    setFormCatatan('');
    setFormItems([]);

    const personnelCacheKey = `siap_bos_cache_${user?.sekolah || 'default'}_personnel`;
    const cachedPersonnel = sessionStorage.getItem(personnelCacheKey);
    if (cachedPersonnel) {
      try {
        const info = JSON.parse(cachedPersonnel);
        setFormKepsek(info.kepsek || '');
        setFormNipKepsek(info.nipKepsek || '');
        setFormBendahara(info.bendahara || '');
        setFormNipBendahara(info.nipBendahara || '');
        setFormPemeriksaBarang(info.bendahara || '');
        setFormNipPemeriksa(info.nipBendahara || '');
      } catch (e) {}
    }
    setShowFormModal(true);
  };

  const handleOpenEditModal = (ba: BeritaAcaraData) => {
    setEditingBa(ba);
    setFormNomorBast(ba.nomorBast);
    setFormNomorBapb(ba.nomorBapb);
    setFormTanggal(ba.tanggal);
    setFormNamaPenyedia(ba.namaPenyedia);
    setFormPimpinanPenyedia(ba.pimpinanPenyedia);
    setFormAlamatPenyedia(ba.alamatPenyedia);
    setFormKepsek(ba.kepsek);
    setFormNipKepsek(ba.nipKepsek);
    setFormBendahara(ba.bendahara);
    setFormNipBendahara(ba.nipBendahara);
    setFormPemeriksaBarang(ba.pemeriksaBarang);
    setFormNipPemeriksa(ba.nipPemeriksa || '');
    setFormCatatan(ba.catatan || '');
    setFormItems(ba.items);
    setShowFormModal(true);
  };

  const handleDeleteBa = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus Berita Acara ini?")) {
      const updated = bas.filter(b => b.id !== id);
      saveBasToStorage(updated);
      toast.success("Berita Acara berhasil dihapus.");
    }
  };

  const handleAddItem = () => {
    if (!itemNama.trim()) {
      toast.warning("Nama barang belanja wajib diisi!");
      return;
    }
    if (itemHarga <= 0) {
      toast.warning("Harga satuan harus lebih besar dari 0.");
      return;
    }

    const newItem: BaItem = {
      id: Date.now().toString(),
      namaBarang: itemNama,
      jumlah: itemJumlah,
      satuan: itemSatuan,
      hargaSatuan: itemHarga
    };

    setFormItems([...formItems, newItem]);
    setItemNama('');
    setItemJumlah(1);
    setItemSatuan('Unit');
    setItemHarga(0);
    toast.success("Barang pemeriksaan ditambahkan.");
  };

  const handleRemoveItem = (id: string) => {
    setFormItems(formItems.filter(item => item.id !== id));
  };

  const handleSaveBa = () => {
    if (!formNomorBast.trim() || !formNomorBapb.trim()) {
      toast.warning("Nomor BAST & Nomor BAPB wajib diisi!");
      return;
    }
    if (formItems.length === 0) {
      toast.warning("Masukkan minimal 1 barang belanjaan!");
      return;
    }

    const baData: BeritaAcaraData = {
      id: editingBa ? editingBa.id : Date.now().toString(),
      nomorBast: formNomorBast,
      nomorBapb: formNomorBapb,
      tanggal: formTanggal,
      namaPenyedia: formNamaPenyedia,
      pimpinanPenyedia: formPimpinanPenyedia,
      alamatPenyedia: formAlamatPenyedia,
      items: formItems,
      kepsek: formKepsek,
      nipKepsek: formNipKepsek,
      bendahara: formBendahara,
      nipBendahara: formNipBendahara,
      pemeriksaBarang: formPemeriksaBarang,
      nipPemeriksa: formNipPemeriksa,
      catatan: formCatatan,
      activeYear: activeYear
    };

    let updatedList = [...bas];
    if (editingBa) {
      updatedList = updatedList.map(item => item.id === editingBa.id ? baData : item);
      toast.success("Berita Acara berhasil diperbarui!");
    } else {
      updatedList.unshift(baData);
      toast.success("Berita Acara baru berhasil disimpan!");
    }

    saveBasToStorage(updatedList);
    setShowFormModal(false);
  };

  const triggerPrint = (ba: BeritaAcaraData) => {
    setPrintItem(ba);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const filteredBas = bas.filter(b => 
    b.nomorBast.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.nomorBapb.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.namaPenyedia.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateTotal = (items: BaItem[]) => {
    return items.reduce((sum, item) => sum + (item.jumlah * item.hargaSatuan), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gray-800 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <ClipboardCheck size={24} />
            </span>
            Berita Acara (Serah Terima & Pemeriksaan)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Mengaudit penerimaan perlengkapan fisik di sekolah sesuai standar pemeriksaan belanja BOS.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-xs"
          >
            <Plus size={18} />
            Buat Berita Acara BA
          </button>
        </div>
      </div>

      {/* Lists Interface */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xs print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor BAST, BAPB, atau rekanan penyedia..."
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
          {filteredBas.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-gray-950">
                  <th className="py-3 px-4">No. BAST</th>
                  <th className="py-3 px-4">No. Pemeriksaan (BAPB)</th>
                  <th className="py-3 px-4">Tanggal BA</th>
                  <th className="py-3 px-4">Toko / Rekanan</th>
                  <th className="py-3 px-4 text-right">Nilai Barang</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredBas.map((ba) => {
                  const totalVal = calculateTotal(ba.items);
                  return (
                    <tr key={ba.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-gray-900 dark:text-white transition-colors">
                      <td className="py-3 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">{ba.nomorBast}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{ba.nomorBapb}</td>
                      <td className="py-3 px-4">{ba.tanggal}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{ba.namaPenyedia}</div>
                        <div className="text-xs text-gray-500">Pimpinan: {ba.pimpinanPenyedia}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        Rp {totalVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => triggerPrint(ba)}
                            title="Cetak Berita Acara BA"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(ba)}
                            title="Edit BA"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteBa(ba.id)}
                            title="Hapus BA"
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
              <ClipboardCheck size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="font-semibold">Belum ada Berita Acara (BAST-BAPB)</p>
              <p className="text-xs mt-1">Gunakan tombol 'Buat Berita Acara BA' untuk mencetak bukti serah terima dan pemeriksaan barang belanja sekolah.</p>
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
                  <ClipboardCheck className="text-indigo-600" />
                  {editingBa ? 'Edit Berita Acara' : 'Daftarkan Berita Acara Baru'}
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
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor BA Serah Terima (BAST)</label>
                    <input
                      type="text"
                      value={formNomorBast}
                      onChange={(e) => setFormNomorBast(e.target.value)}
                      placeholder="e.g. 020/BAST-BOS/SDN-01/2026"
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor BA Pemeriksaan Barang (BAPB)</label>
                    <input
                      type="text"
                      value={formNomorBapb}
                      onChange={(e) => setFormNomorBapb(e.target.value)}
                      placeholder="e.g. 021/BAPB-BOS/SDN-01/2026"
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tanggal Berita Acara dibuat</label>
                    <input
                      type="date"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/30">
                    <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase mb-2">Pihak Kedua (Penyedia Rekanan)</h3>
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        placeholder="Nama Toko/Penyedia (e.g. CV. Makmur Mandiri)"
                        value={formNamaPenyedia}
                        onChange={(e) => setFormNamaPenyedia(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Nama Pimpinan Penyedia"
                        value={formPimpinanPenyedia}
                        onChange={(e) => setFormPimpinanPenyedia(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Alamat Lengkap Kantor"
                        value={formAlamatPenyedia}
                        onChange={(e) => setFormAlamatPenyedia(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100/30 space-y-2.5">
                    <h3 className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase mb-1">Pihak Pertama (Sekolah & Pemeriksa)</h3>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Kepala Sekolah (Kepak)</label>
                      <input
                        type="text"
                        value={formKepsek}
                        onChange={(e) => setFormKepsek(e.target.value)}
                        placeholder="Nama Kepala Sekolah"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">NIP Kepala Sekolah</label>
                      <input
                        type="text"
                        value={formNipKepsek}
                        onChange={(e) => setFormNipKepsek(e.target.value)}
                        placeholder="NIP Kepsek"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-850 pt-2" />
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Bendahara Sekolah</label>
                      <input
                        type="text"
                        value={formBendahara}
                        onChange={(e) => setFormBendahara(e.target.value)}
                        placeholder="Nama Bendahara"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-850 pt-2" />
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Petugas Pemeriksa Barang (Nama Guru/Staff)</label>
                      <input
                        type="text"
                        value={formPemeriksaBarang}
                        onChange={(e) => setFormPemeriksaBarang(e.target.value)}
                        placeholder="e.g. Rahmat, S.Pd (Ketua Panitia Pemeriksa)"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">NIP Petugas Pemeriksa (Opsional)</label>
                      <input
                        type="text"
                        value={formNipPemeriksa}
                        onChange={(e) => setFormNipPemeriksa(e.target.value)}
                        placeholder="NIP Pemeriksa"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Items auditing section */}
              <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Daftar Barang Serah Terima & Pemeriksaan</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5 font-mono">Nama Perlengkapan / Barang Belanja</label>
                    <input
                      type="text"
                      value={itemNama}
                      onChange={(e) => setItemNama(e.target.value)}
                      placeholder="e.g. Printer Epson L3210 Multifungsi"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Jumlah</label>
                    <input
                      type="number"
                      value={itemJumlah}
                      onChange={(e) => setItemJumlah(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Satuan</label>
                    <input
                      type="text"
                      value={itemSatuan}
                      onChange={(e) => setItemSatuan(e.target.value)}
                      placeholder="e.g. Unit, Buah, Rim"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Harga Kontrak Satuan (Rp)</label>
                    <input
                      type="number"
                      value={itemHarga}
                      onChange={(e) => setItemHarga(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition"
                    >
                      + Tambah ke Pemeriksaan
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 bg-gray-50 dark:bg-gray-950 font-bold">
                        <th className="py-2.5 px-3">Nama Belanja Fisik</th>
                        <th className="py-2.5 px-3 text-center">Jumlah Barang</th>
                        <th className="py-2.5 px-3 text-center">Satuan</th>
                        <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                        <th className="py-2.5 px-3 text-right">Taksiran Nilai Kontrak</th>
                        <th className="py-2.5 px-3 text-center">Batal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-950 dark:text-white">
                      {formItems.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-semibold">{it.namaBarang}</td>
                          <td className="py-2 px-3 text-center font-black">{it.jumlah}</td>
                          <td className="py-2 px-3 text-center text-gray-500">{it.satuan}</td>
                          <td className="py-2 px-3 text-right">Rp {it.hargaSatuan.toLocaleString('id-ID')}</td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            Rp {(it.jumlah * it.hargaSatuan).toLocaleString('id-ID')}
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
                          <td colSpan={6} className="text-center py-6 text-gray-400 italic">
                            Belum ada baris barang yang diinput untuk pemeriksaan fisik.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-right text-sm">
                    <span className="text-gray-400 font-semibold">Total Nilai Berita Acara: </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">
                      Rp {calculateTotal(formItems).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Catatan Tambahan Hasil Pemeriksaan Fisik</label>
                  <input
                    type="text"
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="e.g. Semua barang telah diperiksa dalam keadaan BAIK, BARU, LENGKAP dengan garansi resmi masing-masing 1 tahun."
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Save actions */}
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
                  onClick={handleSaveBa}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-sm text-sm"
                >
                  <Save size={16} />
                  Simpan Berita Acara
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT LAYOUT CONTAINER */}
      {printItem && (
        <div id="siap-print-ba-canvas" className="hidden print:block bg-white text-black p-10 max-w-4xl mx-auto font-serif leading-relaxed text-[11px]">
          {/* Double border Kop Surat */}
          <div className="text-center space-y-0.5 mb-6 border-b-[3px] border-double border-black pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider">PEMERINTAH KABUPATEN {user?.kecamatan?.toUpperCase() || 'SIAP_BOS'}</h2>
            <h3 className="text-base font-black uppercase leading-tight">{user?.sekolah?.toUpperCase()}</h3>
            <p className="text-[9px] font-sans text-gray-650 italic">Alamat: Kecamatan {user?.kecamatan || 'Pendidikan'}, Kabupaten {user?.kecamatan || 'Pendidikan'} - Kode Pos 12345</p>
          </div>

          {/* Document titles */}
          <div className="text-center space-y-0.5 mb-6">
            <h1 className="text-sm font-black underline uppercase">BERITA ACARA SERAH TERIMA & PEMERIKSAAN BARANG</h1>
            <div className="text-[10px] space-y-0.5 font-mono">
              <p>NO BAST: {printItem.nomorBast}</p>
              <p>NO BAPB: {printItem.nomorBapb}</p>
            </div>
          </div>

          <p className="mb-4">
            Pada hari ini, tanggal <strong className="font-semibold">{printItem.tanggal}</strong> bertempat di <strong className="font-semibold">{user?.sekolah}</strong>, telah dilaksanakan pemeriksaan serta serah terima fisik rupa-rupa barang kebutuhan pendidikan yang dibiayai menggunakan alokasi dana Bantuan Operasional Sekolah (BOS) antara pihak-pihak berkontrak:
          </p>

          <div className="space-y-3 mb-4 pl-3">
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-1 text-center font-bold">I.</span>
              <span className="col-span-2 font-bold">Pihak I (Pertama)</span>
              <span className="col-span-9">: <strong className="font-extrabold">{printItem.kepsek}</strong> (selaku Kepala Sekolah mewakili lembaga <strong className="font-semibold">{user?.sekolah}</strong>)</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-1 text-center font-bold">II.</span>
              <span className="col-span-2 font-bold">Pihak II (Kedua)</span>
              <span className="col-span-9">: <strong className="font-extrabold">{printItem.pimpinanPenyedia}</strong> (selaku Pimpinan berkuasa pada toko rekanan <strong className="font-semibold">{printItem.namaPenyedia}</strong> yang beralamat di {printItem.alamatPenyedia})</span>
            </div>
          </div>

          <p className="mb-3">
            Pihak II menyatakan telah menyerahkan seluruh barang pesanan kepada Pihak I dalam kondisi 100% lengkap dan siap digunakan. Panitia Pemeriksa Barang Sekolah juga menyatakan telah menguji kesesuaian spek, jumlah fisik, serta rincian kualitas dengan hasil audit fisik sebagai berikut:
          </p>

          {/* Inspection Items Table */}
          <table className="w-full border-collapse border border-black mb-4">
            <thead>
              <tr className="bg-gray-100/90 font-bold border-b border-black text-center text-[10px]">
                <th className="border border-black py-2 px-1 w-8">No</th>
                <th className="border border-black py-2 px-2 text-left">Deskripsi / Spek Barang</th>
                <th className="border border-black py-2 px-1.5 w-14">Volume Belanja</th>
                <th className="border border-black py-2 px-1.5 w-12">Satuan</th>
                <th className="border border-black py-2 px-2 text-right">Harga Satuan (Rp)</th>
                <th className="border border-black py-2 px-2 text-right w-24">Jumlah Pagu (Rp)</th>
                <th className="border border-black py-2 px-2 text-center w-20">Kondisi Audit</th>
              </tr>
            </thead>
            <tbody>
              {printItem.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-black">
                  <td className="border border-black py-1.5 text-center">{idx + 1}</td>
                  <td className="border border-black py-1.5 px-2 font-bold">{item.namaBarang}</td>
                  <td className="border border-black py-1.5 text-center font-extrabold">{item.jumlah}</td>
                  <td className="border border-black py-1.5 text-center">{item.satuan}</td>
                  <td className="border border-black py-1.5 px-2 text-right">{item.hargaSatuan.toLocaleString('id-ID')}</td>
                  <td className="border border-black py-1.5 px-2 text-right font-black">{(item.jumlah * item.hargaSatuan).toLocaleString('id-ID')}</td>
                  <td className="border border-black py-1.5 text-center font-sans text-[9px] font-bold text-gray-900">BAIK / LENGKAP</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={5} className="border border-black py-2 px-2 font-black uppercase text-right">TOTAL NILAI BARANG SERAH TERIMA:</td>
                <td className="border border-black py-2 px-2 font-black text-right text-[11.5px] underline">Rp {calculateTotal(printItem.items).toLocaleString('id-ID')}</td>
                <td className="border border-black text-center text-[9px] font-bold bg-green-50">SESUAI SPEK</td>
              </tr>
            </tbody>
          </table>

          {/* Terbilang block */}
          <div className="border border-black p-2.5 mb-4 bg-gray-50/20 font-serif leading-tight">
            <p className="font-bold underline text-[9px] mb-0.5">TERBILANG NILAI BERITA ACARA :</p>
            <p className="italic font-extrabold uppercase text-gray-900">" {getTerbilangString(calculateTotal(printItem.items))} "</p>
            {printItem.catatan && (
              <p className="mt-1.5 border-t border-dashed border-gray-400 pt-1 text-[9.5px] italic text-gray-700"><strong>Pernyataan Pemeriksa:</strong> {printItem.catatan}</p>
            )}
          </div>

          <p className="mb-6">
            Demikian Berita Acara Serah Terima & Pemeriksaan Barang ini ditandatangani bersama-sama oleh kedua belah pihak sebagai tanda sahnya pemenuhan hak dan kewajiban masing-masing, serta mutlak untuk dicatatkan ke dalam daftar inventaris aset sekolah.
          </p>

          {/* Tri-Signature Paneling */}
          <div className="grid grid-cols-3 gap-2 text-center mt-8 text-xs leading-tight">
            {/* Pihak II */}
            <div className="space-y-14">
              <div>
                <p className="font-bold">Pihak II (Kedua)</p>
                <p className="text-[10px]">Yang Menyerahkan,</p>
                <p className="font-semibold uppercase">{printItem.namaPenyedia}</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-black underline uppercase">{printItem.pimpinanPenyedia}</p>
                <p className="text-[9px] text-gray-500 uppercase">Pimpinan Rekanan</p>
              </div>
            </div>

            {/* Ketua Pemeriksa */}
            <div className="space-y-14">
              <div>
                <p className="font-bold">Mengesahkan,</p>
                <p className="text-[10px]">Petugas Pemeriksa Barang</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-black underline">{printItem.pemeriksaBarang}</p>
                <p className="font-mono text-[9px]">NIP. {printItem.nipPemeriksa || '...........................................'}</p>
              </div>
            </div>

            {/* Pihak I */}
            <div className="space-y-14">
              <div>
                <p className="font-bold">Pihak I (Pertama)</p>
                <p className="text-[10px]">Penerima / Kuasa Pengguna Anggaran</p>
                <p className="font-semibold">{user?.sekolah}</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-black underline">{printItem.kepsek}</p>
                <p className="font-mono text-[9px]">NIP. {printItem.nipKepsek || '...........................................'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
