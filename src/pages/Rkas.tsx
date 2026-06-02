import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, Database, Upload, Plus, Trash2, 
  ExternalLink, RefreshCw, FileText, FileSpreadsheet, Play, Info,
  Sparkles, Check, Ban, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface DataRow {
  kode: string;
  rincian: string;
  pagu: string;
}

interface GeneratedDatabase {
  name: string;
  url: string;
  created: string;
  size: string;
}

interface ParsedRkasItem {
  kodeRekening: string;
  kodeKegiatan: string;
  uraian: string;
  pagu?: number;
}

export function cleanGoogleSheetsDateToCode(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  
  if (trimmed.includes(' - ')) {
    return trimmed.split(' - ').map(part => cleanSinglePart(part)).join(' - ');
  }
  return cleanSinglePart(trimmed);
}

const indonesianMonthMap: Record<string, number> = {
  jan: 1, januari: 1,
  feb: 2, februari: 2, peb: 2, pebruari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agt: 8, agust: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11, nop: 11, nopember: 11,
  des: 12, desember: 12, dec: 12, december: 12
};

function cleanSinglePart(partStr: string): string {
  const trimmed = partStr.trim();
  if (!trimmed) return '';

  const hasDayName = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu)\b/i.test(trimmed);
  const hasGmt = /\b(GMT|UTC|Waktu|Time|WIB|WITA|WIT)\b/i.test(trimmed);
  const isIso = /^\d{4}-\d{2}-\d{2}/i.test(trimmed);
  const hasMonthNames = /\b(jan|feb|mar|apr|mei|jun|jul|agt|aug|sep|okt|oct|nov|nop|des|dec|januari|februari|pebruari|maret|april|juni|juli|agustus|september|oktober|november|nopember|desember)\b/i.test(trimmed);
  const hasSlashDate = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(trimmed);
  const hasDashDate = /\b\d{1,2}-\d{1,2}-\d{2,4}\b/.test(trimmed);

  if (hasDayName || hasGmt || isIso || hasMonthNames || hasSlashDate || hasDashDate) {
    try {
      // 1. Try mapping Indonesian or English month explicitly
      const monthMatch = trimmed.match(/\b(jan|feb|mar|apr|mei|jun|jul|agt|aug|sep|okt|oct|nov|nop|des|dec|januari|februari|pebruari|maret|april|juni|juli|agustus|september|oktober|november|nopember|desember)\b/i);
      const dayMatch = trimmed.match(/\b(\d{1,2})\b/);
      const yearMatch = trimmed.match(/\b(\d{2,4})\b/);
      
      if (monthMatch && dayMatch) {
        const mStr = monthMatch[1].toLowerCase();
        const monthVal = indonesianMonthMap[mStr];
        if (monthVal) {
          const dayVal = parseInt(dayMatch[1], 10);
          let yearValStr = '';
          if (yearMatch) {
            const possibleValues = trimmed.match(/\b\d+\b/g) || [];
            const rawYear = possibleValues.find(v => v !== dayMatch[1] && (v.length === 2 || v.length === 4));
            if (rawYear) {
              yearValStr = rawYear.length === 4 ? rawYear.slice(-2) : rawYear;
            }
          }
          
          const pad2 = (val: number) => String(val).padStart(2, '0');
          if (yearValStr) {
            return `${pad2(dayVal)}.${pad2(monthVal)}.${yearValStr}`;
          }
          return `${pad2(dayVal)}.${pad2(monthVal)}`;
        }
      }

      // 2. Safe parse fallback
      let dateCleaned = trimmed.replace(/\s*\([^)]*\)\s*/g, '').trim();
      const d = new Date(dateCleaned);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = String(d.getFullYear()).slice(-2);
        const pad2 = (val: number) => String(val).padStart(2, '0');
        if (trimmed.match(/\d{4}/) || trimmed.length > 10) {
          return `${pad2(day)}.${pad2(month)}.${year}`;
        }
        return `${pad2(day)}.${pad2(month)}`;
      }
    } catch (e) {
      console.warn('Failed parsing date for code conversion in Rkas:', trimmed, e);
    }
  }
  
  return partStr;
}

