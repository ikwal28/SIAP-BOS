import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardCheck, Printer, Search, Edit2, Save, X, ArrowLeft, FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderedItem {
  id: string;
  namaBarang: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  total: number;
}

interface SuratPemesananData {
  id: string;
  nomorSp: string;
  tanggal: string;
  namaPenyedia: string;
  alamatPenyedia: string;
  pimpinanPenyedia: string;
  items: OrderedItem[];
  kepsek: string;
  nipKepsek: string;
  bendahara: string;
  nipBendahara: string;
  catatan?: string;
  activeYear: string;
  kodeBukti?: string;
  tanggalSurat?: string;
  kabupatenCetak?: string;
  tanggalKirim?: string;
}

// Smart date parser to handle custom Indonesian and standard formats safely
function parseSmartDate(str: any): Date | null {
  if (!str) return null;
  let cleanStr = String(str).trim();
  if (cleanStr === '') return null;

  if (cleanStr.includes('(')) {
    cleanStr = cleanStr.split('(')[0].trim();
  }

  if (cleanStr.includes('/Date(')) {
    const match = cleanStr.match(/\d+/);
    if (match) {
      const d = new Date(parseInt(match[0]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  const tokens = cleanStr.split(/\s+/);
  for (const token of tokens) {
    if (token.includes('/') || token.includes('-')) {
      const parts = token.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const yyyy = parseInt(parts[0]);
          const mm = parseInt(parts[1]) - 1;
          const dd = parseInt(parts[2]);
          const d = new Date(yyyy, mm, dd);
          if (!isNaN(d.getTime())) return d;
        } else if (parts[2].length === 4) {
          const dd = parseInt(parts[0]);
          const mm = parseInt(parts[1]) - 1;
          const yyyy = parseInt(parts[2]);
          const d = new Date(yyyy, mm, dd);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
  }

  const monthsMap: { [key: string]: number } = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
  };
  const cleaned = cleanStr.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const parts = cleaned.split(/\s+/);
  if (parts.length === 3) {
    const dd = parseInt(parts[0]);
    const mm = monthsMap[parts[1]] !== undefined ? monthsMap[parts[1]] : -1;
    const yyyy = parseInt(parts[2]);
    if (dd > 0 && mm >= 0 && yyyy > 1000) {
      const d = new Date(yyyy, mm, dd);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const fallbackDate = new Date(cleanStr);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return null;
}

function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseSmartDate(dateStr);
  if (d && !isNaN(d.getTime())) {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dateStr;
}

export default function BeritaAcara() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [orders, setOrders] = useState<SuratPemesananData[]>([]);
  const [overrides, setOverrides] = useState<{ [id: string]: any }>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Edit states
  const [selectedOrder, setSelectedOrder] = useState<SuratPemesananData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formNomorBa, setFormNomorBa] = useState('');
  const [formTanggalBa, setFormTanggalBa] = useState('');
  const [formNamaPenyedia, setFormNamaPenyedia] = useState('');
  const [formPimpinanPenyedia, setFormPimpinanPenyedia] = useState('');
  const [formKepsek, setFormKepsek] = useState('');
  const [formNipKepsek, setFormNipKepsek] = useState('');
  const [formBendahara, setFormBendahara] = useState('');
  const [formNipBendahara, setFormNipBendahara] = useState('');
  const [formKabupatenCetak, setFormKabupatenCetak] = useState('');

  // Load orders and overrides from localStorage
  useEffect(() => {
    // 1. Fetch SP (Surat Pemesanan)
    const spStorageKey = `siap_bos_sp_${user?.sekolah || 'default'}_${activeYear}`;
    const savedSp = localStorage.getItem(spStorageKey);
    if (savedSp) {
      try {
        setOrders(JSON.parse(savedSp));
      } catch (e) {
        console.error("Error parsing saved SP:", e);
      }
    } else {
      setOrders([]);
    }

    // 2. Fetch BA overrides
    const overridesStorageKey = `siap_bos_ba_overrides_${user?.sekolah || 'default'}_${activeYear}`;
    const savedOverrides = localStorage.getItem(overridesStorageKey);
    if (savedOverrides) {
      try {
        setOverrides(JSON.parse(savedOverrides));
      } catch (e) {
        console.error("Error parsing overrides:", e);
      }
    } else {
      setOverrides({});
    }
  }, [user?.sekolah, activeYear]);

  // Save overrides helper
  const saveOverrides = (updatedOverrides: { [id: string]: any }) => {
    const overridesStorageKey = `siap_bos_ba_overrides_${user?.sekolah || 'default'}_${activeYear}`;
    localStorage.setItem(overridesStorageKey, JSON.stringify(updatedOverrides));
    setOverrides(updatedOverrides);
  };

  const handleOpenEditModal = (order: SuratPemesananData) => {
    const override = overrides[order.id] || {};
    setSelectedOrder(order);
    setFormNomorBa(override.nomorBa || '');
    setFormTanggalBa(override.tanggalBa || order.tanggal);
    setFormNamaPenyedia(override.namaPenyedia || order.namaPenyedia);
    setFormPimpinanPenyedia(override.pimpinanPenyedia || order.pimpinanPenyedia);
    setFormKepsek(override.kepsek || order.kepsek);
    setFormNipKepsek(override.nipKepsek || order.nipKepsek);
    setFormBendahara(override.bendahara || order.bendahara);
    setFormNipBendahara(override.nipBendahara || order.nipBendahara);
    setFormKabupatenCetak(override.kabupatenCetak || order.kabupatenCetak || user?.kabupaten || 'Nagan Raya');
    setShowEditModal(true);
  };

  const handleSaveOverride = () => {
    if (!selectedOrder) return;
    const updated = {
      ...overrides,
      [selectedOrder.id]: {
        nomorBa: formNomorBa,
        tanggalBa: formTanggalBa,
        namaPenyedia: formNamaPenyedia,
        pimpinanPenyedia: formPimpinanPenyedia,
        kepsek: formKepsek,
        nipKepsek: formNipKepsek,
        bendahara: formBendahara,
        nipBendahara: formNipBendahara,
        kabupatenCetak: formKabupatenCetak,
      }
    };
    saveOverrides(updated);
    setShowEditModal(false);
    toast.success("Berita Acara berhasil diperbarui!");
  };

  const getProcessedBa = (order: SuratPemesananData) => {
    const override = overrides[order.id] || {};
    return {
      ...order,
      nomorBa: override.nomorBa || '',
      tanggalBa: override.tanggalBa || order.tanggal,
      namaPenyedia: override.namaPenyedia || order.namaPenyedia,
      pimpinanPenyedia: override.pimpinanPenyedia || order.pimpinanPenyedia,
      kepsek: override.kepsek || order.kepsek,
      nipKepsek: override.nipKepsek || order.nipKepsek,
      bendahara: override.bendahara || order.bendahara,
      nipBendahara: override.nipBendahara || order.nipBendahara,
      kabupatenCetak: override.kabupatenCetak || order.kabupatenCetak || user?.kabupaten || 'Nagan Raya',
    };
  };

  const triggerPrint = (order: SuratPemesananData) => {
    const processed = getProcessedBa(order);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela cetak. Pastikan izin popup browser diaktifkan.');
      return;
    }

    const itemsHtml = processed.items.map((item, idx) => `
      <tr class="border-b border-black">
        <td class="border border-black py-1 text-center text-[11px]">${idx + 1}</td>
        <td class="border border-black py-1 px-2 text-[11px] text-justify font-bold">${item.namaBarang}</td>
        <td class="border border-black py-1 text-center font-bold text-[11px]">${item.volume}</td>
        <td class="border border-black py-1 text-center uppercase text-[11px]">${item.satuan}</td>
        <td class="border border-black py-1 px-1.5 text-right text-[11px]">
          <div class="flex justify-between w-full font-mono">
            <span class="mr-1">RP</span>
            <span>${item.hargaSatuan.toLocaleString('id-ID')}</span>
          </div>
        </td>
        <td class="border border-black py-1 px-1.5 text-right font-black text-[11px]">
          <div class="flex justify-between w-full font-mono">
            <span class="mr-1">RP</span>
            <span>${(item.volume * item.hargaSatuan).toLocaleString('id-ID')}</span>
          </div>
        </td>
        <td class="border border-black py-1 text-center text-[11px] font-bold">BAIK</td>
      </tr>
    `).join('');

    const totalVal = processed.items.reduce((sum, item) => sum + (item.volume * item.hargaSatuan), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Berita Acara - ${processed.nomorSp}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: #f7f9fa;
            margin: 0;
            padding: 20px;
          }
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            body {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .a4-page {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              box-sizing: border-box !important;
              background: white !important;
            }
          }
          .a4-page {
            background: white;
            width: 210mm;
            padding: 12mm 10mm !important;
            margin: 0 auto;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            border-radius: 8px;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div class="no-print max-w-[210mm] mx-auto mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-2xl border border-gray-250">
          <div>
            <div class="text-sm font-bold text-gray-800">Pratinjau Berita Acara (A4 Portrait)</div>
            <div class="text-xs text-gray-500">Nomor Bukti SP: ${processed.kodeBukti || processed.nomorSp}</div>
          </div>
          <button onclick="window.print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">
            Cetak Berita Acara
          </button>
        </div>

        <div class="a4-page text-black leading-snug text-[11.5px]">
          <!-- Centered Title -->
          <div class="text-center mb-6">
            <h1 class="text-[14px] font-bold tracking-wide uppercase">BERITA ACARA PEMERIKSAAN DAN PENERIMAAN BARANG</h1>
          </div>

          <!-- Metadata table exactly aligned to template image -->
          <div class="mb-4 text-left text-black">
            <table class="w-full text-[11.5px] text-black border-none border-collapse text-left">
              <tbody>
                <tr class="border-none">
                  <td class="w-24 font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Nomor</td>
                  <td class="w-4 py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 valign-top align-top border-none text-black">${processed.nomorBa || '…………………………………………………………'}</td>
                </tr>
                <tr class="border-none">
                  <td class="font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Tanggal</td>
                  <td class="w-4 py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 valign-top align-top border-none text-black">${formatIndonesianDate(processed.tanggalBa)}</td>
                </tr>
                <tr class="border-none">
                  <td class="font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Penyedia</td>
                  <td class="w-4 py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 valign-top align-top border-none text-black">${processed.namaPenyedia}</td>
                </tr>
                <tr class="border-none">
                  <td class="font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Pemesan</td>
                  <td class="w-4 py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 border-none text-black">
                    <div class="font-normal">${user?.sekolah || 'SD Negeri 2 Laot Tadu'}</div>
                    <div class="pl-4 mt-0.5 space-y-0.5 text-black">
                      <p>1. ${processed.kepsek} (Kepala Sekolah)</p>
                      <p>2. ${processed.bendahara} (Bendahara Sekolah)</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Description sentence -->
          <p class="mt-4 mb-2 text-[11.5px] text-justify leading-relaxed text-black font-normal">
            Berdasarkan dari Surat Pesanan kepada penyedia, kami telah menerima dan memeriksa barang yang telah dikirimkan oleh penyedia dengan detail sebagai berikut :
          </p>

          <!-- Table with centered alignment, bold items, right totals -->
          <table class="w-full border-collapse border border-black text-[11.5px] mb-4">
            <thead>
              <tr class="font-bold border-b border-black text-black bg-gray-50/50">
                <th class="border border-black py-1 px-1 text-center w-8">NO</th>
                <th class="border border-black py-1 px-2 text-left">NAMA BARANG</th>
                <th class="border border-black py-1 px-1 text-center w-10">VOL</th>
                <th class="border border-black py-1 px-1 text-center w-16">SATUAN</th>
                <th class="border border-black py-1 px-1 text-right w-24">HARGA SATUAN</th>
                <th class="border border-black py-1 px-1 text-right w-24">JUMLAH</th>
                <th class="border border-black py-1 px-1 text-center w-16">KONDISI</th>
              </tr>
            </thead>
            <tbody class="text-black">
              ${itemsHtml}
              <tr class="font-bold">
                <td colSpan="5" class="border border-black py-1 px-2 text-center uppercase text-black">JUMLAH</td>
                <td class="border border-black py-1 px-1.5 text-right text-black font-black">
                  <div class="flex justify-between w-full font-mono">
                    <span class="mr-1">RP</span>
                    <span>${totalVal.toLocaleString('id-ID')}</span>
                  </div>
                </td>
                <td class="border border-black py-1 px-1 text-center font-bold"></td>
              </tr>
            </tbody>
          </table>

          <!-- Footer sentence -->
          <p class="mb-4 text-[11.5px] text-justify leading-relaxed text-black font-normal">
            Demikian Berita Acara Pemeriksaan dan Penerimaan Barang ini di buat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.
          </p>

          <!-- Two-Signature Block aligned perfectly to picture template -->
          <div class="mt-10 flex justify-between text-[11.5px] text-black font-normal leading-normal">
            <!-- Left Signature: Penyedia -->
            <div class="w-72 text-left space-y-16">
              <div>
                <p>Penyedia</p>
              </div>
              <div>
                <p class="font-bold underline uppercase">${processed.namaPenyedia}</p>
              </div>
            </div>

            <!-- Right Signature: Kepala Sekolah & Kabupaten -->
            <div class="w-72 text-left space-y-16">
              <div>
                <p>Kepala Sekolah ${user?.sekolah || 'SD Negeri 2 Laot Tadu'}</p>
                <p>${processed.kabupatenCetak}</p>
              </div>
              <div>
                <p class="font-bold underline">${processed.kepsek}</p>
                ${(processed.nipKepsek && processed.nipKepsek.trim() !== '') ? `<p>NIP. ${processed.nipKepsek}</p>` : ''}
              </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const filteredOrders = orders.filter(o => 
    o.nomorSp.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.kodeBukti && o.kodeBukti.toLowerCase().includes(searchQuery.toLowerCase())) ||
    o.namaPenyedia.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white flex items-center gap-3 font-sans">
            <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <ClipboardCheck size={24} />
            </span>
            Berita Acara Pemeriksaan & Penerimaan Barang
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Berita Acara pemeriksaan fisik otomatis digenerate secara langsung dari Surat Pemesanan yang telah Anda daftarkan.
          </p>
        </div>
      </div>

      {/* Control panel and query box */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor SP, nomor Bukti, atau penyedia..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 transition text-gray-900 dark:text-white font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase font-sans">Tahun Aktif:</span>
            <select
              value={activeYear}
              onChange={(e) => {
                setActiveYear(e.target.value);
                localStorage.setItem('siap_bos_active_year', e.target.value);
              }}
              className="py-1.5 px-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden font-bold"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          {filteredOrders.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-400 uppercase bg-gray-50 dark:bg-gray-950">
                  <th className="py-3 px-4">No. Bukti / SP</th>
                  <th className="py-3 px-4">Tanggal SP</th>
                  <th className="py-3 px-4">Toko / Penyedia</th>
                  <th className="py-3 px-4 text-right">Nilai Kontrak</th>
                  <th className="py-3 px-4 text-center">Nomor Berita Acara</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredOrders.map((order) => {
                  const processed = getProcessedBa(order);
                  const totalVal = order.items.reduce((sum, item) => sum + (item.volume * item.hargaSatuan), 0);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-gray-900 dark:text-white transition-colors">
                      <td className="py-4 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        <div>{order.kodeBukti || 'Tanpa Bukti'}</div>
                        <div className="text-[11px] text-gray-400 font-medium font-sans mt-0.5">{order.nomorSp}</div>
                      </td>
                      <td className="py-4 px-4 font-medium">{formatIndonesianDate(order.tanggal)}</td>
                      <td className="py-4 px-4">
                        <div className="font-bold">{processed.namaPenyedia}</div>
                        <div className="text-xs text-gray-500 font-medium">Pimpinan: {processed.pimpinanPenyedia}</div>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        Rp {totalVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-gray-600 dark:text-gray-300 font-bold">
                        {processed.nomorBa || <span className="text-gray-400 italic">Dotted (Kosong)</span>}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => triggerPrint(order)}
                            title="Cetak Berita Acara"
                            className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition cursor-pointer"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(order)}
                            title="Sesuaikan BA"
                            className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition cursor-pointer"
                          >
                            <Edit2 size={16} />
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
              <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="font-bold text-sm">Belum ada Surat Pemesanan yang tersedia</p>
              <p className="text-xs mt-1 max-w-sm mx-auto">Sistem Berita Acara mendeteksi data secara real-time dari Surat Pemesanan. Daftarkan Surat Pemesanan terlebih dahulu.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Override Form Modal */}
      <AnimatePresence>
        {showEditModal && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-5">
                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <ClipboardCheck className="text-indigo-600" />
                  Sesuaikan Berita Acara Pemeriksaan
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor Berita Acara (Nomor)</label>
                  <input
                    type="text"
                    value={formNomorBa}
                    onChange={(e) => setFormNomorBa(e.target.value)}
                    placeholder="Kosongkan untuk default titik-titik (…)"
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tanggal Berita Acara</label>
                  <input
                    type="text"
                    value={formTanggalBa}
                    onChange={(e) => setFormTanggalBa(e.target.value)}
                    placeholder="e.g. 03 Maret 2026"
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama Toko Penyedia</label>
                  <input
                    type="text"
                    value={formNamaPenyedia}
                    onChange={(e) => setFormNamaPenyedia(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Kabupaten Pembuatan</label>
                  <input
                    type="text"
                    value={formKabupatenCetak}
                    onChange={(e) => setFormKabupatenCetak(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2 border-t border-gray-150 dark:border-gray-800 my-2 pt-3">
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase mb-2">Penandatangan Sekolah</h3>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    value={formKepsek}
                    onChange={(e) => setFormKepsek(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    value={formNipKepsek}
                    onChange={(e) => setFormNipKepsek(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama Bendahara</label>
                  <input
                    type="text"
                    value={formBendahara}
                    onChange={(e) => setFormBendahara(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">NIP Bendahara</label>
                  <input
                    type="text"
                    value={formNipBendahara}
                    onChange={(e) => setFormNipBendahara(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-150 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 bg-gray-150 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveOverride}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-sm text-sm cursor-pointer"
                >
                  <Save size={16} />
                  Simpan Penyesuaian
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
