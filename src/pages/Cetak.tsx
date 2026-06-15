import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, Database, Play, ExternalLink, RefreshCw, FileText, FileCheck, Check, Calendar, ArrowUpRight, Download, Info
} from 'lucide-react';
import { toast } from 'sonner';

interface GeneratedReport {
  name: string;
  url: string;
  created: string;
  size: string;
}

interface GeneratedDatabase {
  name: string;
  url: string;
  created: string;
  size: string;
}

export default function Cetak() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Year states
  const [databases, setDatabases] = useState<GeneratedDatabase[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  // Print Form state
  const [documentType, setDocumentType] = useState<string>('kwitansi');
  const [activeMonth, setActiveMonth] = useState<string>('Januari');
  const [targetBukti, setTargetBukti] = useState<string>('');
  const [legacyTahap, setLegacyTahap] = useState<string>('Tahap I (Jan - Jun)');

  const [bkuLoading, setBkuLoading] = useState(false);
  const [bkuRows, setBkuRows] = useState<any[]>([]);
  const [localDocs, setLocalDocs] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Archives
  const [archivePdfs, setArchivePdfs] = useState<GeneratedReport[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  // Compile animations
  const [compiling, setCompiling] = useState(false);
  const [compileStep, setCompileStep] = useState(0);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const compileSteps = [
    'Menghubungkan ke server penyedia Google Apps...',
    'Membuka spreadsheet transaksi sekolah...',
    'Mengompilasi sisa alokasi pagu dana...',
    'Memetakan tanda tangan personnel sekolah...',
    'Mengonversi lembar kerja ke PDF resolusi tinggi...',
    'Menyimpan dan mendaftarkan dokumen ke arsip Drive...'
  ];

  // Fetch Databases list
  const fetchDatabases = async () => {
    setLoadingDatabases(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getGeneratedDatabases`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user?.sekolah })
      });
      const data = await response.json();
      if (data.success) {
        setDatabases(data.data || []);
        const dbs = data.data || [];
        if (dbs.length > 0) {
          const currentActive = localStorage.getItem('siap_bos_active_year') || '';
          const match = dbs.find((db: any) => db.name.includes(currentActive));
          if (!match) {
            const yearMatch = dbs[0].name.match(/\d+/);
            const yr = yearMatch ? yearMatch[0] : '2026';
            setActiveYear(yr);
            localStorage.setItem('siap_bos_active_year', yr);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDatabases(false);
    }
  };

  // Fetch compiled PDFs
  const fetchPdfArchives = async (silent = false) => {
    if (!user?.sekolah) return;
    if (!silent) setLoadingPdfs(true);
    try {
      // Fetch both standard docs and legacy reports
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getGeneratedPDFDocs`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user.sekolah })
      });
      const data = await response.json();
      if (data.success) {
        setArchivePdfs(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingPdfs(false);
    }
  };

  useEffect(() => {
    if (user?.sekolah) {
      fetchDatabases();
      fetchPdfArchives();
    }
  }, [user]);

  const handleYearChange = (year: string) => {
    setActiveYear(year);
    localStorage.setItem('siap_bos_active_year', year);
  };

  const fetchBkuTransactions = async (year: string, month: string) => {
    if (!user?.sekolah || !year || !month) return;
    setBkuLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: year,
          tipe: month
        })
      });
      const data = await response.json();
      if (data.success && data.rows) {
        setBkuRows(data.rows);
      } else {
        setBkuRows([]);
      }
    } catch (err) {
      console.error(err);
      setBkuRows([]);
    } finally {
      setBkuLoading(false);
    }
  };

  const getMonthNameFromDate = (dateStr: string) => {
    if (!dateStr) return '';
    
    // Check if contains verbal Indonesian month name
    const monthsMapPattern = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i;
    const match = dateStr.toLowerCase().match(monthsMapPattern);
    if (match) {
      const found = match[1];
      return found.charAt(0).toUpperCase() + found.slice(1);
    }

    // Try parsing using regex for DD/MM/YYYY or YYYY-MM-DD
    const tokens = dateStr.split(/\s+/);
    for (const token of tokens) {
      if (token.includes('/') || token.includes('-')) {
        const parts = token.split(/[-/]/);
        if (parts.length === 3) {
          let mm = -1;
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            mm = parseInt(parts[1]) - 1;
          } else if (parts[2].length === 4) {
            // DD/MM/YYYY
            mm = parseInt(parts[1]) - 1;
          }
          if (mm >= 0 && mm < 12) {
            return months[mm];
          }
        }
      }
    }
    
    // Native Date fallback
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return months[d.getMonth()];
      }
    } catch (e) {}

    return '';
  };

  const getGroupedKwitansis = () => {
    const validBkuRows = bkuRows.filter(row => {
      const isKreditNonZero = parseFloat(row.kredit) > 0;
      const hasBukti = row.bukti && row.bukti.trim() !== '' && row.bukti.trim() !== '-';
      return hasBukti && isKreditNonZero;
    });

    const groupedMap: { [key: string]: any } = {};

    validBkuRows.forEach(row => {
      const bkt = row.bukti.trim();
      const tgl = row.tanggal;
      const ket = row.keterangan || '';
      const kre = parseFloat(row.kredit) || 0;
      const keg = row.kodeKegiatan || '';
      const rek = row.kodeRekening || '';

      if (!groupedMap[bkt]) {
        groupedMap[bkt] = {
          noBukti: bkt,
          tanggal: tgl,
          items: [],
          totalKredit: 0
        };
      }
      
      groupedMap[bkt].items.push({
        keterangan: ket,
        kredit: kre,
        kodeKegiatan: keg,
        kodeRekening: rek
      });
      groupedMap[bkt].totalKredit += kre;
    });

    return Object.values(groupedMap);
  };

  useEffect(() => {
    if (!user?.sekolah || !activeYear) return;

    if (documentType === 'kwitansi') {
      fetchBkuTransactions(activeYear, activeMonth);
      setLocalDocs([]);
      setSelectedDocId('');
      return;
    }

    let storageKey = '';
    if (documentType === 'sp') {
      storageKey = `siap_bos_sp_${user.sekolah}_${activeYear}`;
    } else if (documentType === 'bast') {
      storageKey = `siap_bos_ba_${user.sekolah}_${activeYear}`;
    } else if (documentType === 'nota') {
      storageKey = `siap_bos_nota_${user.sekolah}_${activeYear}`;
    } else if (documentType === 'spd') {
      storageKey = `siap_bos_spd_${user.sekolah}_${activeYear}`;
    } else if (documentType === 'honor') {
      storageKey = `siap_bos_honor_${user.sekolah}_${activeYear}`;
    }

    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as any[];
          const filtered = parsed.filter(doc => {
            const docMonth = getMonthNameFromDate(doc.tanggal || doc.tanggalSurat || '');
            return docMonth.toLowerCase() === activeMonth.toLowerCase();
          });
          setLocalDocs(filtered);
        } catch (e) {
          setLocalDocs([]);
        }
      } else {
        setLocalDocs([]);
      }
    } else {
      setLocalDocs([]);
    }
    setBkuRows([]);
    setSelectedDocId('');
  }, [documentType, activeMonth, activeYear, user?.sekolah]);

  // Trigger compiler
  const handleCompileDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.sekolah || !activeYear) return;

    if (documentType === 'kwitansi') {
      const q = selectedDocId ? `&bukti=${encodeURIComponent(selectedDocId)}` : '';
      const url = `/kwitansi?month=${encodeURIComponent(activeMonth)}&year=${activeYear}${q}&autoPrint=true`;
      window.open(url, '_blank');
      return;
    }

    if (documentType === 'sp') {
      if (!selectedDocId) {
        toast.warning('Silakan pilih Surat Pemesanan yang ingin dicetak.');
        return;
      }
      const url = `/sp?id=${encodeURIComponent(selectedDocId)}&autoPrint=true`;
      window.open(url, '_blank');
      return;
    }

    if (documentType === 'bast') {
      if (!selectedDocId) {
        toast.warning('Silakan pilih Berita Acara yang ingin dicetak.');
        return;
      }
      const url = `/bast?id=${encodeURIComponent(selectedDocId)}&autoPrint=true`;
      window.open(url, '_blank');
      return;
    }

    if (documentType === 'nota') {
      if (!selectedDocId) {
        toast.warning('Silakan pilih Nota yang ingin dicetak.');
        return;
      }
      const url = `/nota?id=${encodeURIComponent(selectedDocId)}&autoPrint=true`;
      window.open(url, '_blank');
      return;
    }

    if (documentType === 'spd') {
      if (!selectedDocId) {
        toast.warning('Silakan pilih Perjalanan Dinas yang ingin dicetak.');
        return;
      }
      const url = `/spd?id=${encodeURIComponent(selectedDocId)}&autoPrint=true`;
      window.open(url, '_blank');
      return;
    }

    if (documentType === 'honor') {
      if (!selectedDocId) {
        toast.warning('Silakan pilih Honorarium yang ingin dicetak.');
        return;
      }
      const url = `/honor?id=${encodeURIComponent(selectedDocId)}&autoPrint=true`;
      window.open(url, '_blank');
      return;
    }

    setCompiling(true);
    setCompileStep(0);

    const interval = setInterval(() => {
      setCompileStep(prev => {
        if (prev < compileSteps.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 1200);

    try {
      let endpointAction = 'generatePDFDoc';
      let payloadTipe = 'RKAS';

      if (documentType === 'rkas') {
        payloadTipe = 'RKAS';
      } else if (documentType === 'bku') {
        payloadTipe = activeMonth;
      } else {
        // Legacy reports
        endpointAction = 'generateReport';
        payloadTipe = documentType; // K7a, K7b, SPTJM, etc.
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=${endpointAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: payloadTipe,
          jenis: documentType, // For legacy
          tahap: legacyTahap // For legacy
        })
      });
      const data = await response.json();
      clearInterval(interval);

      if (data.success) {
        toast.success(`Dokumen laporan berhasil diterbitkan ke folder PDF_LAPORAN sekolah di Google Drive!`);
        fetchPdfArchives(true);
        if (data.fileUrl) {
          window.open(data.fileUrl, '_blank');
        }
      } else {
        toast.error(data.message || 'Gagal menerbitkan PDF.');
      }
    } catch (err) {
      clearInterval(interval);
      toast.error('Kesalahan koneksi dengan layanan compile Google Apps Script.');
    } finally {
      setCompiling(false);
    }
  };

  const calculateDocTotal = (items: any[]) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.jumlah !== undefined ? item.jumlah : item.volume !== undefined ? item.volume : 1) || 0;
      const price = parseFloat(item.hargaSatuan !== undefined ? item.hargaSatuan : item.tarifSatu !== undefined ? item.tarifSatu : 0) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const documentTypeDisplay = () => {
    if (documentType === 'kwitansi') return 'Kwitansi';
    if (documentType === 'sp') return 'Surat Pemesanan';
    if (documentType === 'bast') return 'Berita Acara (BAST)';
    if (documentType === 'nota') return 'Nota Belanja';
    if (documentType === 'spd') return 'Perjalanan Dinas (SPD)';
    if (documentType === 'honor') return 'Honorarium';
    return 'Dokumen';
  };

  const getActiveCount = () => {
    if (documentType === 'kwitansi') {
      return getGroupedKwitansis().length;
    }
    return localDocs.length;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-4 px-2">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Printer size={22} />
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">CETAK DOKUMEN BELANJA</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-sans">Pilih jenis dokumen dan klik tombol Cetak langsung pada daftar dokumen di bawah ({user?.sekolah}).</p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl text-xs">
          <Database size={14} className="text-indigo-500" />
          <span className="font-bold text-gray-700 dark:text-gray-300">Tahun Anggaran:</span>
          {loadingDatabases ? (
            <RefreshCw size={12} className="animate-spin text-gray-400" />
          ) : databases.length > 0 ? (
            <select
              value={activeYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-transparent text-indigo-600 dark:text-indigo-400 font-black focus:outline-none cursor-pointer"
            >
              {databases.map(db => {
                const yrMatch = db.name.match(/\d+/);
                const yr = yrMatch ? yrMatch[0] : '2026';
                return <option key={db.name} value={yr}>{yr}</option>;
              })}
            </select>
          ) : (
            <span className="text-red-500 font-bold">Harap Buat Database Terlebih Dahulu</span>
          )}
        </div>
      </div>

      {databases.length === 0 && !loadingDatabases ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-xl mx-auto space-y-4">
          <Info size={32} className="text-blue-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-950 dark:text-white">Database Belum Siap</h3>
          <p className="text-xs text-gray-500">
            Anda belum memiliki database aktif. Silakan buka Dashboard untuk membuat database tahunan sekolah terlebih dahulu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Print compilation form */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-6 rounded-2xl shadow-sm h-fit space-y-5">
            <div className="border-b border-gray-100 dark:border-gray-750 pb-3">
              <h3 className="font-black text-md text-gray-800 dark:text-white">Filter Cetak Dokumen</h3>
              <p className="text-xs text-gray-450 mt-0.5">Konfigurasikan jenis dokumen dan bulan untuk memfilter daftar berkas.</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4 font-sans text-xs text-gray-950 dark:text-gray-100">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block font-sans">Pilih Jenis Dokumen</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full p-2.5 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-gray-900 border border-indigo-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-indigo-700 dark:text-indigo-400 cursor-pointer text-xs transition"
                >
                  <option value="kwitansi">1. Kwitansi Belanja</option>
                  <option value="sp">2. Surat Pemesanan (SP)</option>
                  <option value="bast">3. Berita Acara (BAST)</option>
                  <option value="nota">4. Nota Belanja</option>
                  <option value="spd">5. Perjalanan Dinas (SPD)</option>
                  <option value="honor">6. Honorarium</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block font-sans">Bulan Transaksi</label>
                <select
                  value={activeMonth}
                  onChange={(e) => setActiveMonth(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-gray-800 dark:text-gray-200 cursor-pointer text-xs"
                >
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-750">
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block font-mono">Informasi</span>
                  <p className="text-[10.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                    Gunakan panel di sebelah kanan untuk mencetak berkas secara individu. Saring berdasarkan jenis dokumen dan bulan di atas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCompileDocument}
                disabled={compiling}
                className="w-full flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 text-white font-bold p-3 rounded-xl transition shadow-lg shadow-indigo-600/10 cursor-pointer text-xs disabled:opacity-50"
              >
                <RefreshCw size={14} className={compiling ? 'animate-spin' : ''} />
                <span>Kompilasi ke Google Drive</span>
              </button>

            </form>
          </div>

          {/* Right Main Archiving Columns */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Animating status bar */}
            <AnimatePresence>
              {compiling && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-indigo-950 border border-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden space-y-3"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
                  <h4 className="text-md font-bold tracking-tight mb-1 flex items-center gap-2 text-cyan-300">
                    <RefreshCw className="animate-spin text-cyan-400" size={18} />
                    APLIKASI SEDANG MERENDER PDF LAPORAN...
                  </h4>
                  <p className="text-xs text-indigo-200">
                    Menghubungkan ke SDK Google Apps Script untuk merekap saldo transaksi dan menuangkan tanda tangan ke lembar kop standardisasi BOS.
                  </p>
                  
                  <div className="relative w-full h-2 bg-indigo-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-teal-300 to-cyan-300"
                      animate={{ width: `${((compileStep + 1) / compileSteps.length) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 p-1">
                    {compileSteps.map((step, idx) => (
                      <div 
                        key={step} 
                        className={`flex items-center gap-2.5 text-[11px] transition-colors ${
                          compileStep === idx ? 'text-cyan-300 font-semibold' : 
                          compileStep > idx ? 'text-indigo-300 line-through opacity-70' : 
                          'text-indigo-400 opacity-40'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          compileStep === idx ? 'bg-cyan-300 animate-pulse' : 
                          compileStep > idx ? 'bg-indigo-300' : 
                          'bg-indigo-500'
                        }`} />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* NEW: Dynamic Document Print List */}
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-750 pb-4">
                <div>
                  <h3 className="font-black text-md text-gray-800 dark:text-white flex items-center gap-2">
                    <Printer size={16} className="text-indigo-500" />
                    Daftar {documentTypeDisplay()} Siap Cetak
                  </h3>
                  <p className="text-xs text-gray-450 mt-0.5 font-sans">
                    Periode: <strong className="text-indigo-600 dark:text-indigo-400">{activeMonth} {activeYear}</strong>
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {documentType === 'kwitansi' && getGroupedKwitansis().length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          const url = `/kwitansi?month=${encodeURIComponent(activeMonth)}&year=${activeYear}`;
                          window.open(url, '_blank');
                        }}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl flex items-center gap-1.5 transition text-[10.5px] cursor-pointer"
                      >
                        <FileText size={12} />
                        Lihat Semua
                      </button>
                      <button
                        onClick={() => {
                          const url = `/kwitansi?month=${encodeURIComponent(activeMonth)}&year=${activeYear}&autoPrint=true`;
                          window.open(url, '_blank');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition text-[10.5px] cursor-pointer shadow-sm shadow-indigo-600/10"
                      >
                        <Printer size={12} />
                        Cetak Semua ({getGroupedKwitansis().length})
                      </button>
                    </>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-[10.5px] font-black font-mono">
                    {getActiveCount()} Berkas
                  </span>
                </div>
              </div>

              {bkuLoading ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-indigo-600" size={24} />
                  <span className="text-xs text-gray-400 font-medium font-sans">Sedang memuat data transaksi dari BKU...</span>
                </div>
              ) : documentType === 'kwitansi' ? (
                (() => {
                  const items = getGroupedKwitansis();
                  if (items.length === 0) {
                    return (
                      <div className="py-10 text-center text-gray-400 space-y-2">
                        <FileCheck size={32} className="mx-auto opacity-30" />
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 font-sans">Belum Ada Transaksi</p>
                        <p className="text-[11px] text-gray-500 max-w-sm mx-auto font-sans">
                          Tidak terdapat transaksi pengeluaran BKU dengan nomor bukti sah di bulan {activeMonth} {activeYear}. Pastikan Anda telah meng-import data BKU.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {items.map((gk) => {
                        const listKeterangans = gk.items.map((it: any) => it.keterangan || '').filter(Boolean).join(', ');
                        const truncatedDesc = listKeterangans.length > 100 ? listKeterangans.substring(0, 100) + '...' : listKeterangans;
                        return (
                          <div 
                            key={gk.noBukti}
                            className="p-3.5 border border-gray-150 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-indigo-50/10 rounded-xl flex items-center justify-between gap-4 transition-all"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap pb-0.5">
                                <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                                  {gk.noBukti}
                                </span>
                                <span className="text-[10px] text-gray-405 dark:text-gray-500 font-mono">
                                  {gk.tanggal}
                                </span>
                              </div>
                              <p className="text-[11.5px] font-medium text-gray-700 dark:text-gray-300 truncate font-sans">
                                {truncatedDesc || 'Kwitansi Pembelanjaan'}
                              </p>
                              <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                Rp {gk.totalKredit.toLocaleString('id-ID')}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const url = `/kwitansi?month=${encodeURIComponent(activeMonth)}&year=${activeYear}&bukti=${encodeURIComponent(gk.noBukti)}&autoPrint=true`;
                                window.open(url, '_blank');
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 transition text-[11px] shrink-0 cursor-pointer shadow-sm"
                            >
                              <Printer size={12} />
                              Cetak
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (() => {
                if (localDocs.length === 0) {
                  return (
                    <div className="py-10 text-center text-gray-400 space-y-2">
                      <FileCheck size={32} className="mx-auto opacity-30" />
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300 font-sans">Belum Ada Dokumen</p>
                      <p className="text-[11px] text-gray-500 max-w-sm mx-auto font-sans">
                        Belum ada dokumen {documentTypeDisplay()} yang disimpan untuk bulan {activeMonth} {activeYear}. Silakan isi data di menu masing-masing terlebih dahulu.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {localDocs.map((doc) => {
                      let docNo = '';
                      let docSub = '';
                      let docDesc = '';
                      let docTotal = 0;
                      let docDate = doc.tanggal || '';
                      let actionPath = '';

                      if (documentType === 'sp') {
                        docNo = doc.nomorSp || 'Tanpa No SP';
                        docSub = `Rekanan: ${doc.namaPenyedia || '-'}`;
                        docDesc = doc.items?.map((it: any) => it.namaBarang || it.keterangan || '').filter(Boolean).join(', ') || 'Surat Pemesanan Barang';
                        docTotal = calculateDocTotal(doc.items);
                        docDate = doc.tanggalSurat || doc.tanggal || '';
                        actionPath = `/sp?id=${encodeURIComponent(doc.id)}&autoPrint=true`;
                      } else if (documentType === 'bast') {
                        docNo = doc.nomorBast || 'Tanpa No BAST';
                        docSub = `Rekanan: ${doc.namaPenyedia || '-'}`;
                        docDesc = `Serah terima fisik barang standardisasi (BAPB: ${doc.nomorBapb || '-'})`;
                        docTotal = calculateDocTotal(doc.items);
                        actionPath = `/bast?id=${encodeURIComponent(doc.id)}&autoPrint=true`;
                      } else if (documentType === 'nota') {
                        docNo = doc.nomorNota || 'Tanpa No Nota';
                        docSub = `Toko/Penyedia: ${doc.namaToko || '-'}`;
                        docDesc = doc.items?.map((it: any) => it.keterangan || '').filter(Boolean).join(', ') || 'Nota Pembelanjaan';
                        docTotal = calculateDocTotal(doc.items);
                        actionPath = `/nota?id=${encodeURIComponent(doc.id)}&autoPrint=true`;
                      } else if (documentType === 'spd') {
                        docNo = doc.nomorSpd || 'Tanpa No SPD';
                        docSub = `Pelaksana: ${doc.namaPelaksana || '-'}`;
                        docDesc = `Tujuan: ${doc.tujuan || '-'} (${doc.maksudPerjalanan || '-'})`;
                        docTotal = calculateDocTotal(doc.items);
                        actionPath = `/spd?id=${encodeURIComponent(doc.id)}&autoPrint=true`;
                      } else if (documentType === 'honor') {
                        docNo = doc.nomorHonor || 'Tanpa No Honor';
                        docSub = `Penerima: ${doc.namaPenerima || '-'}`;
                        docDesc = `Kegiatan: ${doc.namaKegiatan || '-'} (${doc.peranDalamKegiatan || '-'})`;
                        docTotal = (parseFloat(doc.volumeKerja) || 0) * (parseFloat(doc.tarifSatu) || 0);
                        actionPath = `/honor?id=${encodeURIComponent(doc.id)}&autoPrint=true`;
                      }

                      const truncatedDesc = docDesc.length > 100 ? docDesc.substring(0, 100) + '...' : docDesc;

                      return (
                        <div 
                          key={doc.id}
                          className="p-3.5 border border-gray-150 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-indigo-50/10 rounded-xl flex items-center justify-between gap-4 transition-all"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap pb-0.5">
                              <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                                {docNo}
                              </span>
                              <span className="text-[10px] text-gray-405 dark:text-gray-500 font-mono">
                                {docDate}
                              </span>
                            </div>
                            <div className="text-[11.5px] font-bold text-gray-800 dark:text-gray-200 font-sans">{docSub}</div>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate mt-0.5 font-sans">
                              {truncatedDesc}
                            </p>
                            <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              Rp {docTotal.toLocaleString('id-ID')}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              window.open(actionPath, '_blank');
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 transition text-[11px] shrink-0 cursor-pointer shadow-sm"
                          >
                            <Printer size={12} />
                            Cetak
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Arsip PDF Files feeds lists */}
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-750 pb-4">
                <div>
                  <h3 className="font-bold text-md text-gray-800 dark:text-white">Arsip Dokumen PDF Resmi</h3>
                  <p className="text-xs text-gray-450 font-sans">Semua file PDF laporan hasil render tersimpan di folder <span className="font-mono font-bold text-indigo-600">PDF_LAPORAN</span> Google Drive.</p>
                </div>
                <button
                  onClick={() => fetchPdfArchives()}
                  disabled={loadingPdfs}
                  className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:bg-gray-50 shrink-0"
                >
                  <RefreshCw size={14} className={loadingPdfs ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingPdfs ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-indigo-600" size={28} />
                  <span className="text-xs text-gray-400 font-sans">Mensinkronisasikan arsip PDF...</span>
                </div>
              ) : archivePdfs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {archivePdfs.map((pdfDoc) => (
                    <div key={pdfDoc.name} className="p-4 border border-gray-150 dark:border-gray-805 hover:border-indigo-400 dark:bg-gray-900 rounded-2xl flex flex-col justify-between space-y-3.5 text-xs">
                      
                      <div className="flex items-start gap-2.5">
                        <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h4 className="font-bold text-gray-800 dark:text-white break-all leading-snug">{pdfDoc.name}</h4>
                          <span className="text-[10px] text-gray-400 font-mono block">Ukuran: {pdfDoc.size}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-white dark:bg-gray-805 p-1 rounded-lg border border-gray-100 dark:border-gray-800">
                        <span className="text-[10px] text-gray-400 pl-1">Publikasi Drive</span>
                        <a 
                          href={pdfDoc.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black rounded flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <span>Buka PDF</span>
                          <ArrowUpRight size={11} />
                        </a>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-gray-400 space-y-2">
                  <FileCheck size={36} className="mx-auto opacity-40 mb-2" />
                  <p className="text-sm font-bold text-gray-700 dark:text-white">Arsip PDF Kosong</p>
                  <p className="text-xs text-gray-500 px-12 font-sans">Konfigurasikan form cetak di sebelah kiri dan klik tombol Kompilasi ke Google Drive untuk menerbitkan laporan berformat standar.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