export default function Rkas() {
  const { user } = useAuth();
  
  // Year & Database States
  const [databases, setDatabases] = useState<GeneratedDatabase[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });
  const [selectedDbUrl, setSelectedDbUrl] = useState<string>('');
  const [creatingDatabase, setCreatingDatabase] = useState(false);
  const [deletingDatabase, setDeletingDatabase] = useState(false);
  const [showDbDeleteConfirm, setShowDbDeleteConfirm] = useState(false);
  
  // RKAS data rows loaded from DB
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // PDF Upload & AI Parsing States
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedRkasItem[]>([]);
  const [showAiSuccessModal, setShowAiSuccessModal] = useState(false);

  const updatePreviewRowValue = (idx: number, key: keyof ParsedRkasItem, val: any) => {
    const nextArr = [...previewRows];
    nextArr[idx] = { ...nextArr[idx], [key]: val };
    setPreviewRows(nextArr);
  };

  // PDF Export Generation states (standard report)
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfGenStep, setPdfGenStep] = useState(0);

  // Database action modal state
  const [dbActionStatus, setDbActionStatus] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'processing' | 'success';
  } | null>(null);

  // New confirmation modal state
  const [showDbCreateConfirm, setShowDbCreateConfirm] = useState(false);

  const pdfSteps = [
    'Menghubungkan ke layanan Google App...',
    'Membuka spreadsheet transaksi utama...',
    'Membuat lembar cetak dokumen formal...',
    'Menambahkan tanda tangan digital kepala sekolah...',
    'Mengonversi berkas menjadi format PDF...',
    'Menyimpan PDF ke folder penyimpanan PDF_LAPORAN...'
  ];

  const invalidateRkasCache = (year = activeYear) => {
    if (!user?.sekolah) return;
    sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_databases`);
    if (year) {
      sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_rkas_${year}`);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  // Fetch list of databases from GDrive
  const fetchDatabases = async (silent = false, forceRefresh = false) => {
    if (!user?.sekolah) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_databases`;

    if (!forceRefresh && !silent) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setDatabases(parsed);
          const match = parsed.find((db: any) => db.name.includes(activeYear));
          if (match) {
            setSelectedDbUrl(match.url);
          } else {
            setSelectedDbUrl('');
          }
          silent = true; // Still load in background silently to keep updated
        } catch (e) {}
      }
    }

    if (!silent) setLoadingDatabases(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getGeneratedDatabases`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user?.sekolah })
      });
      const data = await response.json();
      if (data.success) {
        const dbs = data.data || [];
        setDatabases(dbs);
        sessionStorage.setItem(cacheKey, JSON.stringify(dbs));
        
        // Match active year to db url
        const match = dbs.find((db: any) => db.name.includes(activeYear));
        if (match) {
          setSelectedDbUrl(match.url);
        } else {
          setSelectedDbUrl('');
        }
      }
    } catch (err) {
      console.error('Error fetching databases:', err);
    } finally {
      if (!silent) setLoadingDatabases(false);
    }
  };

  // Fetch RKAS rows from Spreadsheet DB
  const fetchRkasData = async (year: string, forceRefresh = false) => {
    if (!user?.sekolah || !year || year.length !== 4) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_rkas_${year}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setRows(parsed);
          return;
        } catch (e) {}
      }
    }

    setLoadingData(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: year,
          tipe: 'RKAS'
        })
      });
      const data = await response.json();
      if (data.success && data.rows && data.rows.length > 0) {
        const cleanedRows = data.rows.map((row: any) => ({
          ...row,
          kode: cleanGoogleSheetsDateToCode(row.kode)
        }));
        setRows(cleanedRows);
        sessionStorage.setItem(cacheKey, JSON.stringify(cleanedRows));
      } else {
        // Clear or fallback
        setRows([]);
        sessionStorage.setItem(cacheKey, JSON.stringify([]));
      }
    } catch (err) {
      console.error('Error retrieving RKAS data:', err);
      toast.error('Gagal memuat rincian data dari Google Spreadsheet');
    } finally {
      setLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateRkasCache(activeYear);
    try {
      await fetchDatabases(true, true);
      await fetchRkasData(activeYear, true);
      toast.success('Data RKAS berhasil diperbarui!');
    } catch (err) {
      toast.error('Gagal memperbarui data RKAS');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.sekolah) {
      fetchDatabases();
    }
  }, [user]);

  useEffect(() => {
    if (activeYear && activeYear.length === 4) {
      fetchRkasData(activeYear);
      // Update db URL if exists
      const match = databases.find(db => db.name.includes(activeYear));
      if (match) {
        setSelectedDbUrl(match.url);
      } else {
        setSelectedDbUrl('');
      }
    }
  }, [activeYear, databases]);

  // Handle active year changes typed by the admin
  const handleYearChange = (val: string) => {
    const cleanVal = val.replace(/\D/g, '').substring(0, 4); // Only digits, max 4 chars
    setActiveYear(cleanVal);
    localStorage.setItem('siap_bos_active_year', cleanVal);
  };

  // On-demand database creation inside Google Drive school folder
  const handleCreateDatabase = async () => {
    if (!user?.sekolah || !activeYear) return;
    if (activeYear.length !== 4) {
      toast.warning('Tahun anggaran harus berupa 4 digit angka yang valid!');
      return;
    }

    setCreatingDatabase(true);
    setDbActionStatus({
      show: true,
      title: 'Mohon Menunggu',
      message: `Sedang Membuat Database SIAP_BOS_${activeYear} di Drive Server`,
      type: 'processing'
    });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=generateDatabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear
        })
      });
      const data = await response.json();
      if (data.success) {
        setDbActionStatus({
          show: true,
          title: 'Sukses',
          message: 'Database berhasil di buat',
          type: 'success'
        });
        invalidateRkasCache(activeYear);
        await fetchDatabases(true, true);
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Gagal meng-create database.');
      }
    } catch (err) {
      setDbActionStatus(null);
      console.error(err);
      toast.error('Hubungan terputus sewaktu mendeploy database');
    } finally {
      setCreatingDatabase(false);
    }
  };

  // Delete database completely from Google Drive
  const handleDeleteDatabase = async () => {
    if (!user?.sekolah || !activeYear) return;
    setDeletingDatabase(true);
    setDbActionStatus({
      show: true,
      title: 'Mohon Menunggu',
      message: `Sedang Menghapus Database SIAP_BOS_${activeYear} dari Drive Server...`,
      type: 'processing'
    });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=deleteDatabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear
        })
      });
      const data = await response.json();
      if (data.success) {
        setDbActionStatus({
          show: true,
          title: 'Sukses',
          message: 'Database berhasil dihapus',
          type: 'success'
        });
        
        setShowDbDeleteConfirm(false);
        setRows([]); // Clear current view rows
        setSelectedDbUrl(''); // Reset active sheet link
        invalidateRkasCache(activeYear);
        await fetchDatabases(true, true); // Pull fresh list of databases
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Gagal menghapus database.');
      }
    } catch (err) {
      setDbActionStatus(null);
      console.error(err);
      toast.error('Gagal menghubungi server Google Apps Script.');
    } finally {
      setDeletingDatabase(false);
    }
  };

  // Grid manual row modifiers
  const handleAddRow = () => {
    setRows([...rows, { kode: '', rincian: '', pagu: '0' }]);
  };

  const handleRemoveRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRowValue = (idx: number, key: keyof DataRow, val: string) => {
    const nextArr = [...rows];
    nextArr[idx] = { ...nextArr[idx], [key]: val };
    setRows(nextArr);
  };

  // Normal Manual Save to Spreadsheet
  const handleSaveData = async () => {
    if (!user?.sekolah || !activeYear) return;
    if (rows.some(row => !row.kode.trim() || !row.rincian.trim())) {
      toast.warning('Silakan isi kolom Kode dan Rincian yang masih kosong terlebih dahulu!');
      return;
    }

    setSavingData(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: 'RKAS',
          rows: rows
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateRkasCache(activeYear);
        toast.success(`Data RKAS tahun ${activeYear} berhasil disinkronisasikan ke Google Spreadsheet!`);
      } else {
        toast.error(data.message || 'Gagal menyimpan data RKAS');
      }
    } catch (err) {
      console.error(err);
      toast.error('Kehilangan koneksi dengan API penulisan Spreadsheet');
    } finally {
      setSavingData(false);
    }
  };

  // Delete RKAS completely from database
  const handleDeleteRkas = async () => {
    if (!user?.sekolah || !activeYear) return;

    setShowDeleteConfirm(false);
    setSavingData(true);
    setDbActionStatus({
      show: true,
      title: 'MENGHAPUS DATA RKAS',
      message: 'MOHON TUNGGU SEBENTAR',
      type: 'processing'
    });

    try {
      // Small artificial delay for beautiful smooth animation
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: 'RKAS',
          rows: [] // Empty array deletes all entries
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateRkasCache(activeYear);
        setDbActionStatus({
          show: true,
          title: 'SUKSES',
          message: 'RKAS TAHUNAN ANDA BERHASIL DI BERSIHKAN DARI DATABASE',
          type: 'success'
        });
        setRows([]);
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Gagal menghapus RKAS dari database');
      }
    } catch (err) {
      setDbActionStatus(null);
      console.error(err);
      toast.error('Masalah jaringan menggagalkan penghapusan RKAS');
    } finally {
      setSavingData(false);
    }
  };

  // Convert uploaded PDF to base64 for server delivery
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // File Upload Handlers (for AI parser drag and drop)
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedPdf(file);
    } else {
      toast.warning('Harap pilih dokumen dengan format PDF (*.pdf)!');
    }
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setSelectedPdf(files[0]);
    } else {
      toast.warning('Tarik berkas PDF valid untuk diproses!');
    }
  };

  // Running the AI RKAS PDF parser
  const handleAnalyzeWithGemini = async () => {
    if (!selectedPdf) {
      toast.warning('Silakan seret atau pilih file PDF RKAS Tahunan Anda terlebih dahulu!');
      return;
    }
    if (!activeYear || activeYear.length !== 4) {
      toast.warning('Tahun anggaran harus diisi dengan benar sebelum memproses berkas!');
      return;
    }

    setIsGenerating(true);
    // Removed toast loading, using local overlay instead
    try {
      const b64 = await fileToBase64(selectedPdf);
      const res = await fetch('/api/parse-rkas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: b64,
          filename: selectedPdf.name
        })
      });
      const result = await res.json();
      if (result.success && result.data && result.data.items) {
        setPreviewRows(result.data.items);
        setShowAiSuccessModal(true);
      } else {
        toast.error(result.message || 'Mendeteksi sirkuit error di Gemini API. Gagal parsing PDF.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Koneksi error: ${err.message || 'Gagal berkonsultasi dengan server AI'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Saving the AI preview data directly into GDrive Spreadsheet
  const handleSavePreview = async () => {
    if (!user?.sekolah || !activeYear) return;
    setSavingData(true);
    setDbActionStatus({
      show: true,
      title: 'MENYIMPAN KE DATABASE',
      message: 'MOHON TUNGGU SEBENTAR',
      type: 'processing'
    });

    // Convert preview schema rows map to DataRow
    const targetRows = previewRows.map(p => ({
      kode: p.kodeRekening !== '-' && p.kodeRekening !== '' ? `${p.kodeKegiatan} - ${p.kodeRekening}` : p.kodeKegiatan,
      rincian: p.uraian,
      pagu: '0'
    }));

    try {
      // Small artificial delay for beautiful smooth animation
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: 'RKAS',
          rows: targetRows
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateRkasCache(activeYear);
        setDbActionStatus({
          show: true,
          title: 'SUKSES',
          message: 'RKAS TAHUNAN ANDA BERHASIL DI SIMPAN KE DATABASE',
          type: 'success'
        });
        setRows(targetRows);
        setIsPreviewing(false); // Close preview
        setSelectedPdf(null); // Clear selected PDF file
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Penyimpanan RKAS ke spreadsheet terhambat.');
      }
    } catch (err) {
      setDbActionStatus(null);
      console.error(err);
      toast.error('Tidak sanggup membilas data ke GDrive Spreadsheet saat ini.');
    } finally {
      setSavingData(false);
    }
  };

  const handleCancelPreview = () => {
    setIsPreviewing(false);
    setPreviewRows([]);
    toast.message('Proses tinjauan hasil generate AI dibatalkan.');
  };

  // Render & export formal report PDF via GAS Apps Script
  const handlePrintPdf = async () => {
    if (!user?.sekolah || !activeYear) return;
    setGeneratingPdf(true);
    setPdfGenStep(0);

    const interval = setInterval(() => {
      setPdfGenStep(prev => {
        if (prev < pdfSteps.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 1500);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=generatePDFDoc`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: 'RKAS',
          rows: rows
        })
      });
      const data = await response.json();
      clearInterval(interval);

      if (data.success) {
        toast.success(`Dokumen PDF RKAS ${activeYear} sukses diterbitkan di folder PDF_LAPORAN Google Drive!`);
        if (data.fileUrl) {
          window.open(data.fileUrl, '_blank');
        }
      } else {
        toast.error(data.message || 'Sistem Apps Script gagal me-render format PDF.');
      }
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      toast.error('Mesin cetak Google Apps Script tidak merespon');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const totalAnggaran = rows.reduce((sum, row) => sum + (parseFloat(row.pagu) || 0), 0);
  const totalPreviewAnggaran = previewRows.reduce((sum, p) => sum + (p.pagu || 0), 0);

  // Check if active typed year actually has a database
  const dbMatch = databases.find(db => db.name.includes(activeYear));
  const databaseExists = !!dbMatch;

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-4 px-2">
      
      {/* Dynamic Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Layers size={22} />
            </span>
            <h2 id="rkas-title" className="text-2xl font-black text-gray-905 dark:text-white">RKAS</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">Rencana Kegiatan dan Anggaran Sekolah ({user?.sekolah})</p>
        </div>

        {/* Global Year Administrator Panel */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl text-xs">
            <Database size={14} className="text-indigo-500" />
            <span className="font-bold text-gray-700 dark:text-gray-300">Tahun Anggaran:</span>
            
            <input
              type="text"
              value={activeYear}
              onChange={(e) => handleYearChange(e.target.value)}
              placeholder="Ketik tahun"
              maxLength={4}
              className="bg-transparent text-indigo-600 dark:text-indigo-400 font-black focus:outline-none w-14 text-center border-b border-gray-200 dark:border-gray-700 focus:border-indigo-500"
            />
            
            {loadingDatabases && (
              <RefreshCw size={12} className="animate-spin text-gray-400" />
            )}
          </div>

          <button
            id="refresh-rkas-data-button"
            onClick={handleRefresh}
            disabled={refreshing || loadingDatabases || loadingData}
            className={`flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-705 dark:text-gray-300 font-bold text-xs rounded-xl shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-700 ${
              refreshing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Saran Sinkronisasi Ulang Database & Tabel RKAS secara Real-time"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Memuat...' : 'Perbarui Data'}</span>
          </button>

          {/* Database Creation or Connection Badges */}
          {activeYear.length === 4 && (
            <>
              {databaseExists ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] rounded-xl border border-emerald-200">
                      <Check size={12} />
                      <span>Database Aktif</span>
                    </div>
                    <button
                      id="delete-db-action-button"
                      onClick={() => setShowDbDeleteConfirm(true)}
                      className="px-2 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-bold text-[11px] rounded-xl flex items-center gap-1 border border-red-200 transition shrink-0"
                      title="Hapus database tahun anggaran ini dari Drive"
                    >
                      <Trash2 size={12} />
                      <span>Hapus Database</span>
                    </button>
                  </div>
              ) : (
                <button
                  id="create-db-button"
                  onClick={() => setShowDbCreateConfirm(true)}
                  disabled={creatingDatabase}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Database size={12} className="animate-pulse" />
                  <span>{creatingDatabase ? 'Menginstal...' : `Buat Database ${activeYear}`}</span>
                </button>
              )}
            </>
          )}

          {selectedDbUrl && (
            <a 
              href={selectedDbUrl} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition"
            >
              <FileSpreadsheet size={13} />
              <span>Detail Sheet</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {isPreviewing ? (
        /* ======================== PREVIEW MODE (AI RESULT PREVIEW) ======================== */
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="p-5 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-900 rounded-3xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20 shrink-0">
                <Sparkles size={20} className="animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider">Tinjauan Draft Hasil AI (RKAS {activeYear})</h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium leading-relaxed">
                  Hasil transkripsi dari <span className="font-serif italic font-bold">"{selectedPdf?.name}"</span>. 
                  Anda wajib memverifikasi rincian program sebelum menuliskannya di spreadsheet.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 w-full lg:w-auto shrink-0">
              <button
                id="preview-cancel-button"
                onClick={handleCancelPreview}
                className="flex-1 lg:flex-none px-6 py-3 border-2 border-red-200 hover:border-red-400 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 hover:scale-[1.02] active:scale-[0.98] rounded-2xl font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Ban size={15} />
                <span>Batal</span>
              </button>
              
              <button
                id="preview-save-button"
                onClick={handleSavePreview}
                disabled={savingData}
                className="flex-1 lg:flex-none px-7 py-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white rounded-2xl font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100"
              >
                {savingData ? <RefreshCw className="animate-spin" size={15} /> : <Check size={15} />}
                <span>Simpan Ke Database</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="overflow-x-auto border border-gray-100 dark:border-gray-755 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f0f7fc] dark:bg-slate-900 border-b border-blue-100 dark:border-slate-800 text-[11px] font-extrabold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    <th className="p-3.5 w-48 font-bold">KODE REKENING</th>
                    <th className="p-3.5 w-48 font-bold">KODE KEGIATAN</th>
                    <th className="p-3.5 font-bold">URAIAN KEGIATAN</th>
                    <th className="p-3.5 w-16 text-center font-bold">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                  {previewRows.map((pRow, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-xs">
                      <td className="p-3">
                        <input
                          type="text"
                          value={pRow.kodeRekening && pRow.kodeRekening !== '-' ? pRow.kodeRekening : ''}
                          onChange={(e) => updatePreviewRowValue(idx, 'kodeRekening', e.target.value)}
                          placeholder="-"
                          className="w-full px-2 py-2 bg-transparent text-slate-700 dark:text-slate-300 font-mono border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded focus:bg-white dark:focus:bg-gray-800 focus:shadow-xs transition text-xs font-normal"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={pRow.kodeKegiatan}
                          onChange={(e) => updatePreviewRowValue(idx, 'kodeKegiatan', e.target.value)}
                          placeholder="e.g. 03."
                          className="w-full px-2 py-2 bg-transparent text-blue-600 dark:text-blue-400 font-mono font-bold border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded focus:bg-white dark:focus:bg-gray-800 focus:shadow-xs transition text-xs"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={pRow.uraian}
                          onChange={(e) => updatePreviewRowValue(idx, 'uraian', e.target.value)}
                          placeholder="Ketik rincian program / sub-kegiatan..."
                          className="w-full px-2 py-2 bg-transparent text-gray-800 dark:text-gray-200 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded focus:bg-white dark:focus:bg-gray-800 focus:shadow-xs transition text-xs font-medium"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setPreviewRows(previewRows.filter((_, i) => i !== idx))}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                          title="Hapus Baris"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-gray-400">
                        Tidak ada baris yang memenuhi spesifikasi parser Level B. BELANJA.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        /* ======================== STANDARD RUNTIME MODE ======================== */
        <div className="space-y-6 w-full">
          
          {/* Visual Steps if Generating PDF Laporan */}
          <AnimatePresence>
            {generatingPdf && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-indigo-950 border border-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full blur-xl"></div>
                <h4 className="text-sm font-bold flex items-center gap-2 text-cyan-300">
                  <RefreshCw className="animate-spin text-cyan-400" size={16} />
                  APLIKASI SEDANG MEMPROSES RENDER PDF RKAS...
                </h4>
                <div className="relative w-full h-1.5 bg-indigo-900 rounded-full overflow-hidden my-3">
                  <motion.div 
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-teal-300 to-cyan-300"
                    animate={{ width: `${((pdfGenStep + 1) / pdfSteps.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-indigo-200 mt-1 block">{pdfSteps[pdfGenStep]}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compact Top-Level AI Generator Panel */}
          <div className="bg-gradient-to-r from-blue-50/50 via-indigo-50/40 to-blue-50/10 dark:from-slate-900/50 dark:via-indigo-950/20 dark:to-slate-900/10 border border-blue-100/80 dark:border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                <Sparkles size={16} className={isGenerating ? "animate-spin" : "animate-pulse"} />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs text-gray-850 dark:text-gray-100">GENERATE RKAS TAHUNAN</h4>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
              {selectedPdf ? (
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center gap-2 border border-indigo-150 dark:border-indigo-900 text-xs">
                  <FileText size={14} className="text-indigo-500 shrink-0" />
                  <span className="font-bold text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{selectedPdf.name}</span>
                  <button 
                    onClick={() => setSelectedPdf(null)} 
                    className="text-gray-400 hover:text-red-500 text-[10px] font-extrabold ml-1 uppercase"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <label className="border-2 border-indigo-200 dark:border-indigo-800 py-3 px-5 rounded-2xl text-sm font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-400 cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-sm hover:shadow-indigo-500/10">
                  <Upload size={16} className="text-indigo-500" />
                  <span>Pilih Berkas PDF RKAS</span>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handlePdfFileChange} 
                    className="hidden" 
                  />
                </label>
              )}

              {selectedPdf && (
                <button
                  id="trigger-ai-parse"
                  onClick={handleAnalyzeWithGemini}
                  disabled={isGenerating || activeYear.length !== 4}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white rounded-2xl font-bold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100 animate-pulse"
                >
                  {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  <span>{isGenerating ? 'Menganalisis...' : 'Mulai Jalankan AI'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-755 pb-4">
              <div>
                <h3 className="font-bold text-md text-gray-850 dark:text-white">Daftar Program & Kegiatan RKAS ({rows.length})</h3>
                <p className="text-[11px] text-gray-400">Rencana anggaran RKAS Tahun {activeYear} yang tersimpan di Drive pribadi sekolah Anda.</p>
              </div>
              
              <div className="flex gap-2 items-center">
                {rows.length > 0 && (
                  <button
                    id="delete-rkas-button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 border-2 border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 hover:scale-[1.02] active:scale-[0.98] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all duration-300 shadow-sm cursor-pointer"
                  >
                    <Trash2 size={14} className="text-red-500" />
                    <span>Hapus RKAS</span>
                  </button>
                )}
              </div>
            </div>

            {loadingData ? (
              <div className="py-16 text-center space-y-2">
                <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={24} />
                <p className="text-xs text-gray-400">Mengambil data alokasi dari spreadsheet GDrive...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Ledger Spreadsheet list */}
                <div className="overflow-x-auto border border-gray-100 dark:border-gray-755 rounded-xl bg-gray-50/50 dark:bg-gray-900/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f0f7fc] dark:bg-slate-900 border-b border-blue-100 dark:border-slate-800 text-[11px] font-extrabold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                        <th className="p-3.5 w-48 font-bold">KODE REKENING</th>
                        <th className="p-3.5 w-48 font-bold">KODE KEGIATAN</th>
                        <th className="p-3.5 font-bold">URAIAN KEGIATAN</th>
                        <th className="p-3.5 w-16 text-center font-bold">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                      {rows.map((row, idx) => {
                        const parts = row.kode.split(' - ');
                        const valKegiatan = parts[0] || '';
                        const valRekening = parts[1] || '';

                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 text-xs">
                            <td className="p-3">
                              <input
                                type="text"
                                value={valRekening}
                                onChange={(e) => {
                                  const newRek = e.target.value;
                                  const nextKode = newRek ? `${valKegiatan} - ${newRek}` : valKegiatan;
                                  updateRowValue(idx, 'kode', nextKode);
                                }}
                                placeholder="-"
                                className="w-full px-2 py-2 bg-transparent text-slate-700 dark:text-slate-300 font-mono border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded focus:bg-white dark:focus:bg-gray-800 focus:shadow-xs transition text-xs font-normal"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={valKegiatan}
                                onChange={(e) => {
                                  const newKeg = e.target.value;
                                  const nextKode = valRekening ? `${newKeg} - ${valRekening}` : newKeg;
                                  updateRowValue(idx, 'kode', nextKode);
                                }}
                                placeholder="e.g. 03."
                                className="w-full px-2 py-2 bg-transparent text-blue-600 dark:text-blue-400 font-mono font-bold border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded focus:bg-white dark:focus:bg-gray-800 focus:shadow-xs transition text-xs"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={row.rincian}
                                onChange={(e) => updateRowValue(idx, 'rincian', e.target.value)}
                                placeholder="Ketik rincian program / sub-kegiatan..."
                                className="w-full px-2 py-2 bg-transparent text-gray-800 dark:text-gray-200 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded focus:bg-white dark:focus:bg-gray-800 focus:shadow-xs transition text-xs font-medium"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleRemoveRow(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                                title="Hapus Baris"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-gray-400">
                            <p className="font-bold">Dokumen RKAS Masih Kosong</p>
                            <p className="text-[11px] mt-1">Gunakan panel di atas untuk import berkas PDF dengan AI atau ketik rincian secara mandiri.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Summary Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-gray-100 dark:border-gray-755 pt-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl flex items-center gap-3">
                    <span className="text-xs font-black text-gray-505 uppercase tracking-widest text-slate-500">TOTAL KEGIATAN:</span>
                    <span className="font-mono text-sm font-black text-indigo-650 dark:text-indigo-400">
                      {rows.length} Item Program
                    </span>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      id="save-to-db-button"
                      onClick={handleSaveData}
                      disabled={savingData || rows.length === 0}
                      className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {savingData ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                      <span>Simpan Ke Database</span>
                    </button>


                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isGenerating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-7 text-center space-y-4"
            >
              <div className="flex justify-center relative">
                <div className="absolute inset-0 rounded-full bg-indigo-100/30 dark:bg-indigo-950/10 animate-ping w-14 h-14 mx-auto"></div>
                <RefreshCw className="animate-spin text-indigo-600 dark:text-indigo-400 relative z-10" size={36} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase font-mono">
                  AI SEDANG MEMPROSES RKAS TAHUNAN ANDA
                </p>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                  MOHON TUNGGU SEBENTAR.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Success Confirmation Modal */}
      <AnimatePresence>
        {showAiSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner">
                <Sparkles size={30} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase font-sans">
                  SUKSES ANALISA
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                  RKAS TAHUNAN ANDA BERHASIL DI ANALISA OLEH AI
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAiSuccessModal(false);
                  setIsPreviewing(true);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer transition flex items-center justify-center gap-2 hover:scale-[1.02] duration-300"
              >
                <Sparkles size={14} />
                <span>LIHAT HASIL ANALISA</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Database Action Modal (Processing/Success) */}
      <AnimatePresence>
        {dbActionStatus?.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              {dbActionStatus.type === 'processing' ? (
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
                      {dbActionStatus.title}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                      {dbActionStatus.message}
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
                      {dbActionStatus.title}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-bold uppercase tracking-wide">
                      {dbActionStatus.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDbActionStatus(null)}
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

      {/* Create Database Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              <div className="mx-auto w-14 h-14 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center shadow-inner">
                <AlertCircle size={28} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase font-sans">
                  Hapus RKAS {activeYear}
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-bold uppercase tracking-wide">
                  Apakah Anda yakin ingin menghapus seluruh rencana kegiatan RKAS tahun anggaran {activeYear}?
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-normal font-medium">
                  Tindakan ini akan mengosongkan seluruh baris anggaran rincian dalam database spreadsheet Anda.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-1/2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteRkas();
                  }}
                  className="w-1/2 py-2.5 bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-650/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Database Confirmation Modal */}
      <AnimatePresence>
        {showDbCreateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              <div className="mx-auto w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shadow-inner">
                <Database size={28} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase font-sans">
                  Generate Database {activeYear}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  Apakah Anda yakin ingin membuat database keuangan baru untuk tahun anggaran <strong>{activeYear}</strong>? Sistem akan menyiapkan sheet baru di Drive Anda.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDbCreateConfirm(false)}
                  className="w-1/2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDbCreateConfirm(false);
                    handleCreateDatabase();
                  }}
                  className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Database size={13} />
                  <span>Ya, Buat</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Database Confirmation Modal */}
      <AnimatePresence>
        {showDbDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              <div className="mx-auto w-14 h-14 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center shadow-inner">
                <AlertCircle size={28} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase font-sans">
                  Hapus Database {activeYear}
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-bold">
                  PERINGATAN: Tindakan ini permanen. Seluruh data RKAS untuk tahun anggaran <strong>{activeYear}</strong> akan terhapus dari Drive Server!
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDbDeleteConfirm(false)}
                  className="w-1/2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDbDeleteConfirm(false);
                    handleDeleteDatabase();
                  }}
                  className="w-1/2 py-2.5 bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-650/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Ya, Hapus Permanen</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
