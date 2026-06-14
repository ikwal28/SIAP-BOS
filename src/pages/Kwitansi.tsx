import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { cleanGoogleSheetsDateToCode } from './Rkas';
import { 
  Receipt, Database, Printer, RefreshCw, FileText, Check, Search, Info, Calendar, User, MapPin, ClipboardList, HelpCircle, UserPlus, X
} from 'lucide-react';
import { toast } from 'sonner';

interface GeneratedDatabase {
  name: string;
  url: string;
  created: string;
  size: string;
}

interface SchoolPersonnelInfo {
  bendahara: string;
  nipBendahara: string;
  kepsek: string;
  nipKepsek: string;
  kecamatan: string;
}

interface BkuRow {
  tanggal: string;
  kodeKegiatan: string;
  kodeRekening: string;
  bukti: string;
  keterangan: string;
  debit: string;
  kredit: string;
}

interface KwitansiGroup {
  noBukti: string;
  tanggal: string;
  items: {
    keterangan: string;
    kredit: number;
    kodeKegiatan: string;
    kodeRekening: string;
  }[];
  totalKredit: number;
}

interface KwitansiPrintData {
  noKwitansi: string;
  sudahTerimaDari: string;
  terbilang: string;
  jumlahUang: number;
  untukPembayaran: string;
  tanggal: string;
  tempat: string;
  penerima: string;
  nipPenerima?: string;
  mengetahui: string;
  nipMengetahui?: string;
  kodeKegiatan?: string;
  kodeRekening?: string;
  namaKegiatan?: string;
  namaRekening?: string;
  kegiatanList?: { kode: string; nama: string }[];
  rekeningList?: { kode: string; nama: string }[];
}

// Indonesian "Terbilang" conversion helper
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

