import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Receipt, Plus, Trash2, Edit2, Printer, Search, Calendar, User, MapPin, Store, HelpCircle, Save, X, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface NotaItem {
  id: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
}

interface NotaData {
  id: string;
  nomorNota: string;
  tanggal: string;
  namaToko: string;
  alamatToko: string;
  items: NotaItem[];
  penerima: string; // Person who received the goods at school
  yangMenyerahkan: string; // shop owner / staff representing the vendor
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

export default function Nota() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [notas, setNotas] = useState<NotaData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNota, setEditingNota] = useState<NotaData | null>(null);
  const [printItem, setPrintItem] = useState<NotaData | null>(null);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const printId = searchParams.get('id');
  const autoPrint = searchParams.get('autoPrint') === 'true';

  useEffect(() => {
    if (printId && notas.length > 0) {
      const match = notas.find(n => n.id === printId);
      if (match) {
        setPrintItem(match);
        if (autoPrint) {
          setTimeout(() => {
            window.print();
          }, 800);
        }
      }
    }
  }, [printId, autoPrint, notas]);
  const [showFormModal, setShowFormModal] = useState(false);

  // Form states
  const [formNomorNota, setFormNomorNota] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formNamaToko, setFormNamaToko] = useState('');
  const [formAlamatToko, setFormAlamatToko] = useState('');
  const [formPenerima, setFormPenerima] = useState('');
  const [formYangMenyerahkan, setFormYangMenyerahkan] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formItems, setFormItems] = useState<NotaItem[]>([]);

  // Item form inputs
  const [itemNama, setItemNama] = useState('');
  const [itemJumlah, setItemJumlah] = useState(1);
  const [itemSatuan, setItemSatuan] = useState('Pcs');
  const [itemHarga, setItemHarga] = useState(0);

  // Load notas on activeYear/school change
  useEffect(() => {
    const storageKey = `siap_bos_nota_${user?.sekolah || 'default'}_${activeYear}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setNotas(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing saved notas:", e);
      }
    } else {
      setNotas([]);
    }

    // Default penerima to school bendahara or person in charge if cached
    const personnelCacheKey = `siap_bos_cache_${user?.sekolah || 'default'}_personnel`;
    const cachedPersonnel = sessionStorage.getItem(personnelCacheKey);
    if (cachedPersonnel) {
      try {
        const info = JSON.parse(cachedPersonnel);
        setFormPenerima(info.bendahara || '');
      } catch (e) {}
    }
  }, [user?.sekolah, activeYear]);

  // Save back to local storage
  const saveNotasToStorage = (updatedNotas: NotaData[]) => {
    const storageKey = `siap_bos_nota_${user?.sekolah || 'default'}_${activeYear}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedNotas));
    setNotas(updatedNotas);
  };

  const handleOpenCreateModal = () => {
    setEditingNota(null);
    setFormNomorNota(`NT-${Math.floor(100 + Math.random() * 900)}/${activeYear}`);
    setFormTanggal(new Date().toISOString().substring(0, 10));
    setFormNamaToko('TOKO ATK JAYA SELALU');
    setFormAlamatToko('Jl. Merdeka No. 42A');
    setFormYangMenyerahkan('Karyawan Toko');
    setFormCatatan('');
    setFormItems([]);

    const personnelCacheKey = `siap_bos_cache_${user?.sekolah || 'default'}_personnel`;
    const cachedPersonnel = sessionStorage.getItem(personnelCacheKey);
    if (cachedPersonnel) {
      try {
        const info = JSON.parse(cachedPersonnel);
        setFormPenerima(info.bendahara || '');
      } catch (e) {}
    }
    setShowFormModal(true);
  };

  const handleOpenEditModal = (nota: NotaData) => {
    setEditingNota(nota);
    setFormNomorNota(nota.nomorNota);
    setFormTanggal(nota.tanggal);
    setFormNamaToko(nota.namaToko);
    setFormAlamatToko(nota.alamatToko);
    setFormPenerima(nota.penerima);
    setFormYangMenyerahkan(nota.yangMenyerahkan);
    setFormCatatan(nota.catatan || '');
    setFormItems(nota.items);
    setShowFormModal(true);
  };

  const handleDeleteNota = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus nota belanja ini?")) {
      const updated = notas.filter(n => n.id !== id);
      saveNotasToStorage(updated);
      toast.success("Nota belanja berhasil dihapus.");
    }
  };

  const handleAddItem = () => {
    if (!itemNama.trim()) {
      toast.warning("Nama barang/ jasa belanja wajib diisi!");
      return;
    }
    if (itemHarga <= 0) {
      toast.warning("Harga satuan harus lebih besar dari 0.");
      return;
    }

    const newItem: NotaItem = {
      id: Date.now().toString(),
      namaBarang: itemNama,
      jumlah: itemJumlah,
      satuan: itemSatuan,
      hargaSatuan: itemHarga
    };

    setFormItems([...formItems, newItem]);
    setItemNama('');
    setItemJumlah(1);
    setItemSatuan('Pcs');
    setItemHarga(0);
    toast.success("Barang belanjaan ditambahkan.");
  };

  const handleRemoveItem = (id: string) => {
    setFormItems(formItems.filter(item => item.id !== id));
  };

  const handleSaveNota = () => {
    if (!formNomorNota.trim()) {
      toast.warning("Nomor Nota wajib diisi!");
      return;
    }
    if (formItems.length === 0) {
      toast.warning("Sistem membutuhkan minimal 1 item belanja!");
      return;
    }

    const notaData: NotaData = {
      id: editingNota ? editingNota.id : Date.now().toString(),
      nomorNota: formNomorNota,
      tanggal: formTanggal,
      namaToko: formNamaToko,
      alamatToko: formAlamatToko,
      items: formItems,
      penerima: formPenerima,
      yangMenyerahkan: formYangMenyerahkan,
      catatan: formCatatan,
      activeYear: activeYear
    };

    let updatedList = [...notas];
    if (editingNota) {
      updatedList = updatedList.map(item => item.id === editingNota.id ? notaData : item);
      toast.success("Nota belanja berhasil diperbarui!");
    } else {
      updatedList.unshift(notaData);
      toast.success("Nota belanja baru disimpan!");
    }

    saveNotasToStorage(updatedList);
    setShowFormModal(false);
  };

  const triggerPrint = (nota: NotaData) => {
    setPrintItem(nota);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const filteredNotas = notas.filter(n => 
    n.nomorNota.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.namaToko.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.items.some(item => item.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const calculateTotal = (items: NotaItem[]) => {
    return items.reduce((sum, item) => sum + (item.jumlah * item.hargaSatuan), 0);
  };

  return (
    <div className="space-y-6">
      {autoPrint && (
        <div className="print:hidden bg-indigo-50/90 dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto mb-6 backdrop-blur-md shadow-md animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight font-sans">Pratinjau Cetak Nota Belanja PDF</h3>
              <p className="text-xs text-gray-450 font-medium font-sans">Sistem secara otomatis memicu dialog cetak. Gunakan tombol berikut untuk melakukan cetak ulang atau kembali.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer size={13} />
              Cetak Ulang
            </button>
            <button
              onClick={() => navigate('/cetak')}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750 border border-gray-250 dark:border-gray-700 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              ← Kembali ke Menu Cetak
            </button>
          </div>
        </div>
      )}
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gray-800 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Receipt size={24} />
            </span>
            Nota Belanja (Kwitansi Toko)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Mengelola dan mencetak bukti Nota Penjualan untuk melengkapi kelengkapan berkas fisik Sekolah.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-xs"
          >
            <Plus size={18} />
            Buat Nota Baru
          </button>
        </div>
      </div>

      {/* Main Lists UI */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xs print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor nota, toko, atau item belanja..."
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
          {filteredNotas.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-gray-950">
                  <th className="py-3 px-4">No. Nota</th>
                  <th className="py-3 px-4">Tanggal Belanja</th>
                  <th className="py-3 px-4">Toko / Tempat Belanja</th>
                  <th className="py-3 px-4">Daftar Barang</th>
                  <th className="py-3 px-4 text-right">Total Belanja</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredNotas.map((nota) => {
                  const totalVal = calculateTotal(nota.items);
                  return (
                    <tr key={nota.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-gray-900 dark:text-white transition-colors">
                      <td className="py-3 px-4 font-bold font-mono">{nota.nomorNota}</td>
                      <td className="py-3 px-4">{nota.tanggal}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{nota.namaToko}</div>
                        <div className="text-xs text-gray-500">{nota.alamatToko}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        {nota.items.map(i => `${i.namaBarang} (${i.jumlah} ${i.satuan})`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        Rp {totalVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => triggerPrint(nota)}
                            title="Cetak Nota"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(nota)}
                            title="Edit"
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteNota(nota.id)}
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
              <Receipt size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="font-semibold">Belum ada Nota Belanja</p>
              <p className="text-xs mt-1">Tekan tombol 'Buat Nota Baru' untuk menginput kwitansi pengeluaran rupa-rupa belanja.</p>
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
                  <Receipt className="text-indigo-600" />
                  {editingNota ? 'Edit Nota Belanja' : 'Input Nota Belanja Toko'}
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
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor Nota / No. Kwitansi Toko</label>
                    <input
                      type="text"
                      value={formNomorNota}
                      onChange={(e) => setFormNomorNota(e.target.value)}
                      placeholder="e.g. NT-934/I/2026"
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tanggal Transaksi Belanja</label>
                    <input
                      type="date"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/30">
                    <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase mb-2">Penyedia Toko (Stempel Toko)</h3>
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        placeholder="Nama Toko Rekanan"
                        value={formNamaToko}
                        onChange={(e) => setFormNamaToko(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Alamat Toko Lengkap"
                        value={formAlamatToko}
                        onChange={(e) => setFormAlamatToko(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100/30 space-y-2.5">
                    <h3 className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase mb-1">Penandatangan Serah Terima Nota</h3>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Penerima Barang di Sekolah (Bendahara / Staf)</label>
                      <input
                        type="text"
                        value={formPenerima}
                        onChange={(e) => setFormPenerima(e.target.value)}
                        placeholder="e.g. Nama Bendahara"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Yang Menyerahkan Barang (Kasir / Pemilik Toko)</label>
                      <input
                        type="text"
                        value={formYangMenyerahkan}
                        onChange={(e) => setFormYangMenyerahkan(e.target.value)}
                        placeholder="e.g. Kasir Toko"
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Addition Box */}
              <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Daftar Barang Belanja</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Nama Barang / Belanja Jasa</label>
                    <input
                      type="text"
                      value={itemNama}
                      onChange={(e) => setItemNama(e.target.value)}
                      placeholder="e.g. Map Snelhecker Plastik Biru"
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
                      placeholder="e.g. Pak, Buah, Rim"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Harga Satuan (Rp)</label>
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
                      + Tambah Belanjaan
                    </button>
                  </div>
                </div>

                {/* Added items list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 bg-gray-50 dark:bg-gray-950 font-bold">
                        <th className="py-2.5 px-3">Nama Belanja</th>
                        <th className="py-2.5 px-3 text-center">Banyaknya</th>
                        <th className="py-2.5 px-3 text-center">Satuan</th>
                        <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                        <th className="py-2.5 px-3 text-right">Jumlah</th>
                        <th className="py-2.5 px-3 text-center">Batal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-950 dark:text-white">
                      {formItems.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2px px-3 font-semibold">{it.namaBarang}</td>
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
                            Belum ada baris nota belanja yang dimasukkan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-right text-sm">
                    <span className="text-gray-400 font-semibold">Total Pengeluaran: </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">
                      Rp {calculateTotal(formItems).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Catatan Struk (Keterangan Toko)</label>
                  <input
                    type="text"
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="e.g. Lunas - Barang yang sudah dibeli tidak dapat ditukar/dikembalikan."
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden text-gray-900 dark:text-white"
                  />
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
                  onClick={handleSaveNota}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-sm text-sm"
                >
                  <Save size={16} />
                  Simpan Nota
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT CANVAS (Visible only on browser printer trigger) */}
      {printItem && (
        <div id="siap-print-nota-canvas" className="hidden print:block bg-white text-black p-8 max-w-2xl mx-auto font-sans leading-relaxed text-xs">
          {/* Traditional Nota Penjualan Header Layout */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-black mb-4">
            <div>
              <h2 className="text-base font-black tracking-tight uppercase">{printItem.namaToko}</h2>
              <p className="text-[10px] leading-tight text-gray-700 italic">{printItem.alamatToko}</p>
              <p className="text-[10px] leading-tight text-gray-750">Telp: 0812-34XX-XXXX</p>
            </div>
            <div className="text-right space-y-1">
              <h1 className="text-lg font-black tracking-wide underline leading-none">NOTA BELANJA</h1>
              <p className="font-mono text-[10px] font-bold">No Nota : {printItem.nomorNota}</p>
              <p className="text-[10px]">Tgl Nota: <strong className="font-semibold">{printItem.tanggal}</strong></p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[11px] leading-relaxed">Telah diserahterimakan rupa-rupa belanja dari toko kami untuk kebutuhan operasional sekolah:</p>
            <strong className="text-[11px] font-black uppercase text-gray-900">{user?.sekolah || 'Nama Sekolah'}</strong>
          </div>

          {/* Table of Purchases */}
          <table className="w-full border-collapse border border-black text-[10.5px] mb-4">
            <thead>
              <tr className="bg-gray-100 font-bold border-b border-black text-center">
                <th className="border border-black py-2 px-1 w-8">No</th>
                <th className="border border-black py-2 px-2 text-left">Nama Barang / Belanja</th>
                <th className="border border-black py-2 px-1.5 w-14">Banyaknya</th>
                <th className="border border-black py-2 px-1.5 w-12">Satuan</th>
                <th className="border border-black py-2 px-2 text-right">Harga Satuan (Rp)</th>
                <th className="border border-black py-2 px-2 text-right w-28">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {printItem.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-black">
                  <td className="border border-black py-2 text-center">{idx + 1}</td>
                  <td className="border border-black py-2 px-2 font-bold">{item.namaBarang}</td>
                  <td className="border border-black py-2 text-center font-extrabold">{item.jumlah}</td>
                  <td className="border border-black py-2 text-center">{item.satuan}</td>
                  <td className="border border-black py-2 px-2 text-right">{item.hargaSatuan.toLocaleString('id-ID')}</td>
                  <td className="border border-black py-2 px-2 text-right font-black">{(item.jumlah * item.hargaSatuan).toLocaleString('id-ID')}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={5} className="border border-black py-2 px-2 font-black uppercase text-right">JUMLAH TOTAL BAYAR:</td>
                <td className="border border-black py-2 px-2 font-black text-right text-base underline">Rp {calculateTotal(printItem.items).toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          {/* Terbilang block style */}
          <div className="border border-black p-2.5 mb-6 bg-gray-50/50">
            <span className="font-bold underline text-[9px] block">TERBILANG :</span>
            <span className="font-extrabold text-[10.5px] uppercase italic text-gray-900 font-serif">" {getTerbilangString(calculateTotal(printItem.items))} "</span>
            {printItem.catatan && (
              <p className="mt-1.5 border-t border-dashed border-gray-400 pt-1 text-[9px] text-gray-500 italic">Note: {printItem.catatan}</p>
            )}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 text-center mt-6 text-xs">
            {/* Seller */}
            <div className="space-y-12">
              <div>
                <p>Tanda Terima Kasih,</p>
                <p className="font-bold">Hormat Kami / Toko</p>
              </div>
              <div>
                <p className="font-bold underline uppercase">{printItem.yangMenyerahkan || '...........................................'}</p>
                <p className="text-[10px] text-gray-500">Stempel & Tanda Tangan Toko</p>
              </div>
            </div>

            {/* Buyer */}
            <div className="space-y-12">
              <div>
                <p className="font-mono text-[10px]">Kecamatan, {user?.kecamatan || 'Pendidikan'}</p>
                <p className="font-bold">Barang Diterima Oleh Sekolah</p>
              </div>
              <div>
                <p className="font-bold underline">{printItem.penerima || '...........................................'}</p>
                <p className="text-[10px] text-gray-500">Bendahara / Penerima Barang</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
