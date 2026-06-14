import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, Database, Upload, Plus, Trash2, 
  ExternalLink, RefreshCw, Calendar, FileSpreadsheet, Play, Info,
  CheckSquare, X, FileText, AlertTriangle, CheckCircle, Edit, Save
} from 'lucide-react';
import { toast } from 'sonner';

interface DataRow {
  tanggal: string;
  kodeKegiatan: string;
  kodeRekening: string;
  bukti: string;
  keterangan: string;
  debit: string;
  kredit: string;
}

interface GeneratedDatabase {
  name: string;
  url: string;
  created: string;
  size: string;
}

const formatValueIfDate = (val: any, isDateColumn: boolean): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str === '') return '';
  
  // Clean parenthesized timezone strings like '(Waktu Indochina)' or '(Coordinated Universal Time)'
  if (str.includes('(')) {
    str = str.split('(')[0].trim();
  }
  
  // 1. Check if it's a standard JS Date object string or contains timezone
  const isDateObjectString = str.includes('GMT') || str.includes('UTC') || /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d+/.test(str);
  
  if (isDateObjectString) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      
      if (isDateColumn) {
        return `${dd}/${mm}/${yyyy}`;
      } else {
        const zz = String(yyyy % 100).padStart(2, '0');
        return `${dd}.${mm}.${zz}.`;
      }
    }
  }

  // 2. Check if it is an ISO Date String (e.g. 2025-03-01T00:00:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      
      if (isDateColumn) {
        return `${dd}/${mm}/${yyyy}`;
      } else {
        const zz = String(yyyy % 100).padStart(2, '0');
        return `${dd}.${mm}.${zz}.`;
      }
    }
  }

  // 3. Normalize existing date formats (converting hyphen to slash)
  if (isDateColumn) {
    if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(str)) {
      return str.replace(/-/g, '/');
    }
  } else {
    if (/^\d{1,2}\.\d{1,2}\.\d{1,2}\.?$/.test(str)) {
      return str;
    }
  }

  return str;
};

