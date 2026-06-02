import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  
  // Year states
  const [databases, setDatabases] = useState<GeneratedDatabase[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  // Print Form state
  const [documentType, setDocumentType] = useState<string>('rkas');
  const [activeMonth, setActiveMonth] = useState<string>('Januari');
  const [legacyTahap, setLegacyTahap] = useState<string>('Tahap I (Jan - Jun)');

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

  // Trigger compiler
  const handleCompileDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.sekolah || !activeYear) return;

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-4 px-2">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Printer size={22} />
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">CETAK LAPORAN PEMBELANJAAN</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-sans">Render rincian kerja sekolah langsung menjadi PDF fisik berstandarisasi regulasi ({user?.sekolah}).</p>
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
              <h3 className="font-black text-md text-gray-800 dark:text-white">Penerbitan Dokumen BOS</h3>
              <p className="text-xs text-gray-450 mt-0.5">Membaca sheet transaksi, memformat kop serta legalisasi tanda tangan.</p>
            </div>

            <form onSubmit={handleCompileDocument} className="space-y-4 font-sans text-xs">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Jenis Dokumen Laporan</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  <option value="rkas">RKAS (Rencana Kegiatan Anggaran)</option>
                  <option value="bku">Buku Kas Umum (BKU) Bulanan</option>
                  <option value="Laporan BOS Reguler K7a">Laporan BOS Reguler (K7a)</option>
                  <option value="Laporan Realisasi K7b">Realisasi Penggunaan (K7b)</option>
                  <option value="Surat Tanggung Jawab SPTJM">Surat Pertanggungjawaban Mutlak (SPTJM)</option>
                </select>
              </div>

              {documentType === 'bku' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Bulan Transaksi BKU</label>
                  <select
                    value={activeMonth}
                    onChange={(e) => setActiveMonth(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
                  >
                    {months.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {['Laporan BOS Reguler K7a', 'Laporan Realisasi K7b'].includes(documentType) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Tahap Kelayakan / Penyaluran</label>
                  <select
                    value={legacyTahap}
                    onChange={(e) => setLegacyTahap(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
                  >
                    <option value="Tahap I (Jan - Jun)">Tahap I (Januari - Juni)</option>
                    <option value="Tahap II (Jul - Des)">Tahap II (Juli - Desember)</option>
                    <option value="Setahun Penuh">Setahun Penuh (Tahap I & II)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={compiling}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-550 to-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-xl transition shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
              >
                <Printer size={15} />
                <span>Render Cetak PDF ({activeYear})</span>
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

            {/* Arsip PDF Files feeds lists */}
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-750 pb-4">
                <div>
                  <h3 className="font-bold text-md text-gray-800 dark:text-white">Arsip Dokumen PDF Resmi</h3>
                  <p className="text-xs text-gray-450">Semua file PDF laporan hasil render tersimpan di folder <span className="font-mono font-bold text-indigo-600">PDF_LAPORAN</span> Google Drive.</p>
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
                  <span className="text-xs text-gray-400">Mensinkronisasikan arsip PDF...</span>
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
                  <p className="text-xs text-gray-500 px-12">Konfigurasikan form cetak di sebelah kiri dan klik tombol Render Cetak PDF untuk menerbitkan laporan berformat standar.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