export default function Kwitansi() {
  const { user } = useAuth();
  
  // Year & Database states
  const [databases, setDatabases] = useState<GeneratedDatabase[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [activeMonth, setActiveMonth] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_month') || 'Januari';
  });

  const [monthsWithData, setMonthsWithData] = useState<string[]>([]);

  // BKU Raw Rows
  const [bkuRows, setBkuRows] = useState<BkuRow[]>([]);
  const [loadingBku, setLoadingBku] = useState(false);

  // RKAS rows for automatic code description matching
  const [rkasRows, setRkasRows] = useState<any[]>([]);
  const [loadingRkas, setLoadingRkas] = useState(false);

  // Search input to filter proof-number or description
  const [searchQuery, setSearchQuery] = useState('');

  // School personnel info
  const [schoolInfo, setSchoolInfo] = useState<SchoolPersonnelInfo>({
    bendahara: '',
    nipBendahara: '',
    kepsek: '',
    nipKepsek: '',
    kecamatan: 'Kecamatan'
  });

  // Modal print preview setup state
  const [printModalItem, setPrintModalItem] = useState<KwitansiPrintData | null>(null);

  // Final Print layout item (what's rendered inside the print CSS block)
  const [previewItem, setPreviewItem] = useState<KwitansiPrintData | null>(null);

  // Local state to manage editable recipients
  const [penerimaState, setPenerimaState] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!user?.sekolah) return;
    const saved: { [key: string]: string } = {};
    const prefix = `siap_bos_penerima_${user.sekolah}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const noBukti = key.replace(prefix, '');
        saved[noBukti] = localStorage.getItem(key) || '';
      }
    }
    setPenerimaState(saved);
  }, [user?.sekolah]);

  const handlePenerimaChange = (noBukti: string, value: string) => {
    setPenerimaState(prev => ({
      ...prev,
      [noBukti]: value
    }));
    if (user?.sekolah) {
      localStorage.setItem(`siap_bos_penerima_${user.sekolah}_${noBukti}`, value);
    }
  };

  const uniquePenerimaList = useMemo(() => {
    const list = (Object.values(penerimaState) as string[])
      .map(name => name?.trim())
      .filter((name): name is string => !!name)
      .filter((name, idx, self) => self.indexOf(name) === idx);
    return list.sort((a, b) => a.localeCompare(b));
  }, [penerimaState]);

  // State Management for "BUAT DATA PENERIMA" modal
  const [showPenerimaModal, setShowPenerimaModal] = useState(false);
  const [modalNoBukti, setModalNoBukti] = useState('');
  const [modalPenerima, setModalPenerima] = useState('');
  const [savingPenerima, setSavingPenerima] = useState(false);

  // Fetch saved receipts from Database to populate recipients
  const fetchSavedKwitansis = async (year: string, forceRefresh = false) => {
    if (!user?.sekolah || !year) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_kwitansis_${year}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const dbPenerima: { [key: string]: string } = {};
          parsed.forEach((kw: any) => {
            if (kw.noKwitansi && kw.penerima) {
              dbPenerima[kw.noKwitansi] = kw.penerima;
              localStorage.setItem(`siap_bos_penerima_${user.sekolah}_${kw.noKwitansi}`, kw.penerima);
            }
          });
          setPenerimaState(prev => ({ ...prev, ...dbPenerima }));
          return;
        } catch (e) {}
      }
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getKwitansis`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user.sekolah,
          tahun: year,
        })
      });
      const data = await response.json();
      if (data.success && data.data) {
        sessionStorage.setItem(cacheKey, JSON.stringify(data.data));
        const dbPenerima: { [key: string]: string } = {};
        data.data.forEach((kw: any) => {
          if (kw.noKwitansi && kw.penerima) {
            dbPenerima[kw.noKwitansi] = kw.penerima;
            localStorage.setItem(`siap_bos_penerima_${user.sekolah}_${kw.noKwitansi}`, kw.penerima);
          }
        });
        setPenerimaState(prev => ({ ...prev, ...dbPenerima }));
      }
    } catch (err) {
      console.error("Error fetching saved kwitansis:", err);
    }
  };

  // Function to save receipt/recipient to database
  const handleSavePenerimaToDb = async (noBukti: string, name: string) => {
    if (!noBukti) {
      toast.error('No. Bukti belum dipilih!');
      return;
    }
    if (!name.trim()) {
      toast.error('Kolom PENERIMA tidak boleh kosong!');
      return;
    }
    
    const group = groupedMap[noBukti];
    if (!group) {
      toast.error('Detail No. Bukti tidak ditemukan');
      return;
    }

    setSavingPenerima(true);
    try {
      const defaultSudahTerima = "Suku Dinas Pendidikan DKI / Kementerian Agama";
      const joinedKeterangan = group.items.map(it => it.keterangan).join('; ');

      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=saveKwitansi`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sekolah: user?.sekolah,
          tahun: activeYear,
          receipt: {
            id: `KW_${noBukti}`,
            noKwitansi: noBukti,
            sudahTerimaDari: defaultSudahTerima,
            terbilang: getTerbilangString(group.totalKredit),
            jumlahUang: group.totalKredit,
            untukPembayaran: joinedKeterangan,
            tanggal: group.tanggal,
            tempat: schoolInfo.kecamatan || 'Jakarta',
            penerima: name,
            mengetahui: schoolInfo.kepsek || '',
          }
        })
      });

      const res = await response.json();
      if (res.success) {
        invalidateKwitansiCache(activeYear, activeMonth);
        toast.success(`Data Penerima untuk No. Bukti ${noBukti} berhasil disimpan ke database!`);
        handlePenerimaChange(noBukti, name);
        setShowPenerimaModal(false);
      } else {
        toast.error(res.message || 'Gagal menyimpan ke database');
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal terhubung dengan server database');
    } finally {
      setSavingPenerima(false);
    }
  };

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Universal smart parser to avoid Javascript new Date() swapping day and month for Indonesian DD/MM/YYYY dates
  const parseSmartDate = (str: any): Date | null => {
    if (!str) return null;
    let cleanStr = String(str).trim();
    if (cleanStr === '') return null;

    // Clean parenthesized timezone strings like '(Waktu Indochina)' or '(Coordinated Universal Time)'
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

    // Look for a date token formatted as DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD or YYYY/MM/DD
    const tokens = cleanStr.split(/\s+/);
    for (const token of tokens) {
      if (token.includes('/') || token.includes('-')) {
        const parts = token.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD or YYYY/MM/DD
            const yyyy = parseInt(parts[0]);
            const mm = parseInt(parts[1]) - 1;
            const dd = parseInt(parts[2]);
            const d = new Date(yyyy, mm, dd);
            if (!isNaN(d.getTime())) return d;
          } else if (parts[2].length === 4) {
            // DD-MM-YYYY or DD/MM/YYYY
            const dd = parseInt(parts[0]);
            const mm = parseInt(parts[1]) - 1;
            const yyyy = parseInt(parts[2]);
            const d = new Date(yyyy, mm, dd);
            if (!isNaN(d.getTime())) return d;
          }
        }
      }
    }

    // Indonesian verbal format like "04 Februari 2025" or "4 Februari 2025"
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

    // Fallback to native parsing
    const fallbackDate = new Date(cleanStr);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }

    return null;
  };

  // Helper date function parsing Date strings or JSON dates
  const formatValueIfDate = (val: any, returnShortDate = false): string => {
    if (!val) return '';
    const d = parseSmartDate(val);
    if (d && !isNaN(d.getTime())) {
      if (returnShortDate) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    return String(val);
  };

  const formatNameDegreeCasing = (name: string): string => {
    if (!name) return '';
    // This helper preserves lowercase on known letters of educational/professional degrees
    return name
      .replace(/\bS\.PD\b/g, 'S.Pd')
      .replace(/\bS\.Pd\b/g, 'S.Pd')
      .replace(/\bS\.pd\b/g, 'S.Pd')
      .replace(/\bS\.PD\b/gi, 'S.Pd')
      .replace(/\bM\.PD\b/gi, 'M.Pd')
      .replace(/\bS\.Kom\b/gi, 'S.Kom')
      .replace(/\bM\.Kom\b/gi, 'M.Kom')
      .replace(/\bS\.Sos\b/gi, 'S.Sos')
      .replace(/\bPd\.I\b/gi, 'Pd.I')
      .replace(/\bS\.P\b/gi, 'S.P')
      .replace(/\bS\.ST\b/gi, 'S.ST')
      .replace(/\bS\.Psi\b/gi, 'S.Psi')
      .replace(/\bAg\b/gi, 'Ag')
      .replace(/\bS\.Ag\b/gi, 'S.Ag');
  };

  const invalidateKwitansiCache = (year = activeYear, month = activeMonth) => {
    if (!user?.sekolah) return;
    sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_databases`);
    sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_personnel`);
    if (year) {
      sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_rkas_${year}`);
      sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_kwitansis_${year}`);
      sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_bku_months_${year}`);
      if (month) {
        sessionStorage.removeItem(`siap_bos_cache_${user.sekolah}_bku_${year}_${month}`);
      }
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  // Fetch Databases list
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
            if (!match) {
              const yearMatch = parsed[0].name.match(/\d+/);
              const yr = yearMatch ? yearMatch[0] : '2026';
              setActiveYear(yr);
              localStorage.setItem('siap_bos_active_year', yr);
            }
          }
          silent = true;
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

  // Fetch school personnel to seed defaults
  const fetchSchoolPersonnel = async (forceRefresh = false) => {
    if (!user?.sekolah) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_personnel`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setSchoolInfo(JSON.parse(cached));
          return;
        } catch (e) {}
      }
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getDataSekolah`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ role: user.role, sekolah: user.sekolah })
      });
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        let rows = data.data;
        // Slice the header row if present
        if (rows[0] && (
          rows[0][0] === "ID" || 
          rows[0][0] === "id" || 
          (typeof rows[0][0] === "string" && rows[0][0].toLowerCase() === "id") || 
          rows[0][0] === "NPSN"
        )) {
          rows = rows.slice(1);
        }

        if (rows.length > 0) {
          const row = rows[0]; // Take the first row containing details of this school
          let kepsek = '';
          let nipKepsek = '';
          let bendahara = '';
          let nipBendahara = '';
          let kecamatan = 'Kecamatan';

          // Format index mappings matching DataSekolah.tsx
          if (row.length >= 9 && (row[0] && row[0].toString().length === 8 && !row[1])) {
            kecamatan = row[2] || 'Kecamatan';
            kepsek = row[5] || '';
            nipKepsek = row[6] || '';
            bendahara = row[7] || '';
            nipBendahara = row[8] || '';
          } else if (row.length >= 10) {
            kecamatan = row[3] || 'Kecamatan';
            kepsek = row[6] || '';
            nipKepsek = row[7] || '';
            bendahara = row[8] || '';
            nipBendahara = row[9] || '';
          } else {
            // General backup fallback using indices
            kepsek = row[6] || '';
            nipKepsek = row[7] || '';
            bendahara = row[8] || '';
            nipBendahara = row[9] || '';
            kecamatan = row[3] || 'Kecamatan';
          }

          const infoObj = {
            bendahara,
            nipBendahara,
            kepsek,
            nipKepsek,
            kecamatan
          };
          setSchoolInfo(infoObj);
          sessionStorage.setItem(cacheKey, JSON.stringify(infoObj));
        }
      }
    } catch (err) {
      console.error("Error fetching school personnel for receipt defaults:", err);
    }
  };

  // Fetch BKU Months status
  const fetchMonthsWithData = async (forceRefresh = false) => {
    if (!user?.sekolah || !activeYear) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_bku_months_${activeYear}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setMonthsWithData(JSON.parse(cached));
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
      console.error("Error checking BKU months for Kwitansi:", err);
      toast.error("Layanan BKU saat ini sedang tidak tersedia. Mohon periksa koneksi atau coba sesaat lagi.");
    }
  };

  // Fetch BKU transactions
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
          }));
          setBkuRows(formatted);
          return;
        } catch (e) {}
      }
    }

    setLoadingBku(true);
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
          kodeKegiatan: String(row.kodeKegiatan || '').trim(),
          kodeRekening: String(row.kodeRekening || '').trim(),
        }));
        setBkuRows(cleanedRows);
        sessionStorage.setItem(cacheKey, JSON.stringify(cleanedRows));
      } else {
        setBkuRows([]);
        sessionStorage.setItem(cacheKey, JSON.stringify([]));
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil rincian BKU dari database');
    } finally {
      setLoadingBku(false);
    }
  };

  // Fetch RKAS rows for auto-lookup
  const fetchRkasData = async (year: string, forceRefresh = false) => {
    if (!user?.sekolah || !year) return;
    const cacheKey = `siap_bos_cache_${user.sekolah}_rkas_${year}`;

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setRkasRows(JSON.parse(cached));
          return;
        } catch (e) {}
      }
    }

    setLoadingRkas(true);
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
      if (data.success && data.rows) {
        const cleanedRows = data.rows.map((row: any) => ({
          ...row,
          kode: cleanGoogleSheetsDateToCode(row.kode)
        }));
        setRkasRows(cleanedRows);
        sessionStorage.setItem(cacheKey, JSON.stringify(cleanedRows));
      } else {
        setRkasRows([]);
        sessionStorage.setItem(cacheKey, JSON.stringify([]));
      }
    } catch (err) {
      console.error("Error retrieving RKAS data for Kwitansi lookups:", err);
    } finally {
      setLoadingRkas(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateKwitansiCache(activeYear, activeMonth);
    try {
      await fetchDatabases(true, true);
      await fetchSchoolPersonnel(true);
      await fetchSavedKwitansis(activeYear, true);
      await fetchRkasData(activeYear, true);
      await fetchBkuData(activeYear, activeMonth, true);
      await fetchMonthsWithData(true);
      toast.success('Data Kwitansi berhasil diperbarui!');
    } catch (err) {
      toast.error('Gagal memperbarui data Kwitansi');
    } finally {
      setRefreshing(false);
    }
  };

  const findRkasDescriptions = (kodeKeg: string, kodeRek: string) => {
    const rawKodeKeg = cleanGoogleSheetsDateToCode(String(kodeKeg || '').trim());
    const rawKodeRek = cleanGoogleSheetsDateToCode(String(kodeRek || '').trim());

    // Helper to strip leading/trailing spaces and dots
    const cleanCodeSegment = (s: string) => {
      return String(s || '').trim().replace(/^\.*|\.*$/g, '');
    };

    // Robust normalizer specifically designed to remove ALL whitespace, leading/trailing dots so "5.1.02.01.01.00 24" becomes "5.1.02.01.01.0024"
    const normalizeCodeForMatch = (s: string) => {
      let temp = String(s || '').trim().toLowerCase();
      // Remove all spaces
      temp = temp.replace(/\s+/g, '');
      // Remove legacy trailing and leading dots
      temp = temp.replace(/^\.+|\.+$/g, '');
      return temp;
    };

    // Ultimate fallback that strips everything except alphanumeric characters
    const cleanAlphanumeric = (s: string) => {
      return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const bkuKegNorm = normalizeCodeForMatch(rawKodeKeg);
    const bkuRekNorm = normalizeCodeForMatch(rawKodeRek);

    const bkuKegAlpha = cleanAlphanumeric(rawKodeKeg);
    const bkuRekAlpha = cleanAlphanumeric(rawKodeRek);

    const parseRkasKode = (kodeStr: string) => {
      const cleanStr = String(kodeStr || '').trim();
      if (cleanStr.includes(' - ')) {
        const parts = cleanStr.split(' - ');
        return {
          keg: parts[0]?.trim() || '',
          rek: parts[1]?.trim() || ''
        };
      } else if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        return {
          keg: parts[0]?.trim() || '',
          rek: parts.slice(1).join('-').trim() || ''
        };
      }
      
      // If there is no "-" separator:
      // In RKAS, accounts (belanja/rekening) always start with "5."
      if (cleanStr.startsWith('5.')) {
        return {
          keg: '',
          rek: cleanStr
        };
      } else {
        return {
          keg: cleanStr,
          rek: ''
        };
      }
    };

    // Parse all RKAS rows to keep original and various normalized representations
    const rkasRowsParsed = (rkasRows || []).map(r => {
      const parsed = parseRkasKode(r.kode);
      return {
        originalRow: r,
        keg: parsed.keg,
        rek: parsed.rek,
        normKeg: normalizeCodeForMatch(parsed.keg),
        normRek: normalizeCodeForMatch(parsed.rek),
        alphaKeg: cleanAlphanumeric(parsed.keg),
        alphaRek: cleanAlphanumeric(parsed.rek),
        rincian: r.rincian || ''
      };
    });

    let matchedRekRow: any = null;

    // 1. Find Rekening match
    if (bkuKegNorm && bkuRekNorm) {
      // 1.1 Match both Kegiatan AND Rekening exactly (by normalized spaces & dots)
      matchedRekRow = rkasRowsParsed.find(r => 
        r.normKeg === bkuKegNorm && r.normRek === bkuRekNorm && r.normRek !== ''
      );
      
      // 1.2 Match both Kegiatan AND Rekening alphanumeric fallback
      if (!matchedRekRow) {
        matchedRekRow = rkasRowsParsed.find(r => 
          r.alphaKeg === bkuKegAlpha && r.alphaRek === bkuRekAlpha && r.alphaRek !== ''
        );
      }

      // 1.3 Substring match on Rekening, but must match Kegiatan
      if (!matchedRekRow) {
        matchedRekRow = rkasRowsParsed.find(r => 
          r.alphaKeg === bkuKegAlpha && 
          r.alphaRek !== '' && 
          (r.alphaRek.startsWith(bkuRekAlpha) || bkuRekAlpha.startsWith(r.alphaRek))
        );
      }
    }

    // 2. Fallbacks for Rekening match if the combined query yielded nothing (maybe kegiatan is empty or mismatching)
    if (!matchedRekRow && bkuRekNorm) {
      // 2.1 Match Rekening by normalizeCodeForMatch
      matchedRekRow = rkasRowsParsed.find(r => r.normRek === bkuRekNorm && r.normRek !== '');
    }
    if (!matchedRekRow && bkuRekAlpha) {
      // 2.2 Match Rekening alphanumeric
      matchedRekRow = rkasRowsParsed.find(r => r.alphaRek === bkuRekAlpha && r.alphaRek !== '');
    }
    if (!matchedRekRow && bkuRekAlpha) {
      // 2.3 Match Rekening substring
      matchedRekRow = rkasRowsParsed.find(r => 
        r.alphaRek !== '' && 
        (r.alphaRek.startsWith(bkuRekAlpha) || bkuRekAlpha.startsWith(r.alphaRek))
      );
    }

    // 3. Find Kegiatan match
    let matchedKegRow: any = null;
    if (bkuKegNorm) {
      // 3.1 Match Kegiatan exactly as a Header (no Rekening code in RKAS)
      matchedKegRow = rkasRowsParsed.find(r => 
        r.normKeg === bkuKegNorm && r.normRek === ''
      );
      
      // 3.2 Match Kegiatan alphanumeric as a Header (no Rekening code in RKAS)
      if (!matchedKegRow) {
        matchedKegRow = rkasRowsParsed.find(r => 
          r.alphaKeg === bkuKegAlpha && r.alphaRek === ''
        );
      }

      // 3.3 Any matching Kegiatan (header or not)
      if (!matchedKegRow) {
        matchedKegRow = rkasRowsParsed.find(r => r.normKeg === bkuKegNorm);
      }
      if (!matchedKegRow) {
        matchedKegRow = rkasRowsParsed.find(r => r.alphaKeg === bkuKegAlpha);
      }
    }

    let namaKegiatan = matchedKegRow ? matchedKegRow.rincian : '';
    let namaRekening = matchedRekRow ? matchedRekRow.rincian : '';

    // If still empty after RKAS lookup, use hardcoded default mappings
    const resolvedKodeKeg = bkuKegNorm ? rawKodeKeg : (cleanCodeSegment(rawKodeKeg) || rawKodeKeg);
    const resolvedKodeRek = bkuRekNorm ? rawKodeRek : (cleanCodeSegment(rawKodeRek) || rawKodeRek);

    if (!namaKegiatan && resolvedKodeKeg) {
      const normalizedKeg = resolvedKodeKeg.replace(/\.*$/, '');
      if (normalizedKeg === '05.02.01') namaKegiatan = 'Penerimaan Peserta Didik Baru';
      else if (normalizedKeg === '05.03.01') namaKegiatan = 'Pengembangan Perpustakaan';
      else if (normalizedKeg === '05.04.01') namaKegiatan = 'Pelaksanaan Kegiatan Pembelajaran dan Ekstrakurikuler';
      else if (normalizedKeg === '05.05.01') namaKegiatan = 'Pelaksanaan Kegiatan Evaluasi Pembelajaran';
      else if (normalizedKeg === '05.06.01') namaKegiatan = 'Pelaksanaan Administrasi Kegiatan Sekolah';
      else if (normalizedKeg === '05.07.01') namaKegiatan = 'Pengembangan Profesi Guru dan Tenaga Kependidikan';
      else if (normalizedKeg === '05.08.01') namaKegiatan = 'Langganan Daya dan Jasa';
      else if (normalizedKeg === '06.05.08' || normalizedKeg.includes('06.05.08') || normalizedKeg === '05.08.03') {
        namaKegiatan = 'Pembelian Bahan Habis Pakai untuk mendukung pembelajaran dan administrasi sekolah (termasuk ATK, Tinta Printer, Kabel Ekstension, dsb)';
      }
      else if (normalizedKeg === '05.08.04') namaKegiatan = 'Pemeliharaan Sarana dan Prasarana Sekolah';
      else if (normalizedKeg === '05.09.01') namaKegiatan = 'Penyediaan Alat Multi Media Pembelajaran';
      else namaKegiatan = 'Pemeliharaan Peralatan Sekolah';
    }

    if (!namaRekening && resolvedKodeRek) {
      const normCheck = resolvedKodeRek.replace(/\s+/g, '');
      if (normCheck.startsWith('5.1.02.01')) {
        namaRekening = 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor';
      }
      else if (normCheck.startsWith('5.1.02.03.02.0115') || normCheck.includes('0115')) {
        namaRekening = 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Reproduksi(Penggandaan) / Pemeliharaan Printer';
      }
      else if (normCheck.startsWith('5.1.02.03')) {
        namaRekening = 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga';
      }
      else if (normCheck.startsWith('5.1.02.02.01')) {
        namaRekening = 'Belanja Bahan/Material';
      }
      else {
        namaRekening = 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor';
      }
    }

    return { 
      kodeKegiatan: matchedKegRow ? matchedKegRow.keg : (resolvedKodeKeg || '05.08.03'),
      kodeRekening: matchedRekRow ? matchedRekRow.rek : (resolvedKodeRek || '5.1.02.03.02.0115'),
      namaKegiatan: namaKegiatan || 'Pembelian Bahan Habis Pakai untuk mendukung pembelajaran dan administrasi sekolah (termasuk ATK, Tinta Printer, Kabel Ekstension, dsb)', 
      namaRekening: namaRekening || 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor',
      hasKegMatch: !!matchedKegRow,
      hasRekMatch: !!matchedRekRow 
    };
  };

  useEffect(() => {
    if (user?.sekolah) {
      // Clear legacy BKU cache to ensure fresh correct dates are fetched and formatted correctly
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.includes('_bku_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => sessionStorage.removeItem(k));
      } catch (e) {}

      fetchDatabases();
      fetchSchoolPersonnel();
    }
  }, [user]);

  useEffect(() => {
    if (activeYear && activeMonth) {
      fetchBkuData(activeYear, activeMonth);
      fetchMonthsWithData();
      fetchSavedKwitansis(activeYear);
      fetchRkasData(activeYear);
    }
  }, [activeYear, activeMonth]);

  const handleYearChange = (year: string) => {
    setActiveYear(year);
    localStorage.setItem('siap_bos_active_year', year);
  };

  const handleMonthChange = (month: string) => {
    setActiveMonth(month);
    localStorage.setItem('siap_bos_active_month', month);
  };

  // Filter BKU data for valid credit rows that contains a valid proof number
  const validBkuRows = bkuRows.filter(row => {
    const isKreditNonZero = parseFloat(row.kredit) > 0;
    const hasBukti = row.bukti && row.bukti.trim() !== '' && row.bukti.trim() !== '-';
    return hasBukti && isKreditNonZero;
  });

  // Group credit rows by No. Bukti
  const groupedMap: { [key: string]: KwitansiGroup } = {};

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

  const groupedKwitansis = Object.values(groupedMap);

  // Filter groups by user search input query
  const filteredGroupedKwitansis = groupedKwitansis.filter(g => {
    const q = searchQuery.toLowerCase();
    const matchBukti = g.noBukti.toLowerCase().includes(q);
    const matchTanggal = g.tanggal.toLowerCase().includes(q);
    const matchUraian = g.items.some(item => item.keterangan.toLowerCase().includes(q));
    return matchBukti || matchTanggal || matchUraian;
  });

  // Open configuration model before running physical system print
  const openPrintSetup = (group: KwitansiGroup) => {
    const keyPenerima = `siap_bos_penerima_${user?.sekolah || ''}_${group.noBukti}`;
    const savedPenerima = localStorage.getItem(keyPenerima) || penerimaState[group.noBukti] || '';
    
    // Default sudahTerimaDari: "BENDAHARA BOS [NAMA SEKOLAH]"
    const schoolName = String(user?.sekolah || 'SD NEGERI 2 LAOT TADU').toUpperCase();
    const defaultSudahTerima = `BENDAHARA BOS ${schoolName}`;
    
    // Join descriptions with high contrast spacing
    const joinedKeterangan = group.items.map(it => it.keterangan).join('; ');
    
    // Choose the first item that has a non-empty Account Code starting with '5.', fallback to the absolute first item
    const firstItem = group.items.find(it => it.kodeRekening && it.kodeRekening.trim().startsWith('5.')) || group.items[0] || { kodeKegiatan: '', kodeRekening: '' };
    const { kodeKegiatan: resolvedKeg, kodeRekening: resolvedRek, namaKegiatan, namaRekening } = findRkasDescriptions(firstItem.kodeKegiatan, firstItem.kodeRekening);
    
    // Helper to validate kegiatan codes (preventing date/corrupt numerical entries like "1050000")
    const isValidKegiatanCode = (code: string, hasRkasMatch: boolean): boolean => {
      const cleaned = String(code || '').trim();
      if (!cleaned || cleaned === '-' || cleaned === '0') return false;
      if (hasRkasMatch) return true;
      // Must look like a standard RKAS kegiatan code (e.g. starts with '0' followed by digits and a dot)
      return /^0\d\./.test(cleaned);
    };

    // Collect all unique Kode Kegiatan and Kode Rekening, with their respective names
    const kegiatanList: { kode: string; nama: string }[] = [];
    const rekeningList: { kode: string; nama: string }[] = [];
    const seenKegs = new Set<string>();
    const seenReks = new Set<string>();

    group.items.forEach(it => {
      const pureKeg = String(it.kodeKegiatan || '').replace(/\s+/g, '').trim();
      const pureRek = String(it.kodeRekening || '').replace(/\s+/g, '').trim();
      
      // ONLY process if it's a valid expense account (starting with '5.'). Excludes tax/liability accounts.
      if (pureRek && pureRek.startsWith('5.')) {
        if (pureKeg) {
          const res = findRkasDescriptions(pureKeg, '');
          const kegCode = res.kodeKegiatan;
          const kegName = res.namaKegiatan;
          const hasKegMatch = res.hasKegMatch;

          if (isValidKegiatanCode(kegCode || pureKeg, hasKegMatch)) {
            const normKegKey = String(kegCode || pureKeg)
              .replace(/\s+/g, '')
              .replace(/^\.+|\.+$/g, '')
              .toLowerCase();

            if (!seenKegs.has(normKegKey)) {
              seenKegs.add(normKegKey);
              kegiatanList.push({ kode: kegCode || pureKeg, nama: kegName });
            }
          }
        }

        const resRek = findRkasDescriptions('', pureRek);
        const rekCode = resRek.kodeRekening;
        const rekName = resRek.namaRekening;

        const normRekKey = String(rekCode || pureRek)
          .replace(/\s+/g, '')
          .replace(/^\.+|\.+$/g, '')
          .toLowerCase();

        if (!seenReks.has(normRekKey)) {
          seenReks.add(normRekKey);
          rekeningList.push({ kode: rekCode || pureRek, nama: rekName });
        }
      }
    });

    // Fallbacks if lists are empty
    if (kegiatanList.length === 0) {
      kegiatanList.push({ kode: resolvedKeg || '05.08.03', nama: namaKegiatan });
    }
    if (rekeningList.length === 0) {
      rekeningList.push({ kode: resolvedRek || '5.1.02.03.02.0115', nama: namaRekening });
    }

    setPrintModalItem({
      noKwitansi: group.noBukti,
      sudahTerimaDari: defaultSudahTerima,
      terbilang: getTerbilangString(group.totalKredit),
      jumlahUang: group.totalKredit,
      untukPembayaran: joinedKeterangan,
      tanggal: group.tanggal,
      tempat: schoolInfo.kecamatan || 'Laot Tadu',
      penerima: savedPenerima || '..........',
      nipPenerima: '',
      mengetahui: schoolInfo.kepsek || '',
      nipMengetahui: schoolInfo.nipKepsek || '',
      kodeKegiatan: resolvedKeg || '05.08.03',
      kodeRekening: resolvedRek || '5.1.02.03.02.0115',
      namaKegiatan: namaKegiatan,
      namaRekening: namaRekening,
      kegiatanList,
      rekeningList
    });
  };

  // Standard submit trigger for web print dialogue box
  const triggerPrintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printModalItem) return;
    
    // Update the layout container that gets printed
    setPreviewItem(printModalItem);
    
    // Auto-dismiss setup popup
    setPrintModalItem(null);
    
    // Give state machine a tiny window to populate DOM before firing native window print
    setTimeout(() => {
      window.print();
    }, 450);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-4 px-2">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Receipt size={22} className="stroke-[2.5]" />
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Kwitansi Pengeluaran Otomatis</h2>
          </div>
          <p className="text-xs text-gray-450 mt-1">Cetak berkas bukti kwitansi transaksi belanja resmi ditarik terintegrasi dari data BUKU KAS UMUM.</p>
        </div>

        {/* Action controls wrapper (Year) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3.5 py-2 rounded-xl text-xs shadow-xs">
            <Database size={14} className="text-indigo-500" />
            <span className="font-extrabold text-gray-700 dark:text-gray-300">Tahun Anggaran:</span>
            {loadingDatabases ? (
              <RefreshCw size={12} className="animate-spin text-gray-400 font-bold" />
            ) : databases.length > 0 ? (
              <select
                value={activeYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-transparent text-indigo-600 dark:text-indigo-400 font-extrabold focus:outline-none cursor-pointer"
              >
                {databases.map(db => {
                  const yrMatch = db.name.match(/\d+/);
                  const yr = yrMatch ? yrMatch[0] : '2026';
                  return <option key={db.name} value={yr} className="bg-white dark:bg-gray-900 text-gray-800 dark:text-white">{yr}</option>;
                })}
              </select>
            ) : (
              <span className="text-red-500 font-bold">Lengkapi Database Terlebih Dahulu</span>
            )}
          </div>

          <button
            id="refresh-kwitansi-data-button"
            onClick={handleRefresh}
            disabled={refreshing || loadingDatabases || loadingBku || loadingRkas}
            className={`flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-705 dark:text-gray-300 font-bold text-xs rounded-xl shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-700 ${
              refreshing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Saran Sinkronisasi Ulang Database & Tabel Kwitansi secara Real-time"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Memuat...' : 'Perbarui Data'}</span>
          </button>
        </div>
      </div>

      {databases.length === 0 && !loadingDatabases ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 max-w-xl mx-auto space-y-4 print:hidden shadow-lg">
          <Info size={40} className="text-indigo-500 mx-auto animate-pulse" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">Database Tidak Ditemukan</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Anda belum membuat database di folder Google Drive sekolah. Harap buat berkas database tahun anggaran melalui tab dashboard utama Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-6 print:block">
          
          {/* Month Selector Tabs conforming to BKU data indicators */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shrink-0 shadow-xs print:hidden space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
              <div className="flex items-center gap-1.5 label text-xs text-slate-800 dark:text-gray-200 font-black tracking-wide uppercase">
                <Calendar size={13} className="text-indigo-500" />
                <span>Pilih Bulan Transaksi BKU</span>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded font-black font-mono">
                {monthsWithData.length} Bulan Aktif
              </span>
            </div>

            {/* Layout selector on Desktop as a beautiful interactive pill grid, fallback to select on mobile */}
            <div className="block lg:hidden">
              <select
                value={activeMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-white font-extrabold rounded-xl"
              >
                {months.map(m => (
                  <option key={m} value={m}>
                    {m} {monthsWithData.includes(m) ? ' (Data BKU Tersedia ✓)' : ' (Kosong)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden lg:grid grid-cols-6 xl:grid-cols-12 gap-2">
              {months.map((m) => {
                const isSelected = activeMonth === m;
                const hasData = monthsWithData.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMonthChange(m)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 relative overflow-hidden ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/15 scale-102'
                        : hasData
                        ? 'bg-emerald-500/5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500'
                        : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-450 border-gray-200 dark:border-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <span className="text-[11px] font-black tracking-tight">{m.substring(0, 3)}</span>
                    <span className={`text-[9px] font-bold ${isSelected ? 'text-indigo-200' : hasData ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}>
                      {hasData ? (isSelected ? 'Terbuka' : 'Ada BKU') : 'Kosong'}
                    </span>
                    {hasData && !isSelected && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Card with Table conforming to the user's requested layout */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden print:hidden">
            {/* Card Header matching screenshot */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <h3 className="text-lg font-bold text-gray-950 dark:text-gray-50 flex items-center gap-1">
                Kwitansi Bulan {activeMonth}
              </h3>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const defaultBukti = filteredGroupedKwitansis.length > 0 ? filteredGroupedKwitansis[0].noBukti : '';
                    setModalNoBukti(defaultBukti);
                    setModalPenerima(defaultBukti ? (penerimaState[defaultBukti] || '') : '');
                    setShowPenerimaModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <UserPlus size={14} className="stroke-[2.5]" />
                  <span>BUAT DATA PENERIMA</span>
                </button>

                <div className="relative w-full sm:max-w-xs">
                  <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari uraian..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs py-2 pl-9 pr-3 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-850 dark:text-white rounded-lg outline-none focus:border-indigo-500 hover:border-gray-350 dark:hover:border-gray-600 transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Table Content */}
            {loadingBku ? (
              <div className="py-24 text-center text-gray-500 dark:text-gray-500 flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-905">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <RefreshCw className="animate-spin text-indigo-600 dark:text-indigo-400 absolute" size={28} />
                </div>
                <span className="text-xs font-black tracking-widest uppercase font-mono text-gray-800 dark:text-gray-200">Menyelaraskan Data BKU untuk kwitansi...</span>
              </div>
            ) : filteredGroupedKwitansis.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-gray-900 p-8 max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 bg-red-500/5 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                  <Info size={28} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-550 dark:text-gray-400 font-extrabold uppercase leading-snug">
                    TIDAK ADA PEMBELANJAAN PADA BULAN {activeMonth.toUpperCase()} {activeYear}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-normal font-medium max-w-md mx-auto pt-1">
                    Sistem tidak menemukan transaksi pengeluaran (kredit) yang dilengkapi dengan nomor bukti (No. Bukti) sah.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-300 bg-gray-100/90 dark:bg-gray-900/40 text-[11px] font-bold">
                      <th className="p-4 py-3 w-28 pl-6">No. Bukti</th>
                      <th className="p-4 py-3">Rincian Item (Data SPJ)</th>
                      <th className="p-4 py-3 w-44">Penerima</th>
                      <th className="p-4 py-3 w-32 text-center">Aksi</th>
                      <th className="p-4 py-3 w-36 text-right pr-6">Total Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredGroupedKwitansis.map((group) => {
                      const keyPenerima = `siap_bos_penerima_${user?.sekolah || ''}_${group.noBukti}`;
                      const currentPenerima = localStorage.getItem(keyPenerima) || penerimaState[group.noBukti] || '';
                      
                      return (
                        <tr key={group.noBukti} className="hover:bg-gray-100/70 dark:hover:bg-gray-800/40 transition-colors bg-white dark:bg-gray-900">
                          {/* Column 1: No. Bukti & Date */}
                          <td className="p-4 py-3.5 align-middle shrink-0 pl-6 border-r border-gray-100 dark:border-gray-800">
                            <div className="font-black text-slate-900 dark:text-white leading-tight text-sm tracking-tight">{group.noBukti}</div>
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mt-1.5">{group.tanggal}</div>
                          </td>
                          
                          {/* Column 2: Rincian Item (Data SPJ) with sub-rows for each purchase item */}
                          <td className="p-0 align-middle border-r border-gray-100 dark:border-gray-800">
                            <div className="divide-y divide-gray-200 dark:divide-gray-800">
                              {group.items.map((item, idx) => (
                                <div key={idx} className="p-4 py-3.5 flex items-center justify-between text-xs gap-4 animate-none">
                                  <span className="text-gray-950 dark:text-gray-100 font-bold max-w-lg leading-normal">{item.keterangan}</span>
                                  <span className="text-slate-950 dark:text-gray-200 font-mono font-bold text-[13px] shrink-0">
                                    Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.kredit)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          
                          {/* Column 3: Penerima */}
                          <td className="p-4 py-3.5 align-middle border-r border-gray-100 dark:border-gray-800">
                            <div className="flex flex-col gap-1.5 animate-none">
                              {penerimaState[group.noBukti]?.trim() ? (
                                <div className="flex flex-col items-start gap-1">
                                  <div className="px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/80 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs">
                                    <Check size={11} className="stroke-[3.5] text-emerald-700" />
                                    <span>{penerimaState[group.noBukti]}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalNoBukti(group.noBukti);
                                      setModalPenerima(penerimaState[group.noBukti] || '');
                                      setShowPenerimaModal(true);
                                    }}
                                    className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:underline hover:text-indigo-900 dark:hover:text-indigo-300 font-bold ml-1 cursor-pointer"
                                  >
                                    Ubah Penerima
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-start gap-1.5">
                                  <span className="text-[11px] text-amber-950 dark:text-amber-400 font-extrabold italic bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-900/65 shadow-2xs">
                                    data penerima belum ada
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalNoBukti(group.noBukti);
                                      setModalPenerima('');
                                      setShowPenerimaModal(true);
                                    }}
                                    className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:underline hover:text-indigo-900 dark:hover:text-indigo-300 font-extrabold ml-1 cursor-pointer"
                                  >
                                    + Buat Data Penerima
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
 
                          {/* Column 4: Aksi */}
                          <td className="p-4 py-3.5 align-middle text-center border-r border-gray-100 dark:border-gray-800">
                            <button
                              type="button"
                              onClick={() => openPrintSetup(group)}
                              className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-950 dark:text-indigo-200 hover:text-white hover:bg-indigo-650 dark:hover:bg-indigo-650 transition bg-indigo-100 dark:bg-indigo-950 px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-800 shadow-sm cursor-pointer"
                            >
                              <FileText size={13} className="stroke-[2.5]" />
                              <span>Lihat Kwitansi</span>
                            </button>
                          </td>
 
                          {/* Column 5: Total Jumlah - purple & bold */}
                          <td className="p-4 py-3.5 align-middle text-right font-black text-purple-700 dark:text-purple-400 font-sans text-sm pr-6 shrink-0 bg-slate-50/20 dark:bg-black/10">
                            Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(group.totalKredit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Setup / Customizer & Live Print preview Modal */}
          <AnimatePresence>
            {printModalItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm print:hidden overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-gray-900 border-[3px] border-black rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-8"
                >
                  
                  {/* Modal Header */}
                  <div className="bg-black text-white p-5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Receipt size={18} className="text-indigo-400 shrink-0" />
                      <h3 className="text-sm font-black tracking-wider uppercase font-mono">Konfigurasi Lembar Dokumen Kwitansi</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrintModalItem(null)}
                      className="px-3 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <form onSubmit={triggerPrintSubmit} className="flex-1 flex flex-col lg:grid lg:grid-cols-12 overflow-y-auto max-h-[80vh]">
                    
                    {/* Left pane: Editable items */}
                    <div className="p-6 lg:col-span-5 space-y-4 border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 max-h-[70vh] overflow-y-auto">
                      <div className="text-[11px] text-gray-500 font-extrabold pb-2 border-b border-gray-200/50 dark:border-gray-800/50 block">Masukkan Rincian Tanda Terima:</div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Sudah Terima Dari (Pengirim/Instansi)</label>
                        <input
                          type="text"
                          value={printModalItem.sudahTerimaDari}
                          onChange={(e) => setPrintModalItem({ ...printModalItem, sudahTerimaDari: e.target.value })}
                          required
                          className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-extrabold focus:border-black"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Terbilang Huruf (Ejaan Nominal)</label>
                        <input
                          type="text"
                          value={printModalItem.terbilang}
                          onChange={(e) => setPrintModalItem({ ...printModalItem, terbilang: e.target.value })}
                          required
                          className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-bold focus:border-black"
                        />
                      </div>

                      {/* Kode & Uraian Kegiatan Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Daftar Kode Kegiatan</label>
                          {printModalItem.kegiatanList && printModalItem.kegiatanList.length > 1 && (
                            <span className="text-[9px] font-black text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                              {printModalItem.kegiatanList.length} KEGIATAN
                            </span>
                          )}
                        </div>
                        
                        {printModalItem.kegiatanList && printModalItem.kegiatanList.length > 0 ? (
                          printModalItem.kegiatanList.map((item, kIdx) => (
                            <div key={kIdx} className="grid grid-cols-2 gap-3 p-2.5 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Kode Kegiatan #{kIdx + 1}</label>
                                <input
                                  type="text"
                                  value={item.kode}
                                  onChange={(e) => {
                                    const updated = [...(printModalItem.kegiatanList || [])];
                                    updated[kIdx] = { ...updated[kIdx], kode: e.target.value.replace(/\s+/g, '') };
                                    setPrintModalItem({
                                      ...printModalItem,
                                      kegiatanList: updated,
                                      kodeKegiatan: updated[0]?.kode || ''
                                    });
                                  }}
                                  required
                                  className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-mono font-bold"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Uraian Kegiatan #{kIdx + 1}</label>
                                <input
                                  type="text"
                                  value={item.nama}
                                  onChange={(e) => {
                                    const updated = [...(printModalItem.kegiatanList || [])];
                                    updated[kIdx] = { ...updated[kIdx], nama: e.target.value };
                                    setPrintModalItem({
                                      ...printModalItem,
                                      kegiatanList: updated,
                                      namaKegiatan: updated[0]?.nama || ''
                                    });
                                  }}
                                  required
                                  className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-bold"
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={printModalItem.kodeKegiatan}
                                onChange={(e) => setPrintModalItem({ ...printModalItem, kodeKegiatan: e.target.value.replace(/\s+/g, '') })}
                                required
                                className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-mono font-bold"
                              />
                            </div>

                            <div className="space-y-1">
                              <input
                                type="text"
                                value={printModalItem.namaKegiatan}
                                onChange={(e) => setPrintModalItem({ ...printModalItem, namaKegiatan: e.target.value })}
                                required
                                className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-bold"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Kode & Uraian Rekening Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Daftar Kode Rekening</label>
                          {printModalItem.rekeningList && printModalItem.rekeningList.length > 1 && (
                            <span className="text-[9px] font-black text-indigo-655 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                              {printModalItem.rekeningList.length} REKENING
                            </span>
                          )}
                        </div>

                        {printModalItem.rekeningList && printModalItem.rekeningList.length > 0 ? (
                          printModalItem.rekeningList.map((item, rIdx) => (
                            <div key={rIdx} className="grid grid-cols-2 gap-3 p-2.5 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Kode Rekening #{rIdx + 1}</label>
                                <input
                                  type="text"
                                  value={item.kode}
                                  onChange={(e) => {
                                    const updated = [...(printModalItem.rekeningList || [])];
                                    updated[rIdx] = { ...updated[rIdx], kode: e.target.value.replace(/\s+/g, '') };
                                    setPrintModalItem({
                                      ...printModalItem,
                                      rekeningList: updated,
                                      kodeRekening: updated[0]?.kode || ''
                                    });
                                  }}
                                  required
                                  className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-mono font-bold"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Uraian Rekening #{rIdx + 1}</label>
                                <input
                                  type="text"
                                  value={item.nama}
                                  onChange={(e) => {
                                    const updated = [...(printModalItem.rekeningList || [])];
                                    updated[rIdx] = { ...updated[rIdx], nama: e.target.value };
                                    setPrintModalItem({
                                      ...printModalItem,
                                      rekeningList: updated,
                                      namaRekening: updated[0]?.nama || ''
                                    });
                                  }}
                                  required
                                  className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-medium"
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={printModalItem.kodeRekening}
                                onChange={(e) => setPrintModalItem({ ...printModalItem, kodeRekening: e.target.value.replace(/\s+/g, '') })}
                                required
                                className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-mono font-bold"
                              />
                            </div>

                            <div className="space-y-1">
                              <input
                                type="text"
                                value={printModalItem.namaRekening}
                                onChange={(e) => setPrintModalItem({ ...printModalItem, namaRekening: e.target.value })}
                                required
                                className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-medium"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Kota Lokasi</label>
                          <input
                            type="text"
                            value={printModalItem.tempat}
                            onChange={(e) => setPrintModalItem({ ...printModalItem, tempat: e.target.value })}
                            required
                            className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Tanggal Cetak</label>
                          <input
                            type="text"
                            value={printModalItem.tanggal}
                            onChange={(e) => setPrintModalItem({ ...printModalItem, tanggal: e.target.value })}
                            required
                            className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="border-t border-gray-200/50 dark:border-gray-800/50 my-2 pt-3 space-y-3">
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Nama Penerima</label>
                            <input
                              type="text"
                              value={printModalItem.penerima}
                              onChange={(e) => setPrintModalItem({ ...printModalItem, penerima: e.target.value })}
                              required
                              list="print-penerima-suggestions"
                              className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-bold focus:border-indigo-500"
                            />
                            <datalist id="print-penerima-suggestions">
                              {uniquePenerimaList.map((name, idx) => (
                                <option key={idx} value={name} />
                              ))}
                            </datalist>

                            {uniquePenerimaList.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Riwayat Penerima:</span>
                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1.5 bg-gray-50/50 dark:bg-gray-900/20 rounded-lg border border-gray-100 dark:border-gray-800/80">
                                  {uniquePenerimaList.map((name, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setPrintModalItem({ ...printModalItem, penerima: name })}
                                      className="text-[9px] font-bold px-1.5 py-0.5 bg-white hover:bg-indigo-50 dark:bg-gray-950 dark:hover:bg-indigo-950/30 border border-gray-200 dark:border-gray-800 rounded-md text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-xs truncate max-w-[120px]"
                                      title={name}
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Pihak Mengetahui / KEPSEK</label>
                            <input
                              type="text"
                              value={printModalItem.mengetahui}
                              onChange={(e) => setPrintModalItem({ ...printModalItem, mengetahui: e.target.value })}
                              required
                              className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">NIP Kepala Sekolah</label>
                            <input
                              type="text"
                              value={printModalItem.nipMengetahui}
                              onChange={(e) => setPrintModalItem({ ...printModalItem, nipMengetahui: e.target.value })}
                              className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-xs text-gray-850 dark:text-white font-mono"
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Right pane: Elegant paper simulation preview */}
                    <div className="p-6 lg:col-span-7 bg-[#1c1917] text-[#f5f5f4] flex flex-col justify-between max-h-[70vh] overflow-y-auto">
                      <div className="text-[11px] text-gray-400 font-extrabold pb-3 flex items-center gap-1 uppercase tracking-widest font-mono">
                        <ClipboardList className="text-teal-400" size={11} /> 
                        <span>A6 Kwitansi Paper Draft Simulation Preview</span>
                      </div>                      {/* Paper canvas */}
                      <div className="bg-white text-black p-6 border border-black shadow-xl rounded-none font-sans text-xs space-y-5 my-auto max-w-2xl mx-auto w-full border-t-[3px] border-t-teal-500">
                        
                        {/* Split header cell block */}
                        <div className="border border-black grid grid-cols-12 overflow-hidden bg-white">
                          <div className="col-span-8 p-3 flex flex-col justify-center border-r border-black">
                            <h1 className="text-xl font-black tracking-widest text-black leading-none uppercase family-sans">KWITANSI</h1>
                            <p className="text-[9px] font-bold text-gray-800 mt-1 uppercase">Tanda Bukti Pengeluaran/Pembayaran</p>
                          </div>
                          <div className="col-span-4 bg-gray-200/90 p-3 border-l border-black flex flex-col justify-center items-center text-center">
                            <span className="text-[9px] font-bold text-black tracking-wider uppercase">NO KWITANSI</span>
                            <span className="text-sm font-black text-black uppercase tracking-tight mt-0.5">{printModalItem.noKwitansi || 'BPU 12'}</span>
                          </div>
                        </div>

                        {/* Content lines */}
                        <div className="space-y-3.5 text-[11px] text-black">
                          <div className="flex items-start">
                            <span className="w-32 font-bold uppercase shrink-0">SUDAH TERIMA DARI</span>
                            <span className="px-1.5 font-bold">:</span>
                            <span className="font-extrabold uppercase flex-1 break-words leading-tight">{printModalItem.sudahTerimaDari}</span>
                          </div>

                          <div className="flex items-start">
                            <span className="w-32 font-bold uppercase shrink-0">JUMLAH</span>
                            <span className="px-1.5 font-bold">:</span>
                            <span className="font-extrabold uppercase flex-1">
                              RP. {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(printModalItem.jumlahUang)}
                            </span>
                          </div>

                          <div className="flex items-center">
                            <span className="w-32 font-bold uppercase shrink-0">TERBILANG</span>
                            <span className="px-1.5 font-bold">:</span>
                            <div className="flex-1 bg-[#ffffcc] border border-black px-3.5 py-1.5 rounded-none">
                              <span className="font-black text-black uppercase italic tracking-wide text-xs leading-normal block">
                                {printModalItem.terbilang}
                              </span>
                            </div>
                          </div>

                          {/* Untuk Pembayaran sub-items */}
                          <div className="space-y-2 pt-1">
                            <span className="font-bold underline uppercase text-[11px] block text-black">Untuk Pembayaran</span>
                            
                            {printModalItem.kegiatanList && printModalItem.kegiatanList.length > 0 ? (
                              printModalItem.kegiatanList.map((item, index) => (
                                <div key={index} className="flex items-start pl-3 leading-normal">
                                  <span className="w-28 font-bold text-black shrink-0 text-[11px]">
                                    {index === 0 ? "Kode Kegiatan" : ""}
                                  </span>
                                  <span className="px-1.5 font-bold text-black">:</span>
                                  <div className="flex-1 text-black font-medium text-[11px]">
                                    <span className="font-bold font-mono mr-1">{item.kode}</span>
                                    <span className="font-semibold">{item.nama}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-start pl-3 leading-normal">
                                <span className="w-28 font-bold text-black shrink-0 text-[11px]">Kode Kegiatan</span>
                                <span className="px-1.5 font-bold text-black">:</span>
                                <div className="flex-1 text-black font-medium text-[11px]">
                                  <span className="font-bold font-mono mr-1">{printModalItem.kodeKegiatan}</span>
                                  <span className="font-semibold">{printModalItem.namaKegiatan}</span>
                                </div>
                              </div>
                            )}

                            {printModalItem.rekeningList && printModalItem.rekeningList.length > 0 ? (
                              printModalItem.rekeningList.map((item, index) => (
                                <div key={index} className="flex items-start pl-3 leading-normal">
                                  <span className="w-28 font-bold text-black shrink-0 text-[11px]">
                                    {index === 0 ? "Kode Rekening" : ""}
                                  </span>
                                  <span className="px-1.5 font-bold text-black">:</span>
                                  <div className="flex-1 text-black font-medium text-[11px] leading-snug break-words">
                                    <span className="font-bold font-mono mr-1">{item.kode}</span>
                                    <span className="font-semibold">{item.nama}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-start pl-3 leading-normal">
                                <span className="w-28 font-bold text-black shrink-0 text-[11px]">Kode Rekening</span>
                                <span className="px-1.5 font-bold text-black">:</span>
                                <div className="flex-1 text-black font-medium text-[11px] leading-snug break-words">
                                  <span className="font-bold font-mono mr-1">{printModalItem.kodeRekening}</span>
                                  <span className="font-semibold">{printModalItem.namaRekening}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Dibayar Lunas Stamp */}
                        <div className="text-center py-2 space-y-0.5">
                          <h2 className="font-extrabold text-black underline tracking-widest text-xs uppercase block">DIBAYAR LUNAS</h2>
                          <p className="font-bold text-black text-[10.5px]">Pada Tanggal, {printModalItem.tanggal}</p>
                        </div>

                        {/* Signature column grid */}
                        <div className="grid grid-cols-3 gap-2 text-center text-black text-[10px] pt-2">
                          <div className="flex flex-col justify-between h-20">
                            <div>
                              <div className="font-bold underline">Menyetujui</div>
                              <div className="font-semibold uppercase text-[8.5px] leading-tight text-gray-700">Kepala {user?.sekolah || 'Sekolah'}</div>
                            </div>
                            <div className="space-y-0.5 mt-auto">
                              <div className="font-extrabold text-[11px] underline truncate px-0.5 leading-none">{printModalItem.mengetahui ? formatNameDegreeCasing(printModalItem.mengetahui) : '...........................................'}</div>
                              <div className="text-[8.5px] font-mono leading-none">NIP. {printModalItem.nipMengetahui || '...........................................'}</div>
                            </div>
                          </div>

                          <div className="flex flex-col justify-between h-20">
                            <div>
                              <div className="font-transparent text-transparent select-none">-</div>
                              <div className="font-semibold uppercase text-[8.5px] leading-tight text-gray-700">Bendahara BOS</div>
                            </div>
                            <div className="space-y-0.5 mt-auto">
                              <div className="font-extrabold text-[11px] underline truncate px-0.5 leading-none">{schoolInfo.bendahara ? formatNameDegreeCasing(schoolInfo.bendahara) : '...........................................'}</div>
                              <div className="text-[8.5px] font-mono leading-none">NIP. {schoolInfo.nipBendahara || '...........................................'}</div>
                            </div>
                          </div>

                          <div className="flex flex-col justify-between h-20">
                            <div>
                              <div className="font-transparent text-transparent select-none">-</div>
                              <div className="font-semibold uppercase text-[8.5px] leading-tight text-gray-700">Penerima</div>
                            </div>
                            <div className="space-y-0.5 mt-auto">
                              <div className="font-extrabold text-[11px] truncate px-0.5 leading-none">{printModalItem.penerima === '..........' ? '...........................................' : formatNameDegreeCasing(printModalItem.penerima)}</div>
                              <div className="text-[8.5px] font-mono text-transparent select-none leading-none">NIP. -</div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Modal Action bar */}
                      <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-750 mt-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPrintModalItem(null)}
                          className="px-4 py-2 bg-transparent hover:bg-gray-800 hover:text-white border border-gray-700 text-gray-350 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Tutup
                        </button>
                        
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
                        >
                          <Printer size={13} />
                          <span>Mulai Cetak Sekarang (Print)</span>
                        </button>
                      </div>

                    </div>

                  </form>
                </motion.div>
              </div>
            )}
              
              {showPenerimaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm print:hidden">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-gray-900 border-[3px] border-black rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-sans"
                  >
                    {/* Modal Header */}
                    <div className="bg-black text-white p-5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <UserPlus size={18} className="text-indigo-400 shrink-0" />
                        <h3 className="text-xs font-black tracking-wider uppercase font-mono">Buat Data Penerima Kwitansi</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPenerimaModal(false)}
                        className="text-gray-400 hover:text-white transition cursor-pointer bg-transparent border-0 outline-none"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                      
                      {/* Select No. Bukti */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block font-sans">Pilih Kode No. Bukti</label>
                        <select
                          value={modalNoBukti}
                          onChange={(e) => {
                            const selectedBkt = e.target.value;
                            setModalNoBukti(selectedBkt);
                            setModalPenerima(penerimaState[selectedBkt] || '');
                          }}
                          className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-xs font-extrabold rounded-xl outline-none text-gray-900 dark:text-white cursor-pointer shadow-sm focus:border-indigo-500 hover:border-gray-400"
                        >
                          <option value="">-- Hubungkan dengan No. Bukti --</option>
                          {filteredGroupedKwitansis.map((gk) => {
                            const isFilled = !!penerimaState[gk.noBukti]?.trim();
                            return (
                              <option key={gk.noBukti} value={gk.noBukti}>
                                {isFilled ? '✓ ' : '✗ '} {gk.noBukti} ({gk.tanggal}) - Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(gk.totalKredit)} {isFilled ? '(Sudah Terisi)' : '(Belum Terisi)'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Uraian Data under Selected No. Bukti */}
                      {modalNoBukti && (() => {
                        const selectedGroup = groupedMap[modalNoBukti];
                        if (!selectedGroup) return null;
                        return (
                          <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 mt-2">
                            <div className="text-[10px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">Uraian Data SPJ pada No. Bukti</div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-40 overflow-y-auto pr-1">
                              {selectedGroup.items.map((it, idx) => (
                                <div key={idx} className="pay-2 flex items-start justify-between gap-4 text-xs py-2">
                                  <span className="text-gray-900 dark:text-gray-200 font-bold leading-normal">{it.keterangan}</span>
                                  <span className="text-purple-700 dark:text-purple-400 font-mono font-bold shrink-0">
                                    Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(it.kredit)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs font-bold font-sans">
                              <span className="text-gray-600 dark:text-gray-400 font-bold">Total Akumulasi Pengeluaran</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-black">
                                Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(selectedGroup.totalKredit)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Recipient Input field with Autocomplete/Datalist and quick select tags */}
                      <div className="space-y-2 font-sans">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block font-sans">Penerima</label>
                        <input
                          type="text"
                          value={modalPenerima}
                          onChange={(e) => setModalPenerima(e.target.value)}
                          placeholder="Masukkan atau pilih nama penerima..."
                          list="modal-penerima-suggestions"
                          className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-xs font-bold rounded-xl outline-none text-gray-900 dark:text-white shadow-sm focus:border-indigo-500"
                          required
                        />
                        <datalist id="modal-penerima-suggestions">
                          {uniquePenerimaList.map((name, idx) => (
                            <option key={idx} value={name} />
                          ))}
                        </datalist>

                        {uniquePenerimaList.length > 0 && (
                          <div className="space-y-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800/60">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                              Pilih dari Riwayat Penerima:
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-gray-50/50 dark:bg-gray-950/20 rounded-xl border border-gray-150 dark:border-gray-850">
                              {uniquePenerimaList.map((name, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setModalPenerima(name)}
                                  className="text-[10px] font-bold px-2 py-1 bg-white hover:bg-indigo-50 dark:bg-gray-900 dark:hover:bg-indigo-950/30 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-850 dark:text-gray-200 transition-all cursor-pointer shadow-xs whitespace-nowrap inline-flex items-center gap-1 hover:scale-[1.01] active:scale-[0.99] duration-100"
                                >
                                  <User size={10} className="text-indigo-400 shrink-0" />
                                  <span>{name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Modal Footer actions */}
                    <div className="bg-gray-50 dark:bg-gray-950 p-4 px-6 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => setShowPenerimaModal(false)}
                        className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer font-sans"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSavePenerimaToDb(modalNoBukti, modalPenerima)}
                        disabled={savingPenerima || !modalNoBukti || !modalPenerima.trim()}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md transition-all uppercase tracking-wider font-sans text-center justify-center estimation-none"
                      >
                        {savingPenerima ? <RefreshCw className="animate-spin text-white" size={13} /> : <Check size={13} />}
                        <span>Simpan ke Database</span>
                      </button>
                    </div>

                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          {/* Printable HTML Layout (Visible only inside system browser print renderer) */}
          {previewItem && (
            <div id="print-receipt-section" className="hidden print:block bg-white p-12 max-w-4xl mx-auto space-y-6 font-serif leading-relaxed text-black">
              {/* Paper canvas print layout */}
              <div className="bg-white text-black p-6 border border-black shadow-none rounded-none font-sans text-xs space-y-6 w-full">
                
                {/* Split header cell block */}
                <div className="border border-black grid grid-cols-12 overflow-hidden bg-white">
                  <div className="col-span-8 p-3 flex flex-col justify-center border-r border-black">
                    <h1 className="text-xl font-black tracking-widest text-black leading-none uppercase">KWITANSI</h1>
                    <p className="text-[9px] font-bold text-gray-800 mt-1 uppercase">Tanda Bukti Pengeluaran/Pembayaran</p>
                  </div>
                  <div className="col-span-4 bg-gray-200 p-3 border-l border-black flex flex-col justify-center items-center text-center">
                    <span className="text-[9px] font-bold text-black tracking-wider uppercase">NO KWITANSI</span>
                    <span className="text-sm font-black text-black uppercase tracking-tight mt-0.5">{previewItem.noKwitansi}</span>
                  </div>
                </div>

                {/* Content lines */}
                <div className="space-y-4 text-[12px] text-black">
                  <div className="flex items-start">
                    <span className="w-32 font-bold uppercase shrink-0">SUDAH TERIMA DARI</span>
                    <span className="px-1.5 font-bold">:</span>
                    <span className="font-extrabold uppercase flex-1 break-words">{previewItem.sudahTerimaDari}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-32 font-bold uppercase shrink-0">JUMLAH</span>
                    <span className="px-1.5 font-bold">:</span>
                    <span className="font-extrabold uppercase flex-1">
                      RP. {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(previewItem.jumlahUang)}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <span className="w-32 font-bold uppercase shrink-0">TERBILANG</span>
                    <span className="px-1.5 font-bold">:</span>
                    <div className="flex-1 bg-[#ffffcc] border border-black px-3.5 py-1.5 rounded-none font-sans">
                      <span className="font-black text-black uppercase italic tracking-wide text-xs">
                        {previewItem.terbilang}
                      </span>
                    </div>
                  </div>

                  {/* Untuk Pembayaran sub-items */}
                  <div className="space-y-2 pt-1">
                    <span className="font-bold underline uppercase text-[12px] block text-black">Untuk Pembayaran</span>
                    
                    {previewItem.kegiatanList && previewItem.kegiatanList.length > 0 ? (
                      previewItem.kegiatanList.map((item, index) => (
                        <div key={index} className="flex items-start pl-3 leading-normal">
                          <span className="w-28 font-bold text-black shrink-0">
                            {index === 0 ? "Kode Kegiatan" : ""}
                          </span>
                          <span className="px-1 font-bold text-black">:</span>
                          <div className="flex-1 text-black font-medium text-[12px]">
                            <span className="font-bold font-mono mr-1">{item.kode}</span>
                            <span className="font-semibold">{item.nama}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start pl-3 leading-normal">
                        <span className="w-28 font-bold text-black shrink-0">Kode Kegiatan</span>
                        <span className="px-1 font-bold text-black">:</span>
                        <div className="flex-1 text-black font-medium text-[12px]">
                          <span className="font-bold font-mono mr-1">{previewItem.kodeKegiatan}</span>
                          <span className="font-semibold">{previewItem.namaKegiatan}</span>
                        </div>
                      </div>
                    )}

                    {previewItem.rekeningList && previewItem.rekeningList.length > 0 ? (
                      previewItem.rekeningList.map((item, index) => (
                        <div key={index} className="flex items-start pl-3 leading-normal">
                          <span className="w-28 font-bold text-black shrink-0">
                            {index === 0 ? "Kode Rekening" : ""}
                          </span>
                          <span className="px-1 font-bold text-black">:</span>
                          <div className="flex-1 text-black font-medium text-[12px] leading-snug break-words">
                            <span className="font-bold font-mono mr-1">{item.kode}</span>
                            <span className="font-semibold">{item.nama}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start pl-3 leading-normal">
                        <span className="w-28 font-bold text-black shrink-0">Kode Rekening</span>
                        <span className="px-1 font-bold text-black">:</span>
                        <div className="flex-1 text-black font-medium text-[12px] leading-snug break-words">
                          <span className="font-bold font-mono mr-1">{previewItem.kodeRekening}</span>
                          <span className="font-semibold">{previewItem.namaRekening}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dibayar Lunas Stamp */}
                <div className="text-center py-2 space-y-0.5">
                  <h2 className="font-extrabold text-black underline tracking-widest text-xs uppercase block">DIBAYAR LUNAS</h2>
                  <p className="font-bold text-black text-[11px]">Pada Tanggal, {previewItem.tanggal}</p>
                </div>

                {/* Signature column grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-black text-[11px] pt-4">
                  <div className="flex flex-col justify-between h-24">
                    <div>
                      <div className="font-bold underline">Menyetujui</div>
                      <div className="font-semibold uppercase text-[9px] leading-tight text-gray-700">Kepala {user?.sekolah || 'Sekolah'}</div>
                    </div>
                    <div className="space-y-0.5 mt-auto">
                      <div className="font-extrabold text-[12px] underline truncate px-0.5">{previewItem.mengetahui ? formatNameDegreeCasing(previewItem.mengetahui) : '...........................................'}</div>
                      <div className="text-[9px] font-mono leading-none">NIP. {previewItem.nipMengetahui || '...........................................'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between h-24">
                    <div>
                      <div className="font-transparent text-transparent select-none">-</div>
                      <div className="font-semibold uppercase text-[9px] leading-tight text-gray-700">Bendahara BOS</div>
                    </div>
                    <div className="space-y-0.5 mt-auto">
                      <div className="font-extrabold text-[12px] underline truncate px-0.5">{schoolInfo.bendahara ? formatNameDegreeCasing(schoolInfo.bendahara) : '...........................................'}</div>
                      <div className="text-[9px] font-mono leading-none">NIP. {schoolInfo.nipBendahara || '...........................................'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between h-24">
                    <div>
                      <div className="font-transparent text-transparent select-none">-</div>
                      <div className="font-semibold uppercase text-[9px] leading-tight text-gray-700">Penerima</div>
                    </div>
                    <div className="space-y-0.5 mt-auto">
                      <div className="font-extrabold text-[12px] truncate px-0.5">{previewItem.penerima === '..........' ? '...........................................' : previewItem.penerima ? formatNameDegreeCasing(previewItem.penerima) : '...........................................'}</div>
                      <div className="text-[9px] font-mono text-transparent select-none leading-none">NIP. -</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footnote stamp */}
              <div className="text-[9px] font-sans italic border-t border-dashed border-gray-300 pt-5 text-center text-gray-400 mt-6 flex justify-between px-2">
                <span>* Kwitansi sah yang dicetak secara digital.</span>
                <span>Aplikasi Administrasi SIAP BOS 2026.</span>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