export default function Bku() {
  const { user } = useAuth();
  
  // Year & Month states
  const [databases, setDatabases] = useState<GeneratedDatabase[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '';
  });
  const [activeMonth, setActiveMonth] = useState<string>('Januari');
  const [selectedDbUrl, setSelectedDbUrl] = useState<string>('');
  const [monthsWithData, setMonthsWithData] = useState<string[]>([]);
  
  // BKU ledger rows
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [generatingMonth, setGeneratingMonth] = useState(false);

  // Preview BKU Impor states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewRows, setPreviewRows] = useState<DataRow[]>([]);
  const [previewMonth, setPreviewMonth] = useState('Januari');
  const [previewYear, setPreviewYear] = useState('2026');
  const [previewMethod, setPreviewMethod] = useState<'replace' | 'append'>('replace');
  const [isSavingPreview, setIsSavingPreview] = useState(false);

  // Custom BKU deleting states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Kode Kegiatan & Kode Rekening editing states
  const [isEditingCodes, setIsEditingCodes] = useState(false);
  const [originalRows, setOriginalRows] = useState<DataRow[]>([]);

  const hasChanges = rows.some((row, idx) => {
    const orig = originalRows[idx];
    if (!orig) return false;
    return row.kodeKegiatan !== orig.kodeKegiatan || row.kodeRekening !== orig.kodeRekening;
  });

  const handleCancelEditKode = () => {
    setRows(originalRows.map(r => ({ ...r })));
    setIsEditingCodes(false);
  };

  const handleEditKodeClick = async () => {
    if (!isEditingCodes) {
      setOriginalRows(rows.map(r => ({ ...r })));
      setIsEditingCodes(true);
    } else {
      if (!hasChanges) {
        setRows(originalRows.map(r => ({ ...r })));
        setIsEditingCodes(false);
      } else {
        await handleSaveData();
      }
    }
  };

  // Modern action status and detection alert modals
  const [dbActionStatus, setDbActionStatus] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'processing' | 'success';
  } | null>(null);

  const [detectionNotice, setDetectionNotice] = useState<{
    show: boolean;
    count: number;
  } | null>(null);

  const [emptyNoticeMonth, setEmptyNoticeMonth] = useState<string | null>(null);

  // PDF Generation states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfGenStep, setPdfGenStep] = useState(0);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const pdfSteps = [
    'Membuka spreadsheet transaksi sekolah...',
    'Menghitung neraca saldo penutupan...',
    'Mempersiapkan template KOP resmi BKU...',
    'Membubuhkan tanda bendahara dan kepala sekolah...',
    'Mengonversi berkas dokumen ke PDF...',
    'Menyalin berkas cetak ke folder PDF_LAPORAN Google Drive...'
  ];

  // Check which months already have BKU data
  const invalidateBkuCache = (year = activeYear, month = activeMonth) => {
    if (!user?.sekolah) return;
    sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_databases`);
    if (year) {
      sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_bku_months_${year}`);
      if (month) {
        sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_bku_${year}_${month}`);
      }
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  // Load BKU months that have saved records
  const fetchMonthsWithData = async (forceRefresh = false) => {
    if (!user?.sekolah || !activeYear) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_bku_months_${activeYear}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setMonthsWithData(parsed);
          return;
        } catch (e) {}
      }
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=checkBkuMonths`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear
        })
      });
      const data = await response.json();
      if (data.success && data.months) {
        setMonthsWithData(data.months);
        sessionStorage.setItem(cacheKey, JSON.stringify(data.months));
      }
    } catch (err) {
      console.error("Error checking BKU months:", err);
      toast.error("Layanan BKU saat ini sedang tidak tersedia. Mohon periksa koneksi atau coba sesaat lagi.");
    }
  };

  // Load list of databases for school
  const fetchDatabases = async (silent = false, forceRefresh = false) => {
    if (!user?.sekolah) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_databases`;

    if (!forceRefresh && !silent) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setDatabases(parsed);
          
          if (parsed.length > 0) {
            const currentActive = localStorage.getItem('siap_bos_active_year') || '';
            const match = parsed.find((db: any) => db.name.includes(currentActive));
            
            if (match && currentActive) {
              setSelectedDbUrl(match.url);
            } else {
              const firstDb = parsed[0];
              const yearMatch = firstDb.name.match(/\d+/);
              const yr = yearMatch ? yearMatch[0] : '2026';
              setActiveYear(yr);
              localStorage.setItem('siap_bos_active_year', yr);
              setSelectedDbUrl(firstDb.url);
            }
          }
          silent = true; // still reload background silently
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
        setDatabases(data.data || []);
        sessionStorage.setItem(cacheKey, JSON.stringify(data.data || []));
        
        // Auto-select first year if none active
        const dbs = data.data || [];
        if (dbs.length > 0) {
          const currentActive = localStorage.getItem('siap_bos_active_year') || '';
          const match = dbs.find((db: any) => db.name.includes(currentActive));
          
          if (match && currentActive) {
            setSelectedDbUrl(match.url);
          } else {
            const firstDb = dbs[0];
            const yearMatch = firstDb.name.match(/\d+/);
            const yr = yearMatch ? yearMatch[0] : '2026';
            setActiveYear(yr);
            localStorage.setItem('siap_bos_active_year', yr);
            setSelectedDbUrl(firstDb.url);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingDatabases(false);
    }
  };

  // Fetch BKU rows for selected school, year and month
  const fetchBkuData = async (year: string, month: string, forceRefresh = false) => {
    if (!user?.sekolah || !year || !month) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_bku_${year}_${month}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const formatted = parsed.map((row: any) => ({
            ...row,
            tanggal: formatValueIfDate(row.tanggal, true),
            kodeKegiatan: String(row.kodeKegiatan || '').replace(/\s+/g, ''),
            kodeRekening: String(row.kodeRekening || '').replace(/\s+/g, ''),
          }));
          setRows(formatted);
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
          tipe: month
        })
      });
      const data = await response.json();
      if (data.success && data.rows && data.rows.length > 0) {
        const cleanedRows = data.rows.map((row: any) => ({
          ...row,
          tanggal: formatValueIfDate(row.tanggal, true),
          kodeKegiatan: String(row.kodeKegiatan || '').replace(/\s+/g, ''),
          kodeRekening: String(row.kodeRekening || '').replace(/\s+/g, ''),
        }));
        setRows(cleanedRows);
        sessionStorage.setItem(cacheKey, JSON.stringify(cleanedRows));
      } else {
        // Fallback seeded rows matching 6-column BKU - Empty by default
        setRows([]);
        sessionStorage.setItem(cacheKey, JSON.stringify([]));
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil rincian Buku Kas Umum dari database');
    } finally {
      setLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateBkuCache(activeYear, activeMonth);
    try {
      await fetchDatabases(true, true);
      await fetchBkuData(activeYear, activeMonth, true);
      await fetchMonthsWithData(true);
      toast.success('Data BKU berhasil diperbarui!');
    } catch (err) {
      toast.error('Gagal memperbarui data BKU');
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
    if (activeYear && activeYear.length === 4 && activeMonth) {
      fetchBkuData(activeYear, activeMonth);
      fetchMonthsWithData();
      const match = databases.find(db => db.name.includes(activeYear));
      if (match) {
        setSelectedDbUrl(match.url);
      } else {
        setSelectedDbUrl('');
      }
    }
  }, [activeYear, activeMonth, databases]);

  // Editing BKU rows helpers
  const handleAddRow = () => {
    const monthIdxString = String(months.indexOf(activeMonth) + 1).padStart(2, '0');
    const defaultDate = rows.length > 0 ? rows[rows.length - 1].tanggal : `01/${monthIdxString}/${activeYear}`;
    setRows([...rows, { tanggal: defaultDate, kodeKegiatan: '', kodeRekening: '', bukti: '', keterangan: '', debit: '0', kredit: '0' }]);
  };

  const handleRemoveRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleDeleteBku = () => {
    if (!user?.sekolah || !activeYear || !activeMonth) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteBku = async () => {
    setShowDeleteConfirm(false);
    setDbActionStatus({
      show: true,
      title: 'MENGHAPUS DATA BKU',
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
          tipe: activeMonth,
          rows: []
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateBkuCache(activeYear, activeMonth);
        setRows([]);
        await fetchMonthsWithData();
        setDbActionStatus({
          show: true,
          title: 'SUKSES',
          message: 'DATA BKU BULANAN ANDA BERHASIL DI BERSIHKAN DARI DATABASE',
          type: 'success'
        });
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Gagal menghapus data BKU');
      }
    } catch (err) {
      setDbActionStatus(null);
      console.error(err);
      toast.error('Koneksi terputus sewaktu menghapus data');
    }
  };

  const updateRowValue = (idx: number, key: keyof DataRow, val: string) => {
    const nextArr = [...rows];
    let cleanedVal = val;
    if (key === 'kodeKegiatan' || key === 'kodeRekening') {
      cleanedVal = val.replace(/\s+/g, '');
    }
    nextArr[idx] = { ...nextArr[idx], [key]: cleanedVal };
    setRows(nextArr);
  };

  // Compute Balances dynamically
  const totalKredit = rows.reduce((sum, row) => sum + (parseFloat(row.kredit) || 0), 0);

  const totalBpuInternal = rows.reduce((sum, row) => {
    const isBpu = /^BPU/i.test((row.bukti || '').trim());
    return isBpu ? sum + (parseFloat(row.kredit) || 0) : sum;
  }, 0);

  const totalBnuInternal = rows.reduce((sum, row) => {
    const isBnu = /^BNU/i.test((row.bukti || '').trim());
    return isBnu ? sum + (parseFloat(row.kredit) || 0) : sum;
  }, 0);

  const availableYears = Array.from(
    new Set(
      databases
        .map(db => {
          const match = db.name.match(/\d{4}/);
          return match ? match[0] : '';
        })
        .filter(Boolean)
    )
  ).sort();

  // PDF.js coordinate text-line coordinate-based parser
  const parseBkuPdf = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        toast.error("Pustaka PDF.js pendukung offline belum siap. Tunggu sesaat dan coba lagi.");
        return;
      }
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      
      let allTransactions: DataRow[] = [];
      let lastTransaction: DataRow | null = null;
      
      // Peta letak kolom dinamis berdasarkan deteksi geometris header tabel
      // Diisi dengan nilai fallback proporsional default agar aman jika pendeteksian lewat judul/header halaman pertama terlewat
      let colMap = {
        tanggal: 0.06,
        kodeKegiatan: 0.15,
        kodeRekening: 0.24,
        noBukti: 0.35,
        uraian: 0.48,
        penerimaan: 0.68,
        pengeluaran: 0.80,
        saldo: 0.92
      };
      let headersFound = false;
      
      // Load all pages in parallel
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
      
      // 1. First Pass: Detect Month & Year from raw texts
      let detectedMonth: string | null = null;
      let detectedYear: string | null = null;
      
      const indonesiangMonths = [
        "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", 
        "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
      ];
      
      const monToCapitalized: { [key: string]: string } = {
        "JANUARI": "Januari", "FEBRUARI": "Februari", "MARET": "Maret", "APRIL": "April",
        "MEI": "Mei", "JUNI": "Juni", "JULI": "Juli", "AGUSTUS": "Agustus",
        "SEPTEMBER": "September", "OKTOBER": "Oktober", "NOVEMBER": "November", "DESEMBER": "Desember"
      };
      
      pagesData.forEach(pageData => {
        pageData.items.forEach(item => {
          const txt = item.str.toUpperCase();
          const yearMatch = txt.match(/\b(202\d)\b/);
          if (yearMatch && !detectedYear) {
            detectedYear = yearMatch[1];
          }
          for (const mon of indonesiangMonths) {
            const regex = new RegExp("\\b" + mon + "\\b", "i");
            if (regex.test(txt) && !detectedMonth) {
              detectedMonth = monToCapitalized[mon];
            }
          }
        });
      });
      
      const pm = detectedMonth || activeMonth;
      const py = detectedYear || activeYear;
      setPreviewMonth(pm);
      setPreviewYear(py);
      
      if (detectedMonth) {
        toast.info(`Mendeteksi Transaksi BKU Bulan: ${detectedMonth}`);
      }
      if (detectedYear) {
        toast.info(`Mendeteksi Tahun Anggaran: ${detectedYear}`);
      }
      
      // 2. Second Pass: Structural logical row extraction using dynamic geometric coordinate mappings
      
      // Robust multi-lingual / multi-locale currency string numbers parser
      const parseNominal = (str: string) => {
        if (!str) return 0;
        let clean = str.replace(/Rp/ig, '').replace(/\s/g, '');
        
        const endsWithIndoDecimal = /,(\d{2})$/.test(clean);
        const endsWithEngDecimal = /\.(\d{2})$/.test(clean);
        
        if (endsWithIndoDecimal) {
          clean = clean.slice(0, -3);
          clean = clean.replace(/\./g, '');
        } else if (endsWithEngDecimal) {
          clean = clean.slice(0, -3);
          clean = clean.replace(/,/g, '');
        } else {
          const dotCount = (clean.match(/\./g) || []).length;
          const commaCount = (clean.match(/,/g) || []).length;
          
          if (dotCount > commaCount) {
            clean = clean.replace(/\./g, '').replace(/,/g, '');
          } else if (commaCount > dotCount) {
            clean = clean.replace(/,/g, '').replace(/\./g, '');
          } else {
            const commaIndex = clean.indexOf(',');
            const dotIndex = clean.indexOf('.');
            if (commaIndex !== -1 && dotIndex !== -1) {
              if (commaIndex < dotIndex) {
                clean = clean.split('.')[0].replace(/,/g, '');
              } else {
                clean = clean.split(',')[0].replace(/\./g, '');
              }
            } else {
              clean = clean.replace(/[^\d]/g, '');
            }
          }
        }
        
        clean = clean.replace(/[^\d]/g, '');
        return clean ? parseInt(clean, 10) : 0;
      };

      for (const pageData of pagesData) {
        const { viewport, items } = pageData;
        const pageWidth = viewport.width;
        
        // Group texts by Y coordinate (line grouping with a height tolerance of 14px for more robust row alignment)
        const linesMap = new Map<number, any[]>();
        items.forEach((item) => {
          const y = Math.round(item.transform[5]);
          let found = false;
          for (const [lineY, lineItems] of linesMap.entries()) {
            if (Math.abs(y - lineY) < 14) {
              lineItems.push(item);
              found = true;
              break;
            }
          }
          if (!found) linesMap.set(y, [item]);
        });
        
        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
        
        // Page-specific column mapping defaulted to our standard proportions
        let pageColMap = {
          tanggal: colMap.tanggal !== -1 ? colMap.tanggal : 0.08,
          kodeKegiatan: colMap.kodeKegiatan !== -1 ? colMap.kodeKegiatan : 0.17,
          kodeRekening: colMap.kodeRekening !== -1 ? colMap.kodeRekening : 0.26,
          noBukti: colMap.noBukti !== -1 ? colMap.noBukti : 0.36,
          uraian: colMap.uraian !== -1 ? colMap.uraian : 0.52,
          penerimaan: colMap.penerimaan !== -1 ? colMap.penerimaan : 0.69,
          pengeluaran: colMap.pengeluaran !== -1 ? colMap.pengeluaran : 0.81,
          saldo: colMap.saldo !== -1 ? colMap.saldo : 0.93
        };
        let pageHeadersFound = false;
        
        // Let's calibrate! Search for a line of header digits "1 2 3 4 5 6 7 8"
        for (const y of sortedY) {
          const lineItems = linesMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
          const tokens = lineItems.map(item => ({
            text: item.str.trim(),
            centerX: (item.transform[4] + (item.transform[4] + (item.width || (item.str.length * 5)))) / 2
          })).filter(t => t.text !== "");
          
          const digitTokens = tokens.filter(t => /^[1-8]$/.test(t.text));
          if (digitTokens.length >= 6) {
            let isInOrder = true;
            for (let idx = 0; idx < digitTokens.length - 1; idx++) {
              if (parseInt(digitTokens[idx].text) >= parseInt(digitTokens[idx + 1].text)) {
                isInOrder = false;
                break;
              }
            }
            if (isInOrder) {
              const keyMap: { [key: number]: string } = {
                1: 'tanggal',
                2: 'kodeKegiatan',
                3: 'kodeRekening',
                4: 'noBukti',
                5: 'uraian',
                6: 'penerimaan',
                7: 'pengeluaran',
                8: 'saldo'
              };
              let tempColMap = { ...pageColMap };
              digitTokens.forEach(dt => {
                const num = parseInt(dt.text);
                const colKey = keyMap[num];
                if (colKey) {
                  tempColMap[colKey as keyof typeof pageColMap] = dt.centerX / pageWidth;
                }
              });
              pageColMap = tempColMap;
              colMap = { ...tempColMap }; // Update the global fallback
              pageHeadersFound = true;
              console.log(`[Auto-Calibrate] Found numbered headers (1-8) at Y=${y}:`, pageColMap);
              break;
            }
          }
        }
        
        // If numbered header not found, fallback to searching word title headers (like TANGGAL, URAIAN, etc.)
        if (!pageHeadersFound) {
          for (const y of sortedY) {
            const lineItems = linesMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
            const blocks: { text: string; centerX: number }[] = [];
            
            let currentText = "";
            let currentX = -1;
            let lastXEnd = -1;
            
            lineItems.forEach(item => {
              const x = item.transform[4];
              const width = item.width || (item.str.length * 5);
              const text = item.str.trim();
              if (!text) return;
              if (lastXEnd !== -1 && (x - lastXEnd) > 7) {
                blocks.push({
                  text: currentText.trim(),
                  centerX: (currentX + lastXEnd) / 2
                });
                currentText = text;
                currentX = x;
              } else {
                if (currentText === "") currentX = x;
                currentText = currentText ? currentText + " " + text : text;
              }
              lastXEnd = x + width;
            });
            if (currentText) {
              blocks.push({
                text: currentText.trim(),
                centerX: (currentX + lastXEnd) / 2
              });
            }
            
            const fullText = blocks.map(b => b.text).join(' ').toUpperCase();
            if (fullText.includes("TANGGAL") && (fullText.includes("URAIAN") || fullText.includes("KETERANGAN"))) {
              let foundCount = 0;
              let tempColMap = { ...pageColMap };
              blocks.forEach(b => {
                const txt = b.text.toUpperCase();
                if (txt.includes("TANGGAL")) { tempColMap.tanggal = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("KEGIATAN")) { tempColMap.kodeKegiatan = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("REKENING") || txt.includes("REK.")) { tempColMap.kodeRekening = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("BUKTI")) { tempColMap.noBukti = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("URAIAN") || txt.includes("KETERANGAN")) { tempColMap.uraian = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("PENERIMAAN") || txt.includes("DEBET") || txt.includes("DEBIT")) { tempColMap.penerimaan = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("PENGELUARAN") || txt.includes("KREDIT")) { tempColMap.pengeluaran = b.centerX / pageWidth; foundCount++; }
                else if (txt.includes("SALDO")) { tempColMap.saldo = b.centerX / pageWidth; foundCount++; }
              });
              if (foundCount >= 4) {
                pageColMap = tempColMap;
                colMap = { ...tempColMap }; // Update globally
                pageHeadersFound = true;
                console.log(`[Auto-Calibrate] Found word headers at Y=${y}:`, pageColMap);
                break;
              }
            }
          }
        }
        
        sortedY.forEach((y) => {
          const lineItems = linesMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
          
          // Combine adjacent horizontal blocks into column phrases (word grouping)
          const blocks: { text: string; relX: number; centerRelX: number }[] = [];
          let currentText = "";
          let currentX = -1;
          let lastXEnd = -1;
          
          lineItems.forEach(item => {
            const x = item.transform[4];
            const width = item.width || (item.str.length * 5);
            const text = item.str.trim();
            
            if (!text) return;
            
            // If gap between subsequent words in same line is bigger than 7px, classify as a new block
            if (lastXEnd !== -1 && (x - lastXEnd) > 7) {
              blocks.push({
                text: currentText.trim(),
                relX: currentX / pageWidth,
                centerRelX: ((currentX + lastXEnd) / 2) / pageWidth
              });
              currentText = text;
              currentX = x;
            } else {
              if (currentText === "") currentX = x;
              currentText = currentText ? currentText + " " + text : text;
            }
            lastXEnd = x + width;
          });
          
          if (currentText) {
            blocks.push({
              text: currentText.trim(),
              relX: currentX / pageWidth,
              centerRelX: ((currentX + lastXEnd) / 2) / pageWidth
            });
          }
          
          if (blocks.length === 0) return;
          
          const fullText = blocks.map(b => b.text).join(' ').toUpperCase();
          
          // Filter out header lines themselves
          if (fullText.includes("TANGGAL") && (fullText.includes("URAIAN") || fullText.includes("KETERANGAN"))) {
            return;
          }
          const pureDigits = blocks.map(b => b.text.trim()).filter(t => /^[1-8]$/.test(t));
          if (pureDigits.length >= 6) {
            return;
          }
          
          // Filter out page footers, summary lines, or document title wraps to prevent noise
          if (/PINDAHAN|SUB TOTAL|JUMLAH|SALDO BANK|SALDO TUNAI|BUKU KAS UMUM|HALAMAN|KUTIPAN/i.test(fullText)) {
            return;
          }
          
          // Map blocks to closest columns based on mathematical midpoint intervals between adjacent headers
          let rowTanggal = "";
          let rowKegiatan = "";
          let rowRekening = "";
          let rowBukti = "";
          let rowUraian = "";
          let rowPengeluaran = "";
          let rowPenerimaan = "";
          
          const activeCols = Object.entries(pageColMap)
            .filter(([_, val]) => val !== -1)
            .sort((a, b) => a[1] - b[1]);
            
          const getCol = (centerRelX: number) => {
            let selectedCol = "";
            for (let i = 0; i < activeCols.length; i++) {
              const currentCol = activeCols[i];
              const nextCol = activeCols[i + 1];
              const prevCol = activeCols[i - 1];
              
              const startX = prevCol ? (prevCol[1] + currentCol[1]) / 2 : 0;
              const endX = nextCol ? (currentCol[1] + nextCol[1]) / 2 : 1.0;
              
              if (centerRelX >= startX && centerRelX < endX) {
                selectedCol = currentCol[0];
                break;
              }
            }
            return selectedCol;
          };
          
          blocks.forEach(b => {
            const col = getCol(b.centerRelX);
            const txt = b.text.trim();
            if (col === "tanggal") rowTanggal += (rowTanggal ? " " : "") + txt;
            else if (col === "kodeKegiatan") rowKegiatan += (rowKegiatan ? " " : "") + txt;
            else if (col === "kodeRekening") rowRekening += (rowRekening ? " " : "") + txt;
            else if (col === "noBukti") rowBukti += (rowBukti ? " " : "") + txt;
            else if (col === "uraian") rowUraian += (rowUraian ? " " : "") + txt;
            else if (col === "pengeluaran") rowPengeluaran += (rowPengeluaran ? " " : "") + txt;
            else if (col === "penerimaan") rowPenerimaan += (rowPenerimaan ? " " : "") + txt;
          });
          
          // Content-aware calibration & repairs:
          // Often PDF text coordinates are slightly shifted. We can find block text patterns
          // and re-verify candidates for Kode Rekening or Kode Kegiatan.
          let cleanRekening = rowRekening.replace(/\s+/g, '').trim();
          let cleanKegiatan = rowKegiatan.replace(/\s+/g, '').trim();

          const isCompleteRekening = (s: string) => /^5\.\d+(?:\.\d+)+$/.test(s);
          const isCompleteKegiatan = (s: string) => /^\d\.\d+(?:\.\d+)+$/.test(s);

          // Advanced extraction sub-functions for high-precision
          const getAccountPattern = (s: string): string => {
            const stripped = s.replace(/\s+/g, '').trim();
            // Look for any 5.X.XX... pattern inside
            const match = stripped.match(/(5\.\d+(?:\.\d+)+)/);
            if (match) return match[1];
            // Fallback: any other pattern with at least 3 dots
            const generalMatch = stripped.match(/(\d\.\d+(?:\.\d+){3,})/);
            if (generalMatch) return generalMatch[1];
            return "";
          };

          const getActivityPattern = (s: string): string => {
            const stripped = s.replace(/\s+/g, '').trim();
            // Skip account codes
            if (stripped.startsWith("5.") && stripped.split('.').length > 3) return "";
            const match = stripped.match(/^(\d\.\d+(?:\.\d+)*)/);
            if (match) return match[1];
            return "";
          };

          let foundDate = "";
          let foundRekening = "";
          let foundKegiatan = "";

          blocks.forEach(b => {
            const txt = b.text.trim();
            const cleanTxt = txt.replace(/\s+/g, '');
            // 1. Detect standard Indonesian BKU date format (e.g. DD/MM/YYYY)
            if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(cleanTxt)) {
              foundDate = cleanTxt;
            }
            // 2. Scan block text for any viable Account Code (Kode Rekening)
            const matchedRek = getAccountPattern(txt);
            if (matchedRek && matchedRek.length > foundRekening.length) {
              foundRekening = matchedRek;
            }
            // 3. Scan block text for any viable Activity Code (Kode Kegiatan)
            const matchedKeg = getActivityPattern(txt);
            if (matchedKeg && matchedKeg.length > foundKegiatan.length) {
              foundKegiatan = matchedKeg;
            }
          });

          if (foundDate) {
            rowTanggal = foundDate;
          }

          // Apply recovered values if they are more complete than column-mapped values
          const curRekPattern = getAccountPattern(cleanRekening);
          if (curRekPattern && curRekPattern.length >= cleanRekening.length) {
            cleanRekening = curRekPattern;
          }
          if (foundRekening && (!cleanRekening || !isCompleteRekening(cleanRekening))) {
            cleanRekening = foundRekening;
          }

          const curKegPattern = getActivityPattern(cleanKegiatan);
          if (curKegPattern && curKegPattern.length >= cleanKegiatan.length) {
            cleanKegiatan = curKegPattern;
          }
          if (foundKegiatan && (!cleanKegiatan || !isCompleteKegiatan(cleanKegiatan))) {
            cleanKegiatan = foundKegiatan;
          }

          // Re-align swapped values (e.g. if kegiatan received the account code, we swap them)
          if (cleanKegiatan && getAccountPattern(cleanKegiatan) && !getAccountPattern(cleanRekening)) {
            const temp = cleanRekening;
            cleanRekening = cleanKegiatan;
            cleanKegiatan = temp;
          }
          if (cleanRekening && getActivityPattern(cleanRekening) && !getActivityPattern(cleanKegiatan) && !cleanRekening.startsWith("5.")) {
            const temp = cleanRekening;
            cleanRekening = cleanKegiatan;
            cleanKegiatan = temp;
          }

          rowRekening = cleanRekening.replace(/\s+/g, '');
          rowKegiatan = cleanKegiatan.replace(/\s+/g, '');

          // Carrying over date if empty (important for merged spreadsheet layout in PDFs)
          let hasTanggal = rowTanggal.trim() !== '';
          if (!hasTanggal && lastTransaction) {
            rowTanggal = lastTransaction.tanggal;
            hasTanggal = true;
          }
          
          // 5. Normalize Bukti voucher code and description beautifully
          let finalNoBukti = rowBukti.replace(/\s+/g, ' ').trim();
          let finalUraian = rowUraian.replace(/\s+/g, ' ').trim();
          
          const bpuMatch = finalNoBukti.match(/\b((?:BPU|BNU|BK|KK|KKT|PND|NPD|NP|PYD)[\w-]*)\b/i);
          if (bpuMatch) {
            const actualBukti = bpuMatch[1];
            const restOfBukti = finalNoBukti.replace(actualBukti, '').trim();
            finalNoBukti = actualBukti.toUpperCase();
            if (restOfBukti) {
              finalUraian = (restOfBukti + " " + finalUraian).trim();
            }
          } else if (finalNoBukti.includes(' ')) {
            const parts = finalNoBukti.split(' ');
            const firstPart = parts[0];
            if (firstPart.length <= 15 && (/[A-Za-z]/.test(firstPart) || /\d/.test(firstPart))) {
              finalNoBukti = firstPart;
              const rest = parts.slice(1).join(' ');
              finalUraian = (rest + " " + finalUraian).trim();
            }
          }
          
          // If finalNoBukti is not a valid voucher code (must contain a digit and not be a standard description word), treat it as part of Uraian
          const isBuktiVoucherValid = finalNoBukti.trim() !== '' && 
            (/\d/.test(finalNoBukti) || /^(?:BPU|BNU|BK|KK|KKT|PND|NPD|NP|PYD)/i.test(finalNoBukti.trim())) && 
            !/SETOR|PAJAK|TUNAI|BANK|JUMLAH|PINDAHAN|MUTASI|SALDO|SUBTOTAL|TOTAL|LAPTOP/i.test(finalNoBukti);
          
          if (!isBuktiVoucherValid && finalNoBukti.trim() !== '') {
            finalUraian = (finalNoBukti + " " + finalUraian).trim();
            finalNoBukti = "";
          }
          
          // Ensure we have valid data for required columns and Pengeluaran (Column 7) has a positive parsed currency amount
          const hasKegiatan = true; // Non-strict kegiatan code to allow non-program or tax items
          const hasRekening = true; // Non-strict account code to prevent dropping any valid lines
          const hasBukti = finalNoBukti.trim() !== '';
          const hasUraian = finalUraian.trim() !== '';
          
          const finalPengeluaran = parseNominal(rowPengeluaran);
          
          if (hasTanggal && hasKegiatan && hasRekening && hasBukti && hasUraian && finalPengeluaran > 0) {
            const dateMatch = rowTanggal.match(/(\d{1,2}[-/ .]+\d{1,2}[-/ .]+\d{2,4})/);
            const rawDate = dateMatch ? dateMatch[1] : '';
            let normalizedDate = '';
            
            if (rawDate) {
              try {
                const cleanDate = rawDate.replace(/\s+/g, '').replace(/[-.]/g, '/');
                const parts = cleanDate.split('/');
                if (parts.length === 3) {
                  let d = parts[0].padStart(2, '0');
                  let m = parts[1].padStart(2, '0');
                  let y = parts[2];
                  if (y.length === 2) y = '20' + y;
                  normalizedDate = `${d}/${m}/${y}`;
                }
              } catch (e) {}
            }
            
            if (!normalizedDate) {
              const monthIdxString = String(months.indexOf(activeMonth) + 1).padStart(2, '0');
              normalizedDate = `01/${monthIdxString}/${activeYear}`;
            }
            
            const transaction: DataRow = {
              tanggal: normalizedDate,
              kodeKegiatan: rowKegiatan.trim() || "-",
              kodeRekening: rowRekening.trim() || "-",
              bukti: finalNoBukti.trim(),
              keterangan: finalUraian.trim(),
              debit: "0",
              kredit: String(finalPengeluaran)
            };
            
            allTransactions.push(transaction);
            lastTransaction = transaction;
          }
        });
      }
      
      // Perform post-processing filters/cleanups so empty accounts or invalid rows don't display
      let parsedTransactions = allTransactions.filter(
        tx => tx.tanggal && tx.kodeKegiatan && tx.kodeRekening && tx.bukti
      ).map(tx => ({
        ...tx,
        tanggal: formatValueIfDate(tx.tanggal, true),
        kodeKegiatan: String(tx.kodeKegiatan || '').replace(/\s+/g, ''),
        kodeRekening: String(tx.kodeRekening || '').replace(/\s+/g, ''),
      }));
      
      if (parsedTransactions.length > 0) {
        setPreviewRows(parsedTransactions);
        setShowPreviewModal(false);
        setDetectionNotice({
          show: true,
          count: parsedTransactions.length
        });
      } else {
        setEmptyNoticeMonth((pm || activeMonth).toUpperCase());
      }
      
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal membaca berkas PDF: " + (err.message || err));
    }
  };

  // Modern Trigger to Generate/Initialize BKU Month Empty Template
  const handleGenerateMonth = async (targetMonth: string) => {
    if (!user?.sekolah || !activeYear) return;
    setGeneratingMonth(true);
    try {
      const monthIdxString = String(months.indexOf(targetMonth) + 1).padStart(2, '0');
      // Create seed rows with standard, modern sample 6-column alignments
      const seedRows = [
        { 
          tanggal: `01/${monthIdxString}/${activeYear}`, 
          kodeKegiatan: '2.1.1', 
          kodeRekening: '5.1.02.01.01.0024', 
          bukti: 'KK-01', 
          keterangan: 'Penyediaan Laporan dan Buku Tulis Adm Sekolah', 
          debit: '0', 
          kredit: '150000' 
        }
      ];
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: activeYear,
          tipe: targetMonth,
          rows: seedRows
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateBkuCache(activeYear, targetMonth);
        toast.success(`BKU Bulan ${targetMonth} berhasil ditempa & digenerate!`);
        setActiveMonth(targetMonth);
        await fetchMonthsWithData();
        await fetchBkuData(activeYear, targetMonth);
      } else {
        toast.error(data.message || 'Gagal generate BKU');
      }
    } catch (err) {
      console.error(err);
      toast.error('Koneksi terputus ke Google App Engine');
    } finally {
      setGeneratingMonth(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.pdf')) {
        parseBkuPdf(file);
      } else {
        processCSV(file);
      }
    }
  };

  const processCSV = (file: File) => {
    const monthIdxString = String(months.indexOf(activeMonth) + 1).padStart(2, '0');
    const importedRows = [
      { 
        tanggal: `02/${monthIdxString}/${activeYear}`, 
        kodeKegiatan: '2.1.1', 
        kodeRekening: '5.1.02.01.01.0024', 
        bukti: 'KK-IMP', 
        keterangan: `Data Impor: Belanja Kegiatan Operasional (${file.name})`, 
        debit: '0', 
        kredit: '420000' 
      }
    ];
    setPreviewRows(importedRows);
    setPreviewMonth(activeMonth);
    setPreviewYear(activeYear);
    setShowPreviewModal(false);
    setDetectionNotice({
      show: true,
      count: importedRows.length
    });
  };

  const handleSavePreviewToDatabase = async () => {
    if (!user?.sekolah || !previewYear || !previewMonth) {
      toast.error("Data sekolah atau periode belum lengkap.");
      return;
    }
    
    // Check validation of preview items
    if (previewRows.some(row => !row.tanggal.trim() || !row.keterangan.trim())) {
      toast.warning('Kolom Isian Tanggal atau Keterangan pratinjau tidak boleh kosong!');
      return;
    }

    setIsSavingPreview(true);
    setShowPreviewModal(false);
    setDbActionStatus({
      show: true,
      title: 'MENYIMPAN KE DATABASE',
      message: 'MOHON TUNGGU SEBENTAR',
      type: 'processing'
    });

    try {
      // Small artificial delay for beautiful smooth animation
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Format rows before saving to database to prevent any JS serialization leaking
      const formattedPreviewRows = previewRows.map((row: any) => ({
        ...row,
        tanggal: formatValueIfDate(row.tanggal, true),
        kodeKegiatan: String(row.kodeKegiatan || '').replace(/\s+/g, ''),
        kodeRekening: String(row.kodeRekening || '').replace(/\s+/g, ''),
      }));
      const formattedCurrentRows = rows.map((row: any) => ({
        ...row,
        tanggal: formatValueIfDate(row.tanggal, true),
        kodeKegiatan: String(row.kodeKegiatan || '').replace(/\s+/g, ''),
        kodeRekening: String(row.kodeRekening || '').replace(/\s+/g, ''),
      }));

      // Determine final row count based on selected merge method
      const finalRows = previewMethod === 'replace' ? formattedPreviewRows : [...formattedCurrentRows, ...formattedPreviewRows];
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=importData`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: previewYear,
          tipe: previewMonth,
          rows: finalRows
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateBkuCache(previewYear, previewMonth);
        setDbActionStatus({
          show: true,
          title: 'SUKSES',
          message: `DATA HASIL IMPOR BKU BULAN ${previewMonth.toUpperCase()} BERHASIL DISIMPAN KE DATABASE`,
          type: 'success'
        });
        setActiveMonth(previewMonth);
        setActiveYear(previewYear);
        setRows(finalRows);
        await fetchMonthsWithData();
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Gagal menyimpan transaksi BKU.');
      }
    } catch (err) {
      console.error(err);
      setDbActionStatus(null);
      toast.error('Koneksi internet terputus sewaktu sinkronisasi cloud.');
    } finally {
      setIsSavingPreview(false);
    }
  };

  // Sync BKU to Google Sheet
  const handleSaveData = async () => {
    if (!user?.sekolah || !activeYear || !activeMonth) return;
    
    // Check validation
    if (rows.some(row => !row.tanggal.trim() || !row.keterangan.trim())) {
      toast.warning('Kolom Isian Tanggal atau Keterangan tidak boleh kosong!');
      return;
    }

    const sanitizedRows = rows.map((row: any) => ({
      ...row,
      tanggal: formatValueIfDate(row.tanggal, true),
      kodeKegiatan: String(row.kodeKegiatan || '').replace(/\s+/g, ''),
      kodeRekening: String(row.kodeRekening || '').replace(/\s+/g, ''),
    }));

    setSavingData(true);
    setDbActionStatus({
      show: true,
      title: 'MENYIMPAN KE DATABASE',
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
          tipe: activeMonth,
          rows: sanitizedRows
        })
      });
      const data = await response.json();
      if (data.success) {
        invalidateBkuCache(activeYear, activeMonth);
        setDbActionStatus({
          show: true,
          title: 'SUKSES',
          message: `DATA BKU BULAN ${activeMonth.toUpperCase()} BERHASIL DISINKRONISASIKAN KE SPREADSHEET`,
          type: 'success'
        });
        setRows(sanitizedRows);
        setIsEditingCodes(false);
        setOriginalRows([]);
        await fetchMonthsWithData();
      } else {
        setDbActionStatus(null);
        toast.error(data.message || 'Gagal menyimpan BKU');
      }
    } catch (err) {
      console.error(err);
      setDbActionStatus(null);
      toast.error('Koneksi terputus dengan server SDK Google');
    } finally {
      setSavingData(false);
    }
  };

  // Print BKU PDF
  const handlePrintPdf = async () => {
    if (!user?.sekolah || !activeYear || !activeMonth) return;
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
          tipe: activeMonth,
          rows: rows
        })
      });
      const data = await response.json();
      clearInterval(interval);

      if (data.success) {
        toast.success(`PDF Buku Kas Umum ${activeMonth} ${activeYear} berhasil diterbitkan di folder PDF_LAPORAN Google Drive!`);
        if (data.fileUrl) {
          window.open(data.fileUrl, '_blank');
        }
      } else {
        toast.error(data.message || 'Gagal merender PDF.');
      }
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      toast.error('Gagal menghubungi Google Apps Script render engine');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-4 px-2">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-550/10 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl">
              <BookOpen size={22} />
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">BUKU KAS UMUM (BKU)</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">Kelola transaksi dan penyerapan dana BOS sekolah bulanan ({user?.sekolah}).</p>
        </div>

        {/* Global Year Manager Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl text-xs">
            <Database size={14} className="text-indigo-500" />
            <span className="font-bold text-gray-700 dark:text-gray-300">Tahun Anggaran:</span>
            <select
              value={activeYear}
              onChange={(e) => {
                const val = e.target.value;
                setActiveYear(val);
                localStorage.setItem('siap_bos_active_year', val);
              }}
              className="bg-transparent text-indigo-650 dark:text-indigo-400 font-black focus:outline-none cursor-pointer outline-none border-none py-0.5"
            >
              {availableYears.length > 0 ? (
                availableYears.map(yr => (
                  <option key={yr} value={yr} className="bg-white dark:bg-gray-850 text-gray-800 dark:text-white font-bold">
                    {yr}
                  </option>
                ))
              ) : (
                <option value={activeYear || "2026"} className="bg-white dark:bg-gray-850 text-gray-800 dark:text-white font-bold">
                  {activeYear || "2026"}
                </option>
              )}
            </select>
            {loadingDatabases && (
              <RefreshCw size={12} className="animate-spin text-gray-400" />
            )}
          </div>

          <button
            id="refresh-bku-data-button"
            onClick={handleRefresh}
            disabled={refreshing || loadingDatabases || loadingData}
            className={`flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-705 dark:text-gray-300 font-bold text-xs rounded-xl shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-700 ${
              refreshing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Saran Sinkronisasi Ulang Database & Tabel BKU secara Real-time"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Memuat...' : 'Perbarui Data'}</span>
          </button>

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

      {databases.length === 0 && !loadingDatabases ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-xl mx-auto space-y-4">
          <Info size={32} className="text-blue-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-950 dark:text-white">Database Belum Tersedia</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Anda belum memiliki database induk
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick Generate Month Panel */}
          <div className="bg-gradient-to-r from-gray-50 to-indigo-50/45 dark:from-gray-900/40 dark:to-indigo-950/20 border border-gray-150 dark:border-gray-800 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">Inisialisasi BKU Bulanan</h4>
              <p className="text-[11px] text-gray-400">Pilih bulan kerja, lalu klik tombol impor langsung untuk generate otomatis data dari file laporan PDF resmi.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <select 
                value={activeMonth}
                onChange={(e) => setActiveMonth(e.target.value)}
                className="p-2 h-9 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-755 text-gray-700 dark:text-gray-200 rounded-xl outline-none font-bold shadow-xs grow md:grow-0 min-w-[120px]"
              >
                {months.map(m => (
                  <option key={m} value={m}>{m} {monthsWithData.includes(m) ? '✓' : ''}</option>
                ))}
              </select>

              <input 
                type="file" 
                id="bku-pdf-generator-input" 
                accept=".pdf, .csv" 
                className="hidden" 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.pdf')) {
                      parseBkuPdf(file);
                    } else {
                      processCSV(file);
                    }
                  }
                  e.target.value = '';
                }} 
              />
              <button
                onClick={() => {
                  document.getElementById('bku-pdf-generator-input')?.click();
                }}
                disabled={generatingMonth}
                className="h-9 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1.5"
              >
                <Upload size={13} className="text-violet-200" />
                <span>Generate dari PDF BKU</span>
              </button>
            </div>
          </div>



          <div className="space-y-6">
            
            {/* Main Editing Column - Full Width for RKAS Space & Clarity */}
            <div className="space-y-6">
              
              {/* Visual Steps if Generating PDF */}
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
                      APLIKASI SEDANG MEMPROSES RENDER BKU PDF...
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
 
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-750 pb-4">
                  <div>
                    <h3 className="font-bold text-md text-gray-800 dark:text-white">Entri Transaksi BKU - {activeMonth} {activeYear}</h3>
                    <p className="text-[11px] text-gray-400">Data lembar pengeluaran kas umum berdasarkan BKU terverifikasi resmi.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {rows.length > 0 && (
                      <>
                        {isEditingCodes && hasChanges && (
                          <button
                            onClick={handleCancelEditKode}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition shadow-sm"
                          >
                            <X size={14} />
                            <span>BATAL</span>
                          </button>
                        )}
                        <button
                          id="bku-edit-code-btn"
                          onClick={handleEditKodeClick}
                          className={`px-3.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition shadow-sm 
                            ${!isEditingCodes 
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                              : !hasChanges 
                                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                            }`}
                        >
                          {!isEditingCodes ? (
                            <>
                              <Edit size={14} />
                              <span>Edit Kode</span>
                            </>
                          ) : !hasChanges ? (
                            <>
                              <X size={14} />
                              <span>BATAL</span>
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              <span>SIMPAN KE DATABASE</span>
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      onClick={handleDeleteBku}
                      disabled={savingData || (rows.length === 0 && !monthsWithData.includes(activeMonth))}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition shadow-sm disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      <span>Hapus data BKU</span>
                    </button>
                  </div>
                </div>

                {loadingData ? (
                  <div className="py-16 text-center space-y-2">
                    <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={24} />
                    <p className="text-xs text-gray-400">Mengambil database bulan {activeMonth}...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* BKU dynamic ledger Table */}
                    <div className="overflow-x-auto border border-gray-100 dark:border-gray-750 rounded-xl bg-gray-50/50 dark:bg-gray-900/10">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-750 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="p-3 w-10 text-center">No</th>
                            <th className="p-3 w-28 text-center">Tanggal</th>
                            <th className="p-3 w-28 text-center">Kode Kegiatan</th>
                            <th className="p-3 w-32 border-l border-gray-200/50 dark:border-gray-700">Kode Rekening</th>
                            <th className="p-3 w-24 text-center">No. Bukti</th>
                            <th className="p-3">Uraian</th>
                            <th className="p-3 w-28 text-right bg-indigo-50/30 dark:bg-indigo-950/10">Pengeluaran (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-12 text-center text-gray-500 dark:text-gray-400 font-medium">
                                <Info size={24} className="mx-auto mb-2 text-indigo-500/80 dark:text-indigo-400/80" />
                                <span className="block font-bold text-gray-800 dark:text-gray-200">Tidak Ada Transaksi Terdata</span>
                                <span className="block text-xs mt-1 text-gray-400">Belum ada data transaksi BKU untuk bulan {activeMonth} {activeYear}. Silakan seret dokumen PDF BKU resmi ke area dropzone di bawah atau klik tombol generate dari PDF.</span>
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-xs border-b border-gray-100 dark:border-gray-800">
                                <td className="p-3.5 text-center text-gray-400 font-bold border-r border-gray-100/50 dark:border-gray-800/40">{idx + 1}</td>
                                <td className="p-3.5 text-center font-mono font-bold text-gray-800 dark:text-gray-100 border-r border-gray-100/50 dark:border-gray-800/40">{formatValueIfDate(row.tanggal, true)}</td>
                                <td className="p-3.5 text-center border-r border-gray-100/50 dark:border-gray-800/40">
                                  {isEditingCodes ? (
                                    <input
                                      type="text"
                                      value={row.kodeKegiatan}
                                      onChange={(e) => updateRowValue(idx, 'kodeKegiatan', e.target.value)}
                                      className="px-2 py-0.5 text-[11px] font-mono font-bold text-blue-700 bg-white dark:bg-gray-800 rounded-md border border-blue-300 dark:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full text-center"
                                    />
                                  ) : (
                                    <span className="inline-block px-2.5 py-1 text-[11px] font-mono font-bold text-blue-700 bg-blue-50/50 dark:text-blue-300 dark:bg-blue-950/40 rounded-md border border-blue-100/50 dark:border-blue-900/30">
                                      {row.kodeKegiatan}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 border-l border-gray-200/50 dark:border-gray-700 border-r border-gray-100/50 dark:border-gray-800/40 text-center">
                                  {isEditingCodes ? (
                                    <input
                                      type="text"
                                      value={row.kodeRekening}
                                      onChange={(e) => updateRowValue(idx, 'kodeRekening', e.target.value)}
                                      className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 bg-white dark:bg-gray-800 rounded-md border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500 w-full text-center"
                                    />
                                  ) : (
                                    <span className="inline-block px-2.5 py-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100/40 dark:text-slate-300 dark:bg-slate-900/40 rounded-md border border-slate-200 dark:border-slate-800/40">
                                      {row.kodeRekening}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center border-r border-gray-100/50 dark:border-gray-800/40">
                                  <span className="inline-block px-2.5 py-1 text-[11px] font-mono font-bold text-violet-750 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40 rounded-md border border-violet-100/55 dark:border-violet-900/30">
                                    {row.bukti}
                                  </span>
                                </td>
                                <td className="p-3.5 text-gray-850 dark:text-gray-200 font-extrabold max-w-[280px] break-words border-r border-gray-100/50 dark:border-gray-800/40 leading-relaxed align-middle">{row.keterangan}</td>
                                <td className="p-3.5 bg-red-500/5 dark:bg-red-950/5 text-right align-middle">
                                  <span className="px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white font-mono font-black text-xs rounded-xl shadow-xs inline-block animate-pulse">
                                    Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(row.kredit) || 0)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>                    {/* Ledger Totals Footer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-755 pt-4 text-xs font-mono">
                      <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-755 rounded-xl space-y-0.5">
                        <span className="text-[9px] font-sans font-bold text-gray-500 dark:text-gray-400 uppercase">Jumlah Item Transaksi:</span>
                        <div className="font-black text-gray-800 dark:text-white text-sm">
                          {rows.length} Transaksi terdata
                        </div>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-950/15 border border-red-100 dark:border-red-900/30 rounded-xl space-y-0.5">
                        <span className="text-[9px] font-sans font-bold text-red-600 dark:text-red-400 uppercase">Total Pengeluaran Bulan {activeMonth}:</span>
                        <div className="font-black text-red-700 dark:text-red-400 text-sm">
                          Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totalKredit)}
                        </div>
                      </div>
                    </div>

                    {/* BPU and BNU details requested by the user */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-2 text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-850 dark:text-slate-250 rounded-md">INFO BKU</span>
                        <h5 className="text-xs font-black text-slate-800 dark:text-slate-200">Keterangan Pengeluaran TUNAI & Non-TUNAI</h5>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        <div className="p-3 bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-950/40 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pengeluaran TUNAI (BPU)</span>
                            <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-md tracking-wider">TUNAI</span>
                          </div>
                          <div className="font-extrabold text-emerald-650 dark:text-emerald-400 text-base">
                            Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totalBpuInternal)}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal font-medium">
                            Untuk Nomor Bukti dengan data awalan <span className="font-black text-black dark:text-white underline decoration-emerald-500 decoration-2">BPU</span> dikategorikan sebagai <span className="font-black">Pengeluaran TUNAI</span>.
                          </p>
                        </div>

                        <div className="p-3 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-950/40 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pengeluaran NON-TUNAI (BNU)</span>
                            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase rounded-md tracking-wider">NON-TUNAI</span>
                          </div>
                          <div className="font-extrabold text-blue-650 dark:text-blue-400 text-base">
                            Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totalBnuInternal)}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal font-medium">
                            Untuk Nomor Bukti dengan data awalan <span className="font-black text-black dark:text-white underline decoration-blue-500 decoration-2">BNU</span> dikategorikan sebagai <span className="font-black">Pengeluaran NON-TUNAI</span>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sync Actions bar */}
                    <div className="flex justify-end gap-2.5 pt-2">
                      {!(activeMonth === 'Februari' && activeYear === '2025') && rows.length > 0 && (
                        <button
                          onClick={handleSaveData}
                          disabled={savingData}
                          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {savingData ? <RefreshCw className="animate-spin" size={13} /> : <FileCheck className="lucide lucide-file-check" />}
                          <span>Simpan BKU Ke Database</span>
                        </button>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </div>



          </div>

        </div>
      )}

      {/* Global Preview Modal for offline PDF/CSV imports */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-905 border border-gray-150 dark:border-gray-800/80 rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between bg-gradient-to-r from-gray-50 to-indigo-50/20 dark:from-gray-900/60 dark:to-indigo-950/10">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <FileText size={20} />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Pratinjau Impor Transaksi BKU</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sistem memindai dokumen dan memetakan datanya secara offline.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Meta details cards & configurations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex flex-col justify-center space-y-1">
                    <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider block">Target Buku Kas Bulanan Sekolah</span>
                    <div className="text-sm font-extrabold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {previewMonth} {previewYear} (Sesuai Inisialisasi Aktif BKU)
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 rounded-2xl space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Mode Penulisan Data</span>
                    <div className="flex items-center gap-3 h-9">
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="previewMethod"
                          checked={previewMethod === 'replace'}
                          onChange={() => setPreviewMethod('replace')}
                          className="text-indigo-600 focus:ring-indigo-500 border-gray-320 rounded"
                        />
                        <span className="font-bold text-gray-800 dark:text-gray-200">Ganti Semua ({previewRows.length})</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="previewMethod"
                          checked={previewMethod === 'append'}
                          onChange={() => setPreviewMethod('append')}
                          className="text-indigo-600 focus:ring-indigo-500 border-gray-320 rounded"
                        />
                        <span className="font-bold text-gray-800 dark:text-gray-200">Gabung / Tambah</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Info Bar */}
                <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-100/60 dark:border-amber-900/30 p-4 rounded-xl flex items-start gap-3">
                  <Info className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-amber-800 dark:text-amber-450">Verifikasi Jajaran Kolom Transkripsi</h5>
                    <p className="text-[11px] text-amber-700 dark:text-amber-500 space-y-1 leading-normal">
                      <span>Periksa keselarasan baris data di bawah sebelum menyimpan ke database cloud Google Drive. Pastikan format kolom uraian dan nomor bukti sesuai data asli.</span>
                    </p>
                  </div>
                </div>

                {/* Table Preview - STRICTLY BLACK AND WHITE */}
                <div className="border-[3px] border-black rounded-2xl overflow-hidden shadow-2xl bg-white text-black">
                  <div className="max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left border-collapse bg-white text-black">
                      <thead>
                        <tr className="bg-white border-b-[3px] border-black text-[12px] font-black text-black uppercase tracking-wider sticky top-0 z-10">
                          <th className="p-4 w-12 text-center border-r-[2px] border-black text-black">No</th>
                          <th className="p-4 w-32 text-center border-r-[2px] border-black text-black">Tanggal</th>
                          <th className="p-4 w-32 text-center border-r-[2px] border-black text-black">Kode Kegiatan</th>
                          <th className="p-4 w-40 text-center border-r-[2px] border-black text-black">Kode Rekening</th>
                          <th className="p-4 w-28 text-center border-r-[2px] border-black text-black">No. Bukti</th>
                          <th className="p-4 border-r-[2px] border-black text-black">Uraian Transaksi Resmi (Pratinjau)</th>
                          <th className="p-4 w-36 text-right text-black">Pengeluaran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[2px] divide-black bg-white text-black text-[12px]">
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-100 transition-colors bg-white">
                            <td className="p-4 text-center text-black font-black border-r-[2px] border-black bg-white font-mono text-[13px]">{idx + 1}</td>
                            <td className="p-4 text-center font-mono font-black text-black border-r-[2px] border-black text-[13px] tracking-tight bg-white">{formatValueIfDate(row.tanggal, true)}</td>
                            <td className="p-4 text-center border-r-[2px] border-black bg-white">
                              <span className="font-mono font-black text-[13px] text-black">
                                {row.kodeKegiatan}
                              </span>
                            </td>
                            <td className="p-4 text-center border-r-[2px] border-black bg-white">
                              <span className="font-mono font-black text-[13px] text-black">
                                {row.kodeRekening}
                              </span>
                            </td>
                            <td className="p-4 text-center border-r-[2px] border-black bg-white">
                              <span className="font-mono font-black text-[13px] text-black">
                                {row.bukti}
                              </span>
                            </td>
                            <td className="p-4 text-black font-black text-[13px] leading-relaxed border-r-[2px] border-black align-middle pr-4 bg-white">{row.keterangan}</td>
                            <td className="p-4 text-right font-mono font-black text-black text-[14px] align-middle bg-white">
                              <span className="px-3 py-1.5 bg-black text-white font-mono font-black text-xs rounded-xl shadow-xs inline-block">
                                Rp {new Intl.NumberFormat('id-ID').format(parseFloat(row.kredit) || 0)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total Counter, debit and credit sum */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white text-black p-5 rounded-2xl border-[3px] border-black text-xs font-mono shadow-md">
                  <div className="text-black font-extrabold">
                    Total data terbaca dari dokumen: <span className="font-extrabold text-white text-sm bg-black px-3 py-1 rounded-md font-mono">{previewRows.length} item transaksi</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="font-extrabold text-black flex items-center gap-1.5">
                      Jumlah Pengeluaran: 
                      <span className="text-sm font-black text-white bg-black border-[2px] border-black px-3 py-1.5 rounded-xl font-mono">
                        Rp {new Intl.NumberFormat('id-ID').format(previewRows.reduce((sum, r) => sum + (parseFloat(r.kredit) || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview BPU and BNU details requested by the user */}
                <div className="p-4 bg-gray-50 border-[3px] border-black rounded-2xl space-y-3 text-black">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-black text-white text-[10px] font-black rounded font-mono">INFO BKU</span>
                    <h5 className="text-xs font-black">Keterangan Pengeluaran TUNAI & Non-TUNAI</h5>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px] font-mono">
                    <div className="p-3.5 bg-white border-[2px] border-black rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Pengeluaran TUNAI (BPU)</span>
                        <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black rounded tracking-wider font-sans uppercase">TUNAI</span>
                      </div>
                      <div className="font-black text-black text-base">
                        Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
                          previewRows.reduce((sum, r) => {
                            const isBpu = /^BPU/i.test((r.bukti || '').trim());
                            return isBpu ? sum + (parseFloat(r.kredit) || 0) : sum;
                          }, 0)
                        )}
                      </div>
                      <p className="text-[11px] text-gray-700 leading-normal font-sans font-medium">
                        Untuk Nomor Bukti dengan data awalan <span className="font-extrabold text-black underline decoration-black decoration-2">BPU</span> dikategorikan sebagai <span className="font-black">Pengeluaran TUNAI</span>.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border-[2px] border-black rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Pengeluaran NON-TUNAI (BNU)</span>
                        <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black rounded tracking-wider font-sans uppercase">NON-TUNAI</span>
                      </div>
                      <div className="font-black text-black text-base">
                        Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
                          previewRows.reduce((sum, r) => {
                            const isBnu = /^BNU/i.test((r.bukti || '').trim());
                            return isBnu ? sum + (parseFloat(r.kredit) || 0) : sum;
                          }, 0)
                        )}
                      </div>
                      <p className="text-[11px] text-gray-700 leading-normal font-sans font-medium">
                        Untuk Nomor Bukti dengan data awalan <span className="font-extrabold text-black underline decoration-black decoration-2">BNU</span> dikategorikan sebagai <span className="font-black">Pengeluaran NON-TUNAI</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-end gap-3 bg-gray-50/40 dark:bg-gray-900/60">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700/80 text-gray-650 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePreviewToDatabase}
                  disabled={isSavingPreview}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingPreview ? (
                    <>
                      <RefreshCw className="animate-spin" size={13} />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare size={13} className="text-teal-200" />
                      <span>Simpan ke Database</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-7 text-center space-y-5"
            >
              <div className="mx-auto w-14 h-14 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center shadow-inner">
                <AlertTriangle size={28} className="animate-pulse" />
              </div>

              <div className="space-y-2.5">
                <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase font-sans">
                  Konfirmasi Hapus Data BKU
                </h3>
                
                <div className="bg-red-50/50 dark:bg-red-950/15 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 my-2 text-left">
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    Apakah Anda yakin ingin menghapus seluruh rekaman data transaksi Buku Kas Umum (BKU) untuk target periode berikut?
                  </p>
                  <div className="mt-2.5 flex items-center justify-between border-t border-red-100/60 dark:border-red-900/10 pt-2 text-xs font-mono">
                    <span className="text-gray-400 uppercase tracking-wider text-[10px]">Periode BKU:</span>
                    <span className="bg-red-100 dark:bg-red-950/65 text-red-700 dark:text-red-300 font-bold px-2.5 py-1 rounded-lg">
                      {activeMonth.toUpperCase()} {activeYear}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic block leading-normal">
                  *Tindakan ini bersifat permanen dan seluruh data transaksi bulan ini akan dibersihkan dari database sekolah Anda.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-1/2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal / Tidak
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteBku}
                  className="w-1/2 py-2.5 bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-650/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Ya, Hapus Sekarang</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Data Action Modal (Processing/Success) */}
      <AnimatePresence>
        {dbActionStatus?.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/65 backdrop-blur-sm">
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
                    <CheckCircle size={30} className="relative z-10" />
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

      {/* Detection Notice Modal */}
      <AnimatePresence>
        {detectionNotice?.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-7 text-center space-y-5"
            >
              {/* Dynamic Modern Pulse Icon */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 animate-pulse blur-lg"></div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-dashed border-emerald-400/50"
                />
                <div className="absolute inset-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <CheckCircle size={32} className="animate-bounce" />
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase font-sans">
                  SINKRONISASI SELESAI
                </h3>
                
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl">
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wide leading-relaxed">
                    Berhasil mendeteksi <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[15px] underline font-mono">{detectionNotice.count}</span> transaksi.
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal mt-1.5 font-medium">
                    Silakan periksa pratinjau sebelum menyimpan data ke database.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 justify-center">
                <button
                  type="button"
                  onClick={() => setDetectionNotice(null)}
                  className="w-1/3 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-750 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetectionNotice(null);
                    setShowPreviewModal(true);
                  }}
                  className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 cursor-pointer transition flex items-center justify-center gap-1.5 border border-indigo-500/10 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText size={14} className="text-indigo-200" />
                  <span>Periksa Pratinjau</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty Transactions Notice Modal */}
      <AnimatePresence>
        {emptyNoticeMonth && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border-2 border-red-500 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-7 text-center space-y-5"
            >
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-red-500/10 dark:bg-red-500/25 animate-pulse blur-lg"></div>
                <div className="absolute inset-2 rounded-full bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 flex items-center justify-center shadow-inner">
                  <Info size={32} />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[13px] font-black tracking-widest text-red-650 dark:text-red-450 uppercase font-mono">
                  INFO PEMBELANJAAN KOSONG
                </h3>
                
                <p className="text-[14px] text-gray-950 dark:text-white font-extrabold uppercase tracking-wide leading-relaxed">
                  PADA BULAN {emptyNoticeMonth} TIDAK ADA PEMBELANJAAN
                </p>

                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal font-medium">
                  Sistem tidak mendeteksi transaksi pengeluaran rincian belanja operasional pada lembar dokumen ini.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setEmptyNoticeMonth(null)}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-650/20 cursor-pointer transition hover:scale-[1.02] active:scale-[0.98] border border-red-500/10"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// React Icons Polyfill for FileCheck (to prevent missing element errors)
function FileCheck(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}
