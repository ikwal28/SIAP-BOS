import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, Database, Upload, Plus, Trash2, 
  ExternalLink, RefreshCw, FileText, FileSpreadsheet, Play, Info,
  Sparkles, Check, Ban, AlertCircle, Calendar, Clock, Sliders, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || '/api/sys-proxy';

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
  volume?: string;
  satuan?: string;
  tarifHarga?: string;
  jumlah?: string;
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

  // Prevent account and kegiatan codes from ever being processed as dates
  if (trimmed.startsWith('5.') || (trimmed.match(/\./g) || []).length > 1) {
    return partStr;
  }

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
  
  // Tab & Sub-Menu States
  const [activeTab, setActiveTab] = useState<'tahunan' | 'tahapan'>('tahunan');

  // Phased RKAS States & Types
  interface PhasedItem {
    id: string;
    kodeRekening: string;
    kodeKegiatan: string;
    uraian: string;
    volume?: string;
    satuan?: string;
    tarifHarga?: string;
    jumlah?: string;
    tahap: '1' | '2' | 'both';
    porsiTahap1: number; // percentage (0-100)
    porsiTahap2: number; // percentage (0-100)
  }

  const [phasedItems, setPhasedItems] = useState<PhasedItem[]>([]);
  const [selectedTahapFilter, setSelectedTahapFilter] = useState<'semua' | 'tahap1' | 'tahap2'>('semua');
  
  // Phased AI Formulation States
  const [phasedAiPrompt, setPhasedAiPrompt] = useState<string>('');
  const [isFormulatingPhased, setIsFormulatingPhased] = useState(false);
  const [formulationStep, setFormulationStep] = useState(0);

  // PDF Upload & AI Parsing States for Phased Tab
  const [selectedPdfPhased, setSelectedPdfPhased] = useState<File | null>(null);
  const [isGeneratingPhased, setIsGeneratingPhased] = useState(false);
  const [isPreviewingPhased, setIsPreviewingPhased] = useState(false);
  const [previewRowsPhased, setPreviewRowsPhased] = useState<ParsedRkasItem[]>([]);
  const [savingPhased, setSavingPhased] = useState(false);
  const [showDeleteConfirmPhased, setShowDeleteConfirmPhased] = useState(false);

  const formulationSteps = [
    'Menganalisis struktur RKAS Tahunan...',
    'Mengidentifikasi kategori pembagian kegiatan belanja...',
    'Menerapkan instruksi khusus AI...',
    'Menghitung proporsi penyerapan Tahap I (Januari - Juni)...',
    'Menghitung proporsi penyerapan Tahap II (Juli - Desember)...',
    'Memvalidasi keseimbangan anggaran operasional...',
    'Sinkronisasi hasil formulasi ke tabel draf...'
  ];

  const handleFormulatePhasedAi = async () => {
    if (phasedItems.length === 0) {
      toast.error('Gunakan RKAS Tahunan terlebih dahulu sebelum melakukan pembagian Tahapan.');
      return;
    }
    
    setIsFormulatingPhased(true);
    setFormulationStep(0);
    
    // Animate through the visual formulation steps while the API is loading
    const progressTimer = setInterval(() => {
      setFormulationStep((prev) => {
        if (prev < formulationSteps.length - 2) {
          return prev + 1;
        }
        return prev;
      });
    }, 600);
    
    try {
      const response = await fetch('/api/formulate-phased', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: phasedItems.map(item => ({
            id: item.id,
            kodeRekening: item.kodeRekening,
            kodeKegiatan: item.kodeKegiatan,
            uraian: item.uraian,
            tahap: item.tahap,
            porsiTahap1: item.porsiTahap1,
            porsiTahap2: item.porsiTahap2,
          })),
          prompt: phasedAiPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Gagal menghubungi Formulator AI server.');
      }

      const result = await response.json();
      clearInterval(progressTimer);

      if (result.success && result.data && Array.isArray(result.data.items)) {
        // Complete the final visual steps
        setFormulationStep(formulationSteps.length - 1);
        await new Promise((resolve) => setTimeout(resolve, 600));

        const matchMap = new Map<string, any>(result.data.items.map((i: any) => [i.id as string, i]));
        
        const updated = phasedItems.map((item) => {
          const match = matchMap.get(item.id);
          if (match) {
            // Validate and keep within bounds
            const validTahap = ('both' === match.tahap || '1' === match.tahap || '2' === match.tahap) ? match.tahap : item.tahap;
            const p1 = typeof match.porsiTahap1 === 'number' ? Math.max(0, Math.min(100, Math.round(match.porsiTahap1))) : item.porsiTahap1;
            const p2 = typeof match.porsiTahap2 === 'number' ? Math.max(0, Math.min(100, Math.round(match.porsiTahap2))) : item.porsiTahap2;

            return {
              ...item,
              tahap: validTahap as '1' | '2' | 'both',
              porsiTahap1: p1,
              porsiTahap2: p2,
            };
          }
          return item;
        });

        setPhasedItems(updated);
        toast.success('Formulator AI berhasil memetakan rincian Rincian Item RKAS!');
      } else {
        throw new Error(result.message || 'Data hasil pemisah AI tidak valid.');
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error('Phased AI error:', err);
      toast.error(err.message || 'Terjadi kesalahan saat memformulasikan data.');
    } finally {
      setIsFormulatingPhased(false);
    }
  };

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
  const [loadingPhasedData, setLoadingPhasedData] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // PDF Upload & AI Parsing States
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedRkasItem[]>([]);
  const [showAiSuccessModal, setShowAiSuccessModal] = useState(false);
  const [showInfoNotice, setShowInfoNotice] = useState(true);

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

  useEffect(() => {
    // phasedItems should start empty and only be populated via AI generation.
    // if (rows.length > 0) {
    //   const items: PhasedItem[] = rows.map((row, idx) => {
    //     // ... logic ...
    //   });
    //   setPhasedItems(items);
    // } else {
    //   setPhasedItems([]);
    // }
  }, [rows]);

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
      sessionStorage.removeItem(`RKAS_PHASED_${user.sekolah}_${year}`);
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
          setLoadingDatabases(false); // Make sure it stops loading immediately if cached
        } catch (e) {}
      }
    }

    if (!silent) setLoadingDatabases(true);
    try {
      const response = await fetch(`${API_URL}?action=getGeneratedDatabases`, {
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
      const response = await fetch(`${API_URL}?action=getImportedData`, {
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

  const fetchPhasedRkasData = async (year: string, forceRefresh = false) => {
    if (!user?.sekolah || !year || year.length !== 4) return;
    const cacheKey = `RKAS_PHASED_${user.sekolah}_${year}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setPhasedItems(parsed);
            return;
          }
        } catch (e) {}
      }
    }

    setLoadingPhasedData(true);
    try {
      const response = await fetch(`${API_URL}?action=getImportedData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: year,
          tipe: 'RKAS_PHASED'
        })
      });
      const data = await response.json();
      if (data.success && data.rows && data.rows.length > 0) {
        setPhasedItems(data.rows);
        sessionStorage.setItem(cacheKey, JSON.stringify(data.rows));
      } else {
        setPhasedItems([]);
        sessionStorage.removeItem(cacheKey);
      }
    } catch (err) {
      console.error('Error retrieving RKAS Phased data:', err);
    } finally {
      setLoadingPhasedData(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateRkasCache(activeYear);
    try {
      await fetchDatabases(true, true);
      await fetchRkasData(activeYear, true);
      await fetchPhasedRkasData(activeYear, true);
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
      fetchPhasedRkasData(activeYear);
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
      const response = await fetch(`${API_URL}?action=generateDatabase`, {
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
      const response = await fetch(`${API_URL}?action=deleteDatabase`, {
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
      const response = await fetch(`${API_URL}?action=importData`, {
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

  const handleDeleteRkasPhased = async () => {
    if (!user?.sekolah || !activeYear) return;

    setShowDeleteConfirmPhased(false);
    setSavingPhased(true);

    try {
      const response = await fetch(`${API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: 'RKAS_PHASED',
          rows: []
        })
      });
      const data = await response.json();
      if (data.success) {
        setPhasedItems([]);
        sessionStorage.removeItem(`RKAS_PHASED_${user.sekolah}_${activeYear}`);
        const cacheKey = `siap_bos_cache_${user.sekolah}_rkas_phased_${activeYear}`;
        sessionStorage.removeItem(cacheKey);
        toast.success('Daftar item rincian berhasil dihapus');
      } else {
        toast.error(data.message || 'Gagal menghapus data Rincian Item RKAS');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Terjadi kesalahan koneksi saat menghapus');
    } finally {
      setSavingPhased(false);
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

      const response = await fetch(`${API_URL}?action=importData`, {
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

  // Client-side PDF.js-based RKAS parser running entirely locally in the browser
  const parseRkasPdfClient = async (file: File): Promise<ParsedRkasItem[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      throw new Error("Pustaka PDF.js pendukung offline belum siap. Tunggu sesaat dan coba lagi.");
    }
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    
    // Load text content from all pages in parallel
    const pagePromises = [];
    for (let i = 1; i <= totalPages; i++) {
      pagePromises.push(
        pdf.getPage(i).then(async (page) => {
          const viewport = page.getViewport({ scale: 1 });
          const textContent = await page.getTextContent();
          return { viewport, items: textContent.items as any[] };
        })
      );
    }
    
    const pagesData = await Promise.all(pagePromises);
    const parsedItems: ParsedRkasItem[] = [];
    
    let lastKodeKegiatan = "-";
    
    for (const pageData of pagesData) {
      const { viewport, items } = pageData;
      const pageWidth = viewport.width;
      
      // Group text items by their vertical Y coordinate with a tolerance offset of 10px to align columns cleanly
      const linesMap = new Map<number, any[]>();
      items.forEach((item) => {
        const y = Math.round(item.transform[5]);
        let found = false;
        for (const [lineY, lineItems] of linesMap.entries()) {
          if (Math.abs(y - lineY) < 10) {
            lineItems.push(item);
            found = true;
            break;
          }
        }
        if (!found) linesMap.set(y, [item]);
      });
      
      const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
      
      for (const y of sortedY) {
        const lineItems = linesMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
        
        // Merge adjacent horizontal blocks (reconstructing tabular tokens)
        const tokens: { text: string; minX: number; maxX: number }[] = [];
        let currentText = "";
        let currentMinX = -1;
        let lastMaxX = -1;
        
        lineItems.forEach(item => {
          const x = item.transform[4];
          const width = item.width || (item.str.length * 5);
          const text = item.str.trim();
          
          if (!text) return;
          
          if (lastMaxX !== -1 && (x - lastMaxX) > 8) {
            tokens.push({
              text: currentText.trim(),
              minX: currentMinX,
              maxX: lastMaxX
            });
            currentText = text;
            currentMinX = x;
          } else {
            if (currentText === "") currentMinX = x;
            currentText = currentText ? currentText + " " + text : text;
          }
          lastMaxX = x + width;
        });
        
        if (currentText) {
          tokens.push({
            text: currentText.trim(),
            minX: currentMinX,
            maxX: lastMaxX
          });
        }
        
        if (tokens.length === 0) continue;
        
        const fullLineText = tokens.map(t => t.text).join(' ');
        const upperLine = fullLineText.toUpperCase();
        
        // Skip document headers, titles or school details
        if (
          upperLine.includes("LAMPIRAN") ||
          upperLine.includes("BOS REGULER") ||
          /TAHUN ANGGARAN|HALAMAN \d+|SEKOLAH|NPSN|PROVINSI|KABUPATEN|KECAMATAN/i.test(upperLine) ||
          upperLine.includes("RENCANA KEGIATAN") ||
          upperLine.includes("URAIAN KEGIATAN") ||
          upperLine.includes("KODE REKENING") ||
          upperLine.includes("PAGU ANGGARAN") ||
          upperLine.includes("KODE KEGIATAN")
        ) {
          continue;
        }
        
        // Skip table footer / summary rows
        if (/JUMLAH|TOTAL|SUB TOTAL|PINDAHAN|BENDAHARA|KEPALA SEKOLAH/i.test(upperLine)) {
          continue;
        }
        
        let detectedRekening = "";
        let detectedKegiatan = "";
        
        // 1. Identify Kode Rekening (e.g., 5.1.02.01.01.0026) using a robust pattern
        const rekMatch = fullLineText.match(/\b5\.\d+(\.\d+){2,}\b/);
        if (rekMatch) {
          detectedRekening = rekMatch[0];
        }
        
        // Create a temporary string with the Kode Rekening removed to avoid false positive matches for Kode Kegiatan
        let tempText = fullLineText;
        if (detectedRekening) {
          tempText = tempText.replace(detectedRekening, "");
        }
        
        // 2. Identify Kode Kegiatan using hierarchical patterns (from highly specific 4-segment / 3-segment to simple standards)
        // This ensures segment lengths are restricted to 1 or 2 digits to immune it against matching Indonesian thousands/millions currencies.
        const pattern3 = /\b\d{1,2}\.\d{1,2}\.\d{1,2}(\.\d{1,2})?\.?\b/;
        const pattern2 = /\b\d{1,2}\.\d{1,2}\.?\b/;
        const pattern1 = /\b0\d\.?\b/;
        
        const match3 = tempText.match(pattern3);
        const match2 = tempText.match(pattern2);
        const match1 = tempText.match(pattern1);
        
        if (match3) {
          detectedKegiatan = match3[0];
        } else if (match2) {
          detectedKegiatan = match2[0];
        } else if (match1) {
          detectedKegiatan = match1[0];
        }
        
        // Parent context inheritance/backfilling
        if (detectedRekening && !detectedKegiatan) {
          detectedKegiatan = lastKodeKegiatan;
        } else if (detectedKegiatan) {
          lastKodeKegiatan = detectedKegiatan;
        }
        
        // Skip noise sentences (must have at least an activity code or account code to be a budget line)
        if (!detectedKegiatan && !detectedRekening) {
          continue;
        }
        
        // 3. Reconstruct Uraian Kegiatan (description), Volume, Satuan, Tarif, Jumlah
        let uraianText = fullLineText.trim();
        let volume = '-';
        let satuan = '-';
        let tarifHarga = '-';
        let jumlah = '-';
        
        // Remove sequence number
        const firstWordMatch = uraianText.match(/^(\d{1,3})\b/);
        if (firstWordMatch) {
          const startsWithRek = /^5\./.test(uraianText);
          const startsWithKeg = /^0\d\./.test(uraianText) || /^\d{1,2}\.\d{1,2}/.test(uraianText);
          if (!startsWithRek && !startsWithKeg) {
            uraianText = uraianText.replace(/^\d{1,3}(\.\s*|\s+)/, "");
          }
        }
        
        // Remove Kode Rekening/Kegiatan
        if (detectedRekening) uraianText = uraianText.replace(new RegExp(detectedRekening.replace(/\./g, "\\."), "g"), "");
        if (detectedKegiatan) uraianText = uraianText.replace(new RegExp(detectedKegiatan.replace(/\./g, "\\."), "g"), "");
        
        uraianText = uraianText.replace(/\s+/g, " ").trim();
        
        // Extract numbers from the end of the line
        const parts = uraianText.split(/\s+/);
        if (parts.length >= 4) {
          jumlah = parts.pop() || '-';
          tarifHarga = parts.pop() || '-';
          satuan = parts.pop() || '-';
          volume = parts.pop() || '-';
          uraianText = parts.join(' ');
        }
        
        // Add to result
        const cleanKegiatan = detectedKegiatan.trim();
        const cleanRekening = detectedRekening.trim();
        const cleanKegiatanNoSpace = cleanKegiatan.replace(/\s/g, '');
        const isTargetActivity = /^\d{1,2}\.\d{1,2}\.\d{1,2}(\.\d{1,2})?\.?$/.test(cleanKegiatanNoSpace);
        
        if (isTargetActivity) {
          const hasRekening = cleanRekening && cleanRekening !== "" && cleanRekening !== "-";
          
          if (!hasRekening) {
            parsedItems.push({
              kodeKegiatan: cleanKegiatan,
              kodeRekening: "-",
              uraian: uraianText,
              volume,
              satuan,
              tarifHarga,
              jumlah
            } as any);
          } else {
            const firstChar = uraianText.charAt(0);
            if (!/^[0-9]/.test(firstChar)) {
              parsedItems.push({
                kodeKegiatan: cleanKegiatan,
                kodeRekening: cleanRekening,
                uraian: uraianText,
                volume,
                satuan,
                tarifHarga,
                jumlah
              } as any);
            }
          }
        }
      }
    }
    
    return parsedItems;
  };

  // File Upload Handlers (for local parser drag and drop)
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedPdf(file);
    } else {
      toast.warning('Harap pilih dokumen dengan format PDF (*.pdf)!');
    }
  };

  // File Upload Handlers (for Phased AI local parser)
  const handlePdfFileChangePhased = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedPdfPhased(file);
    } else {
      toast.warning('Harap pilih dokumen dengan format PDF (*.pdf)!');
    }
  };

  const handleAnalyzeWithGeminiPhased = async () => {
    if (!selectedPdfPhased) {
      toast.warning('Silakan seret atau pilih file PDF Rincian Item RKAS Anda terlebih dahulu!');
      return;
    }
    if (!activeYear || activeYear.length !== 4) {
      toast.warning('Tahun anggaran harus diisi dengan benar sebelum memproses berkas!');
      return;
    }

    setIsGeneratingPhased(true);
    try {
      // Small delay to let spinning processing layout play smoothly
      await new Promise(resolve => setTimeout(resolve, 1400));
      
      const parsedData = await parseRkasTahapanPdfServer(selectedPdfPhased);
      
      if (parsedData.length > 0) {
        setPreviewRowsPhased(parsedData);
        setIsPreviewingPhased(true);
        toast.success('PDF berhasil diparse, silakan tinjau data.');
      } else {
        toast.error('Gagal mendeteksi rincian belanja pada dokumen ini.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal mengurai PDF dengan Gemini AI: ${err.message || 'Error'}`);
    } finally {
      setIsGeneratingPhased(false);
    }
  };

  const parseRkasTahapanPdfServer = async (file: File): Promise<ParsedRkasItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultStr = reader.result as string;
          const commaIndex = resultStr.indexOf(',');
          const base64Data = commaIndex !== -1 ? resultStr.substring(commaIndex + 1) : resultStr;
          
          const response = await fetch('/api/parse-rkas-tahapan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pdfBase64: base64Data,
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server returned status ${response.status}`);
          }

          const resData = await response.json();
          if (resData.success && resData.data && Array.isArray(resData.data.items)) {
            const rawItems = resData.data.items;
            const parsedItems: ParsedRkasItem[] = rawItems.map((item: any) => ({
              kodeKegiatan: (item.kodeKegiatan || '').trim(),
              kodeRekening: (item.kodeRekening || '').trim(),
              uraian: (item.uraian || '').trim(),
              volume: (item.volume || '-').trim(),
              satuan: (item.satuan || '-').trim(),
              tarifHarga: (item.tarifHarga || '-').trim(),
              jumlah: (item.jumlah || '-').trim(),
            }));
            resolve(parsedItems);
          } else {
            resolve([]);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };


  const handleSavePhasedMatrix = async (items: PhasedItem[]) => {
    if (!user?.sekolah || !activeYear) return;
    setSavingPhased(true);
    console.log('DEBUG: Exporting phased items to API:', JSON.stringify(items));
    try {
      const response = await fetch(`${API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: 'RKAS_PHASED',
          rows: items
        })
      });
      const data = await response.json();
      if (data.success) {
        setPhasedItems(items);
        sessionStorage.setItem(`RKAS_PHASED_${user.sekolah}_${activeYear}`, JSON.stringify(items));
        setIsPreviewingPhased(false);
        toast.success('Data Rincian Item RKAS berhasil disimpan ke database.');
      } else {
        toast.error(data.message || 'Gagal menyimpan data Rincian Item RKAS');
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghubungi server.');
    } finally {
      setSavingPhased(false);
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

  // Server-side Gemini AI-based RKAS parser
  const parseRkasPdfServer = async (file: File): Promise<ParsedRkasItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultStr = reader.result as string;
          const commaIndex = resultStr.indexOf(',');
          const base64Data = commaIndex !== -1 ? resultStr.substring(commaIndex + 1) : resultStr;
          
          const response = await fetch('/api/parse-rkas', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pdfBase64: base64Data,
              filename: file.name
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server returned status ${response.status}`);
          }

          const resData = await response.json();
          if (resData.success && resData.data && Array.isArray(resData.data.items)) {
            const rawItems = resData.data.items;
            const parsedItems: ParsedRkasItem[] = [];

            rawItems.forEach((item: any) => {
              const codeKeg = (item.kodeKegiatan || '').trim();
              const codeRek = (item.kodeRekening || '').trim();
              const textUraian = (item.uraian || '').trim();

              const cleanRek = codeRek === '-' || !codeRek ? '-' : codeRek;

              if (codeKeg && textUraian && textUraian.length >= 2) {
                parsedItems.push({
                  kodeKegiatan: codeKeg,
                  kodeRekening: cleanRek,
                  uraian: textUraian
                });
              }
            });

            resolve(parsedItems);
          } else {
            throw new Error(resData.message || 'Format respons AI tidak valid');
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Secure and offline-backed RKAS parser execution logic utilizing Gemini AI server-side
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
    try {
      // Small delay to let beautiful spinning processing layout play smoothly
      await new Promise(resolve => setTimeout(resolve, 1400));
      
      const parsedData = await parseRkasPdfServer(selectedPdf);
      
      if (parsedData.length > 0) {
        setPreviewRows(parsedData);
        setShowAiSuccessModal(true);
      } else {
        toast.error('Gagal mendeteksi rincian belanja pada dokumen ini. Pastikan format tabel sesuai standar RKAS.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal mengurai PDF dengan Gemini AI: ${err.message || 'Koneksi terputus atau format tidak didukung'}`);
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

      const response = await fetch(`${API_URL}?action=importData`, {
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
      const response = await fetch(`${API_URL}?action=generatePDFDoc`, {
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

      {/* Dynamic Sub-Menu Switcher for RKAS Tahunan / Rincian Item RKAS */}
      <div className="flex flex-col sm:flex-row border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-850 p-1.5 rounded-2xl shadow-xs gap-2">
        <button
          onClick={() => {
            if (isPreviewing) {
              toast.warning('Selesaikan tinjauan draft hasil AI terlebih dahulu!');
              return;
            }
            setActiveTab('tahunan');
          }}
          className={`px-5 py-3 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'tahunan'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
              : 'text-gray-500 hover:text-gray-850 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <Layers size={14} />
          <span>RKAS TAHUNAN (KEGIATAN)</span>
        </button>
        <button
          onClick={() => {
            if (isPreviewing) {
              toast.warning('Selesaikan tinjauan draft hasil AI terlebih dahulu!');
              return;
            }
            setActiveTab('tahapan');
          }}
          className={`px-5 py-3 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'tahapan'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/15'
              : 'text-gray-500 hover:text-gray-850 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <Calendar size={14} />
          <span>RINCIAN ITEM RKAS</span>
        </button>
      </div>

      {activeTab === 'tahunan' ? (
        isPreviewing ? (
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
                  className="flex-1 lg:flex-none px-6 py-3 border-2 border-red-200 hover:border-red-400 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 hover:scale-[1.02] active:scale-[0.98] rounded-2xl font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
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
                  <h4 className="font-bold text-xs text-gray-850 dark:text-gray-100 animate-pulse">GENERATE RKAS TAHUNAN VIA AI</h4>
                  <p className="text-[10px] text-gray-450 dark:text-gray-400">Ekstrak data Rencana Kegiatan dari berkas PDF Lembaran Rencana Kegiatan Sekolah</p>
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
                    <span>Pilih Berkas PDF RKAS TAHUNAN</span>
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
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white rounded-2xl font-bold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100"
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
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
                  >
                    <Plus size={14} className="text-indigo-550" />
                    <span>Tambah Baris</span>
                  </button>
                  {rows.length > 0 && (
                    <button
                      id="delete-rkas-button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 border-2 border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 hover:scale-[1.02] active:scale-[0.98] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all duration-300 shadow-sm cursor-pointer"
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
                                  className="p-1.5 text-red-505 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition animate-pulse"
                                  title="Hapus Baris"
                                >
                                  <Trash2 size={13} className="text-red-500" />
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
        )
      ) : (
        /* ======================== RKAS TAHAPAN VIEW ======================== */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >



          {/* Generated AI PDF Generator Panel for Tahapan */}
          <div className="bg-gradient-to-r from-teal-50/50 via-emerald-50/40 to-teal-50/10 dark:from-slate-900/50 dark:via-emerald-950/20 dark:to-slate-900/10 border border-teal-100/80 dark:border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl shrink-0">
                <Sparkles size={16} className={isGeneratingPhased ? "animate-spin" : "animate-pulse"} />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs text-gray-850 dark:text-gray-100">GENERATE RINCIAN ITEM RKAS PADA RKAS TAHAPAN</h4>
                <p className="text-[10px] text-gray-450 dark:text-gray-400">Ekstrak data Draf Tahapan dari berkas PDF</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
              {selectedPdfPhased ? (
                <div className="p-2 bg-teal-50 dark:bg-teal-950/40 rounded-xl flex items-center gap-2 border border-teal-150 dark:border-teal-900 text-xs">
                  <FileText size={14} className="text-teal-500 shrink-0" />
                  <span className="font-bold text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{selectedPdfPhased.name}</span>
                  <button 
                    onClick={() => setSelectedPdfPhased(null)} 
                    className="text-gray-400 hover:text-red-500 text-[10px] font-extrabold ml-1 uppercase"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <label className="border-2 border-teal-200 dark:border-teal-800 py-3 px-5 rounded-2xl text-sm font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/20 hover:border-teal-400 cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-sm hover:shadow-teal-500/10">
                  <Upload size={16} className="text-teal-500" />
                  <span>Pilih Berkas PDF RKAS TAHAPAN</span>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handlePdfFileChangePhased} 
                    className="hidden" 
                  />
                </label>
              )}

              {selectedPdfPhased && (
                <button
                  id="trigger-ai-parse-phased"
                  onClick={handleAnalyzeWithGeminiPhased}
                  disabled={isGeneratingPhased || activeYear.length !== 4}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 hover:scale-[1.02] text-white rounded-2xl font-bold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg shadow-teal-600/20 disabled:opacity-50 disabled:scale-100"
                >
                  {isGeneratingPhased ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  <span>{isGeneratingPhased ? 'Menganalisis...' : 'Mulai Jalankan AI'}</span>
                </button>
              )}
            </div>
          </div>
          
          <AnimatePresence>
            {isGeneratingPhased && (
              <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full"
                >
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="text-teal-500 animate-pulse" size={24} />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="font-extrabold text-lg text-gray-900 dark:text-gray-100">AI Sedang Bekerja</h3>
                        <p className="text-sm text-gray-500">Menganalisis dan mengekstrak tabel dokumen Rincian Item RKAS Anda...</p>
                    </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {isPreviewingPhased && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-3xl border-2 border-indigo-200 dark:border-indigo-900 shadow-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-4">
                  <Sparkles size={24} className="text-indigo-600 animate-pulse" />
                  <h3 className="font-black text-lg text-gray-900 dark:text-gray-100">Pratinjau Hasil Generate AI</h3>
                </div>
                <div className="overflow-x-auto text-[10px] text-gray-500 uppercase font-black uppercase">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="p-2 border-b">Kode Rekening</th>
                        <th className="p-2 border-b">Kode Kegiatan</th>
                        <th className="p-2 border-b">Uraian</th>
                        <th className="p-2 border-b">Vol</th>
                        <th className="p-2 border-b">Sat</th>
                        <th className="p-2 border-b">Tarif</th>
                        <th className="p-2 border-b">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRowsPhased.filter((p: any) => {
                            if (p.kodeRekening && p.kodeRekening !== '-') return true;
                            if (!p.kodeKegiatan || p.kodeKegiatan === '-') return false;
                            const segments = p.kodeKegiatan.split('.').filter((s: string) => s.trim().length > 0);
                            return segments.length >= 3;
                      }).map((row: any, idx: number) => {
                        const hasRekening = !!row.kodeRekening && row.kodeRekening !== '-';
                        return (
                        <tr key={idx} className="border-b text-xs text-gray-800 dark:text-gray-200">
                          <td className="p-2">{row.kodeRekening || '-'}</td>
                          <td className="p-2">{row.kodeKegiatan || '-'}</td>
                          <td className="p-2">{row.uraian || '-'}</td>
                          <td className="p-2">{hasRekening ? (row.volume || '-') : '-'}</td>
                          <td className="p-2">{hasRekening ? (row.satuan || '-') : '-'}</td>
                          <td className="p-2">{hasRekening ? (row.tarifHarga || '-') : '-'}</td>
                          <td className="p-2">{hasRekening ? (row.jumlah || '-') : '-'}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button onClick={() => setIsPreviewingPhased(false)} className="px-4 py-2 bg-gray-200 rounded-lg text-xs font-bold">Batal</button>
                  <button onClick={() => {
                    const items = previewRowsPhased
                        .filter((p: any) => {
                            if (p.kodeRekening && p.kodeRekening !== '-') return true; // Has Rekening
                            if (!p.kodeKegiatan || p.kodeKegiatan === '-') return false;
                            // Need exactly 3 segments for Kegiatan (e.g., 03.01.01.)
                            const segments = p.kodeKegiatan.split('.').filter((s: string) => s.trim().length > 0);
                            return segments.length >= 3;
                        })
                        .map((p: any, idx: number) => {
                            const hasRekening = !!p.kodeRekening && p.kodeRekening !== '-';
                            return {
                              id: `phased-${idx}`,
                              kodeRekening: p.kodeRekening || '-',
                              kodeKegiatan: p.kodeKegiatan || '-',
                              uraian: p.uraian || '-',
                              volume: hasRekening ? (p.volume || '-') : '-',
                              satuan: hasRekening ? (p.satuan || '-') : '-',
                              tarifHarga: hasRekening ? (p.tarifHarga || '-') : '-',
                              jumlah: hasRekening ? (p.jumlah || '-') : '-',
                              tahap: 'both' as const,
                              porsiTahap1: 50,
                              porsiTahap2: 50
                            };
                        });
                    handleSavePhasedMatrix(items);
                  }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                    {savingPhased ? <RefreshCw className="animate-spin" size={13} /> : 'Simpan ke Matriks & Database'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(() => {
          const filteredPhasedItems = phasedItems.filter((p) => {
              if (p.kodeRekening && p.kodeRekening !== '-') return true;
              if (!p.kodeKegiatan || p.kodeKegiatan === '-') return false;
              const segments = p.kodeKegiatan.split('.').filter((s: string) => s.trim().length > 0);
              return segments.length >= 3;
          });
          
          const totalKegiatan = filteredPhasedItems.filter(p => !p.kodeRekening || p.kodeRekening === '-').length;
          const totalItem = filteredPhasedItems.filter(p => p.kodeRekening && p.kodeRekening !== '-').length;
          
          return (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-755 pb-4">
              <div>
                <h3 className="font-bold text-md text-gray-850 dark:text-white">DAFTAR Rincian Item Kegiatan RKAS ({filteredPhasedItems.length})</h3>
                <p className="text-[11px] text-gray-400 font-medium">Bagi proporsi pemakaian dana operasional sekolah per item mata rincian kegiatan belanja.</p>
              </div>
              <div className="flex gap-2 items-center">
                 {filteredPhasedItems.length > 0 && (
                    <button
                      onClick={() => setShowDeleteConfirmPhased(true)}
                      className="px-4 py-2 border-2 border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 hover:scale-[1.02] active:scale-[0.98] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      <Trash2 size={14} className="text-red-500" />
                      <span>Hapus Rincian Item</span>
                    </button>
                  )}
              </div>
            </div>

            {filteredPhasedItems.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-2">
                <Database size={30} className="mx-auto text-gray-300" />
                <p className="font-bold text-sm">Data Rincian Item Kosong</p>
                <p className="text-[11px]">Silakan generate Rincian Item RKAS melalui panel berkas PDF di atas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-gray-100 dark:border-gray-755 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f0f7fc] dark:bg-slate-900 border-b border-blue-100 dark:border-slate-800 text-[11px] font-extrabold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                        <th className="p-3.5 font-bold">KODE REKENING</th>
                        <th className="p-3.5 font-bold whitespace-nowrap">KODE KEGIATAN / KODE PROGRAM</th>
                        <th className="p-3.5 font-bold">URAIAN KEGIATAN</th>
                        <th className="p-3.5 font-bold">VOLUME</th>
                        <th className="p-3.5 font-bold">SATUAN</th>
                        <th className="p-3.5 font-bold">TARIF HARGA</th>
                        <th className="p-3.5 font-bold whitespace-nowrap">JUMLAH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                      {filteredPhasedItems.map((item, idx) => {
                          const hasRekening = !!item.kodeRekening && item.kodeRekening !== '-';
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-xs">
                              <td className="p-3.5 font-mono text-gray-505 dark:text-gray-400">{item.kodeRekening || '-'}</td>
                              <td className="p-3.5 font-mono font-bold text-indigo-500">{item.kodeKegiatan || '-'}</td>
                              <td className="p-3.5 font-medium text-gray-800 dark:text-gray-200">{item.uraian}</td>
                              <td className="p-3.5 font-mono text-gray-800 dark:text-gray-200">{hasRekening ? (item.volume || '-') : '-'}</td>
                              <td className="p-3.5 font-mono text-gray-800 dark:text-gray-200">{hasRekening ? (item.satuan || '-') : '-'}</td>
                              <td className="p-3.5 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{hasRekening ? (item.tarifHarga || '-') : '-'}</td>
                              <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{hasRekening ? (item.jumlah || '-') : '-'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Save Footer for Phased RKAS */}
                <div className="flex flex-col sm:flex-row justify-between border-t border-gray-100 dark:border-gray-755 pt-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-5 py-4 rounded-xl flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center justify-between gap-8 font-bold">
                      <span className="text-gray-500 text-xs uppercase tracking-wider">TOTAL KEGIATAN</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-lg">{totalKegiatan} KEGIATAN</span>
                    </div>
                    <div className="flex items-center justify-between gap-8 font-bold border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                      <span className="text-gray-500 text-xs uppercase tracking-wider">TOTAL ITEM</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-lg">{totalItem} ITEM</span>
                    </div>
                    <div className="flex items-center justify-between gap-8 font-extrabold border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                      <span className="text-gray-500 text-xs uppercase tracking-wider">TOTAL SELURUH DANA</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-xl">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
                          filteredPhasedItems.reduce((acc, current) => {
                            const hasRekening = !!current.kodeRekening && current.kodeRekening !== '-';
                            if (!hasRekening) return acc;
                            const val = typeof current.jumlah === 'string' ? parseFloat(current.jumlah.replace(/[^0-9,-]+/g,"").replace(",", ".")) || 0 : (typeof current.jumlah === 'number' ? current.jumlah : 0);
                            return acc + val;
                          }, 0)
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem(`siap_bos_phased_rkas_${activeYear}`, JSON.stringify(phasedItems));
                        toast.success(`Konfigurasi proporsi Rincian Item RKAS ${activeYear} sukses disinkronisasikan!`);
                      }}
                      className="px-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center justify-center gap-2 h-fit mb-1"
                    >
                      <Check size={16} />
                      <span>Simpan Sinkronisasi Database</span>
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">Data sinkron ke server utama</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
          })()}

        </motion.div>
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

      {/* Phased Formulation Progress Modal */}
      <AnimatePresence>
        {isFormulatingPhased && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-7 text-center space-y-5"
            >
              <div className="flex justify-center relative">
                <div className="absolute inset-0 rounded-full bg-purple-100/30 dark:bg-purple-950/20 animate-ping w-14 h-14 mx-auto"></div>
                <Sparkles className="animate-spin text-purple-600 dark:text-purple-400 relative z-10" size={36} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black tracking-widest text-purple-600 dark:text-purple-400 uppercase font-mono animate-pulse">
                  AI FORMULATOR AKTIF
                </p>
                <div className="h-6 text-center font-bold text-xs text-gray-800 dark:text-white uppercase truncate flex items-center justify-center">
                  {formulationSteps[formulationStep]}
                </div>
                
                {/* Visual loading percentage tracking bar */}
                <div className="relative w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-4">
                  <motion.div 
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-purple-500 to-indigo-600"
                    animate={{ width: `${((formulationStep + 1) / formulationSteps.length) * 100}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Info Notice Modal */}
      <AnimatePresence>
        {showInfoNotice && !loadingDatabases && !loadingData && !loadingPhasedData && !(rows.length > 0 && phasedItems.length > 0) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-indigo-150 dark:border-indigo-500/20 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shadow-inner">
                <Info size={30} className="animate-pulse" />
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-black tracking-tight text-gray-900 dark:text-white leading-snug">
                  PERSIAPKAN FILE PDF YANG TELAH ANDA DOWNLOAD PADA ARKAS
                </h3>
                <div className="text-xs text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wide space-y-1.5 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-left border border-gray-100 dark:border-gray-800">
                  <p className="flex items-center gap-2">
                    {rows.length > 0 ? (
                      <div className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 w-5 h-5 flex items-center justify-center rounded-full">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : (
                      <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">1</span>
                    )}
                    FILE PDF RKAS TAHUNAN
                  </p>
                  <p className="flex items-center gap-2">
                    {phasedItems.length > 0 ? (
                      <div className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 w-5 h-5 flex items-center justify-center rounded-full">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : (
                      <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span>
                    )}
                    FILE PDF RKAS TAHAPAN
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoNotice(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                TUTUP
              </button>
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

      <AnimatePresence>
        {showDeleteConfirmPhased && (
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
                  Hapus Rincian Item {activeYear}
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-bold uppercase tracking-wide">
                  Apakah Anda yakin ingin menghapus seluruh rincian item RKAS tahun {activeYear}?
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-normal font-medium">
                  Tindakan ini akan mengosongkan seluruh baris data rincian item dalam database spreadsheet Anda.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmPhased(false)}
                  className="w-1/2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteRkasPhased();
                  }}
                  className="w-1/2 py-2.5 bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-650/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  {savingPhased ? <RefreshCw className="animate-spin text-white" size={13} /> : <Trash2 size={13} />}
                  <span>{savingPhased ? 'Menghapus...' : 'Ya, Hapus'}</span>
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
