import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // URL Params for external triggers
  const urlMonth = searchParams.get('month');
  const urlYear = searchParams.get('year');
  const urlBukti = searchParams.get('bukti');
  const autoPrint = searchParams.get('autoPrint') === 'true';

  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const [databases, setDatabases] = useState<GeneratedDatabase[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [activeMonth, setActiveMonth] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_month') || 'Januari';
  });

  const [monthsWithData, setMonthsWithData] = useState<string[]>([]);

  const renderKwitansiCard = (item: any, isArsip: boolean) => {
    const formattedJumlah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.jumlahUang);
    const bendaharaName = schoolInfo.bendahara ? formatNameDegreeCasing(schoolInfo.bendahara) : '...........................................';
    const bendaharaNip = schoolInfo.nipBendahara || '...........................................';
    const kepsekName = item.mengetahui ? formatNameDegreeCasing(item.mengetahui) : '...........................................';
    const kepsekNip = item.nipMengetahui || '...........................................';
    const penerimaName = item.penerima === '..........' ? '...........................................' : (item.penerima ? formatNameDegreeCasing(item.penerima) : '...........................................');

    return (
      <div 
        className="half-kwitansi border-2 md:border-[3px] border-black p-4 py-3 md:p-6 md:py-4 bg-white relative flex flex-col justify-between h-[134mm] w-full box-border text-black rounded-none select-none text-[10.5px] md:text-xs leading-relaxed"
      >
        {/* Split header cell block */}
        <div className="border border-black grid grid-cols-12 overflow-hidden bg-white mb-2.5">
          <div className="col-span-8 p-2.5 flex flex-col justify-center border-r border-black">
            <h1 className="text-lg md:text-xl font-black tracking-widest text-black leading-none uppercase">KWITANSI</h1>
            <p className="text-[8px] md:text-[9px] font-bold text-gray-800 mt-0.5 uppercase">Tanda Bukti Pengeluaran/Pembayaran</p>
          </div>
          <div className="col-span-4 bg-gray-100 p-2.5 border-l border-black flex flex-col justify-center items-center text-center">
            <span className="text-[8px] md:text-[9px] font-bold text-black tracking-wider uppercase">NO KWITANSI</span>
            <span className="text-xs md:text-sm font-black text-black uppercase tracking-tight mt-0.5">{item.noKwitansi}</span>
          </div>
        </div>

        {/* Content lines */}
        <div className="space-y-2 md:space-y-2.5 text-[10px] md:text-[11px] text-black font-sans">
          <div className="flex items-start">
            <span className="w-28 md:w-32 font-bold uppercase shrink-0 text-black">SUDAH TERIMA DARI</span>
            <span className="px-1 font-bold text-black">:</span>
            <span className="font-extrabold uppercase flex-1 break-words text-black leading-tight">{item.sudahTerimaDari}</span>
          </div>

          <div className="flex items-start">
            <span className="w-28 md:w-32 font-bold uppercase shrink-0 text-black">JUMLAH</span>
            <span className="px-1 font-bold text-black">:</span>
            <span className="font-extrabold uppercase flex-1 text-black">RP. {formattedJumlah}</span>
          </div>

          <div className="flex items-center">
            <span className="w-28 md:w-32 font-bold uppercase shrink-0 text-black">TERBILANG</span>
            <span className="px-1 font-bold text-black">:</span>
            <div className="flex-1 bg-[#ffffcc] border border-black px-3 py-1 rounded-none font-sans leading-tight">
              <span className="font-black text-black uppercase italic tracking-wide text-[9px] md:text-[10px] leading-tight block">
                {item.terbilang}
              </span>
            </div>
          </div>

          {/* Untuk Pembayaran sub-items */}
          <div className="space-y-1 pt-0.5">
            <span className="font-bold underline uppercase text-[10px] md:text-[11px] block text-black">Untuk Pembayaran</span>
            
            {item.kegiatanList && item.kegiatanList.length > 0 ? (
              item.kegiatanList.map((k: any, idx: number) => (
                <div key={idx} className="flex items-start pl-2.5 leading-normal">
                  <span className="w-24 md:w-28 font-bold text-black shrink-0 text-[10px] md:text-[10.5px]">
                    {idx === 0 ? "Kode Kegiatan" : ""}
                  </span>
                  <span className="px-1 font-bold text-black">:</span>
                  <div className="flex-1 text-black font-medium text-[10px] md:text-[10.5px]">
                    <span className="font-bold font-mono mr-1">{k.kode}</span>
                    <span className="font-semibold">{k.nama}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start pl-2.5 leading-normal">
                <span className="w-24 md:w-28 font-bold text-black shrink-0 text-[10px] md:text-[10.5px]">Kode Kegiatan</span>
                <span className="px-1 font-bold text-black">:</span>
                <div className="flex-1 text-black font-medium text-[10px] md:text-[10.5px]">
                  <span className="font-bold font-mono mr-1">{item.kodeKegiatan}</span>
                  <span className="font-semibold">{item.namaKegiatan}</span>
                </div>
              </div>
            )}

            {item.rekeningList && item.rekeningList.length > 0 ? (
              item.rekeningList.map((r: any, idx: number) => (
                <div key={idx} className="flex items-start pl-2.5 leading-normal">
                  <span className="w-24 md:w-28 font-bold text-black shrink-0 text-[10px] md:text-[10.5px]">
                    {idx === 0 ? "Kode Rekening" : ""}
                  </span>
                  <span className="px-1 font-bold text-black">:</span>
                  <div className="flex-1 text-black font-medium text-[10px] md:text-[10.5px] leading-snug break-words">
                    <span className="font-bold font-mono mr-1">{r.kode}</span>
                    <span className="font-semibold">{r.nama}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start pl-2.5 leading-normal">
                <span className="w-24 md:w-28 font-bold text-black shrink-0 text-[10px] md:text-[10.5px]">Kode Rekening</span>
                <span className="px-1 font-bold text-black">:</span>
                <div className="flex-1 text-black font-medium text-[10px] md:text-[10.5px] leading-snug break-words">
                  <span className="font-bold font-mono mr-1">{item.kodeRekening}</span>
                  <span className="font-semibold">{item.namaRekening}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dibayar Lunas Stamp */}
        <div className="text-center py-1 space-y-0.5">
          <h2 className="font-black text-black underline tracking-widest text-[11px] uppercase block leading-none">DIBAYAR LUNAS</h2>
          <p className="font-bold text-black text-[9.5px]">Pada Tanggal, {item.tanggal}</p>
        </div>

        {/* Signature column grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-black text-[9.5px] md:text-[10px] pt-1">
          <div className="flex flex-col justify-between h-20">
            <div>
              <div className="font-bold underline leading-none">Menyetujui</div>
              <div className="font-semibold uppercase text-[8px] mt-0.5 leading-tight text-gray-700">Kepala {user?.sekolah || 'Sekolah'}</div>
            </div>
            <div className="space-y-0.5 mt-auto text-center">
              <div className="font-extrabold text-[10px] md:text-[10.5px] underline truncate px-0.5 leading-none">{kepsekName}</div>
              <div className="text-[8px] md:text-[8.5px] font-mono leading-none">NIP. {kepsekNip}</div>
            </div>
          </div>

          <div className="flex flex-col justify-between h-20">
            <div>
              <div className="font-transparent text-transparent select-none leading-none">-</div>
              <div className="font-semibold uppercase text-[8px] mt-0.5 leading-tight text-gray-700">Bendahara BOS</div>
            </div>
            <div className="space-y-0.5 mt-auto text-center">
              <div className="font-extrabold text-[10px] md:text-[10.5px] underline truncate px-0.5 leading-none">{bendaharaName}</div>
              <div className="text-[8px] md:text-[8.5px] font-mono leading-none">NIP. {bendaharaNip}</div>
            </div>
          </div>

          <div className="flex flex-col justify-between h-20">
            <div>
              <div className="font-transparent text-transparent select-none leading-none">-</div>
              <div className="font-semibold uppercase text-[8px] mt-0.5 leading-tight text-gray-700">Penerima</div>
            </div>
            <div className="space-y-0.5 mt-auto text-center">
              <div className="font-extrabold text-[10px] md:text-[10.5px] truncate px-0.5 leading-none">{penerimaName}</div>
              <div className="text-[8px] md:text-[8.5px] font-mono text-transparent select-none leading-none">NIP. -</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
  const [showDuplicate, setShowDuplicate] = useState(true);
  const [previewAllItems, setPreviewAllItems] = useState<KwitansiPrintData[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [showAllPreviewModal, setShowAllPreviewModal] = useState(false);

  // Final Print layout items (what's rendered inside the print CSS block)
  const [previewItems, setPreviewItems] = useState<KwitansiPrintData[]>([]);

  // Local state to manage editable recipients
  const [penerimaState, setPenerimaState] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (urlYear) {
      setActiveYear(urlYear);
      localStorage.setItem('siap_bos_active_year', urlYear);
    }
    if (urlMonth) {
      setActiveMonth(urlMonth);
      localStorage.setItem('siap_bos_active_month', urlMonth);
    }
    if (urlBukti) {
      setSearchQuery(urlBukti);
    }
  }, [urlYear, urlMonth, urlBukti]);

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
    let resolvedKodeKeg = bkuKegNorm ? rawKodeKeg : (cleanCodeSegment(rawKodeKeg) || rawKodeKeg);
    const resolvedKodeRek = bkuRekNorm ? rawKodeRek : (cleanCodeSegment(rawKodeRek) || rawKodeRek);

    const hasKegMatch = !!matchedKegRow;
    const hasRekMatch = !!matchedRekRow;

    const isValidKegCode = (code: string, match: boolean): boolean => {
      const cleaned = String(code || '').trim();
      if (!cleaned || cleaned === '-' || cleaned === '0' || /^([1-9]\d{5,})$/.test(cleaned)) return false;
      if (match) return true;
      return /^0?\d\./.test(cleaned);
    };

    if (!isValidKegCode(resolvedKodeKeg, hasKegMatch)) {
      resolvedKodeKeg = '';
    }

    if (!namaKegiatan && resolvedKodeKeg) {
      const normalizedKeg = resolvedKodeKeg.replace(/\.*$/, '');
      if (normalizedKeg === '05.02.01') namaKegiatan = 'Penerimaan Peserta Didik Baru';
      else if (normalizedKeg === '05.03.01') namaKegiatan = 'Pengembangan Perpustakaan';
      else if (normalizedKeg === '05.04.01') namaKegiatan = 'Pelaksanaan Kegiatan Pembelajaran dan Ekstrakurikuler';
      else if (normalizedKeg === '05.05.01') namaKegiatan = 'Pelaksanaan Kegiatan Evaluasi Pembelajaran';
      else if (normalizedKeg === '05.06.01') namaKegiatan = 'Pelaksanaan Administrasi Kegiatan Sekolah';
      else if (normalizedKeg === '05.07.01') namaKegiatan = 'Pengembangan Profesi Guru dan Tenaga Kependidikan';
      else if (normalizedKeg === '05.08.01') namaKegiatan = 'Langganan Daya dan Jasa';
      else if (normalizedKeg === '06.07.03' || normalizedKeg.includes('06.07.03')) namaKegiatan = 'Pembayaran langganan air';
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
      else if (normCheck.startsWith('5.1.02.02.01.0060')) {
        namaRekening = 'Belanja Tagihan Air';
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
      hasKegMatch,
      hasRekMatch
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
    if (user?.sekolah && activeYear && activeMonth) {
      fetchBkuData(activeYear, activeMonth);
      fetchMonthsWithData();
      fetchSavedKwitansis(activeYear);
      fetchRkasData(activeYear);
    }
  }, [user?.sekolah, activeYear, activeMonth]);

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
    if (urlBukti && urlBukti.trim() !== '') {
      return g.noBukti.toLowerCase() === urlBukti.toLowerCase().trim();
    }
    const q = searchQuery.toLowerCase();
    const matchBukti = g.noBukti.toLowerCase().includes(q);
    const matchTanggal = g.tanggal.toLowerCase().includes(q);
    const matchUraian = g.items.some(item => item.keterangan.toLowerCase().includes(q));
    return matchBukti || matchTanggal || matchUraian;
  }).sort((a,b) => a.noBukti.localeCompare(b.noBukti));

  // Auto-populated and synchronize preview items if under autoPrint mode
  useEffect(() => {
    if (autoPrint && filteredGroupedKwitansis.length > 0) {
      const itemsToPrint: KwitansiPrintData[] = filteredGroupedKwitansis.map(group => {
        const keyPenerima = `siap_bos_penerima_${user?.sekolah || ''}_${group.noBukti}`;
        const savedPenerima = localStorage.getItem(keyPenerima) || penerimaState[group.noBukti] || '';
        const schoolName = String(user?.sekolah || 'SEKOLAH').toUpperCase();
        const defaultSudahTerima = `BENDAHARA BOS ${schoolName}`;
        const joinedKeterangan = group.items.map(it => it.keterangan || '').filter(Boolean).join('; ');
        const firstItem = group.items.find(it => it.kodeRekening && String(it.kodeRekening).trim().startsWith('5.')) || group.items[0] || { kodeKegiatan: '', kodeRekening: '' };
        const { kodeKegiatan: resolvedKeg, kodeRekening: resolvedRek, namaKegiatan, namaRekening } = findRkasDescriptions(firstItem.kodeKegiatan, firstItem.kodeRekening);

        const isValidKegiatanCode = (code: string, hasRkasMatch: boolean): boolean => {
          const cleaned = String(code || '').trim();
          if (!cleaned || cleaned === '-' || cleaned === '0') return false;
          if (hasRkasMatch) return true;
          return /^0?\d\./.test(cleaned);
        };

        const kegiatanList: { kode: string; nama: string }[] = [];
        const rekeningList: { kode: string; nama: string }[] = [];
        const seenKegs = new Set<string>();
        const seenReks = new Set<string>();

        group.items.forEach(it => {
          const pureRek = String(it.kodeRekening || '').replace(/\s+/g, '').trim();
          if (pureRek && pureRek.startsWith('5.')) {
            const pureKeg = String(it.kodeKegiatan || '').replace(/\s+/g, '').trim();
            if (pureKeg) {
              const res = findRkasDescriptions(pureKeg, '');
              const kegCode = res.kodeKegiatan;
              const kegName = res.namaKegiatan;
              const hasKegMatch = res.hasKegMatch;

              if (isValidKegiatanCode(kegCode || pureKeg, hasKegMatch)) {
                const kegKey = String(kegCode || pureKeg).toLowerCase();
                if (!seenKegs.has(kegKey)) {
                  seenKegs.add(kegKey);
                  kegiatanList.push({ kode: kegCode || pureKeg, nama: kegName });
                }
              }
            }
            const resRek = findRkasDescriptions('', pureRek);
            const rekKey = String(resRek.kodeRekening || pureRek).toLowerCase();
            if (!seenReks.has(rekKey)) {
              seenReks.add(rekKey);
              rekeningList.push({ kode: resRek.kodeRekening || pureRek, nama: resRek.namaRekening });
            }
          }
        });

        if (kegiatanList.length === 0) kegiatanList.push({ kode: resolvedKeg || '05.08.03', nama: namaKegiatan });
        if (rekeningList.length === 0) rekeningList.push({ kode: resolvedRek || '5.1.02.03.02.0115', nama: namaRekening });

        return {
          noKwitansi: group.noBukti,
          sudahTerimaDari: defaultSudahTerima,
          terbilang: getTerbilangString(group.totalKredit),
          jumlahUang: group.totalKredit,
          untukPembayaran: joinedKeterangan,
          tanggal: group.tanggal,
          tempat: schoolInfo.kecamatan || 'Jakarta',
          penerima: savedPenerima || '..........',
          mengetahui: schoolInfo.kepsek || '',
          nipMengetahui: schoolInfo.nipKepsek || '',
          kodeKegiatan: resolvedKeg || '',
          kodeRekening: resolvedRek || '',
          namaKegiatan,
          namaRekening,
          kegiatanList,
          rekeningList
        };
      });

      // Avoid setting state in endless renders by comparing stringified value
      const currIds = previewItems.map(p => p.noKwitansi).join(',');
      const nextIds = itemsToPrint.map(p => p.noKwitansi).join(',');
      if (currIds !== nextIds) {
        setPreviewItems(itemsToPrint);
      }
    }
  }, [autoPrint, filteredGroupedKwitansis, user?.sekolah, schoolInfo, penerimaState]);

  // Auto-trigger printing once previewItems are populated
  useEffect(() => {
    if (autoPrint && !loadingBku && !loadingDatabases && previewItems.length > 0 && !hasAutoPrinted) {
      const timer = setTimeout(() => {
        window.print();
        setHasAutoPrinted(true);
      }, 2000); // 2s delay to make sure everything is completely drawn
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loadingBku, loadingDatabases, previewItems.length, hasAutoPrinted]);

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
      return /^0?\d\./.test(cleaned);
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

  // Helper to generate receipt HTML
  const generateReceiptHtmlForItem = (item: KwitansiPrintData, isArsip: boolean) => {
    const formattedJumlah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.jumlahUang);

    const kegiatanMarkup = item.kegiatanList && item.kegiatanList.length > 0
      ? item.kegiatanList.map((k, index) => `
        <div class="flex items-start pl-3 leading-normal text-[10.5px] text-black">
          <span class="w-28 font-bold text-black shrink-0">${index === 0 ? "Kode Kegiatan" : ""}</span>
          <span class="px-1 font-bold text-black">:</span>
          <div class="flex-1 text-black font-medium">
            <span class="font-bold font-mono mr-1">${k.kode}</span>
            <span class="font-semibold">${k.nama}</span>
          </div>
        </div>
      `).join('')
      : `
        <div class="flex items-start pl-3 leading-normal text-[10.5px] text-black">
          <span class="w-28 font-bold text-black shrink-0">Kode Kegiatan</span>
          <span class="px-1 font-bold text-black">:</span>
          <div class="flex-1 text-black font-medium">
            <span class="font-bold font-mono mr-1">${item.kodeKegiatan}</span>
            <span class="font-semibold">${item.namaKegiatan}</span>
          </div>
        </div>
      `;

    const rekeningMarkup = item.rekeningList && item.rekeningList.length > 0
      ? item.rekeningList.map((r, index) => `
        <div class="flex items-start pl-3 leading-normal text-[10.5px] text-black">
          <span class="w-28 font-bold text-black shrink-0">${index === 0 ? "Kode Rekening" : ""}</span>
          <span class="px-1 font-bold text-black">:</span>
          <div class="flex-1 text-black font-medium break-words">
            <span class="font-bold font-mono mr-1">${r.kode}</span>
            <span class="font-semibold">${r.nama}</span>
          </div>
        </div>
      `).join('')
      : `
        <div class="flex items-start pl-3 leading-normal text-[10.5px] text-black">
          <span class="w-28 font-bold text-black shrink-0">Kode Rekening</span>
          <span class="px-1 font-bold text-black">:</span>
          <div class="flex-1 text-black font-medium break-words">
            <span class="font-bold font-mono mr-1">${item.kodeRekening}</span>
            <span class="font-semibold">${item.namaRekening}</span>
          </div>
        </div>
      `;

    const bendaharaName = schoolInfo.bendahara ? formatNameDegreeCasing(schoolInfo.bendahara) : '...........................................';
    const bendaharaNip = schoolInfo.nipBendahara || '...........................................';
    const kepsekName = item.mengetahui ? formatNameDegreeCasing(item.mengetahui) : '...........................................';
    const kepsekNip = item.nipMengetahui || '...........................................';
    const penerimaName = item.penerima === '..........' ? '...........................................' : (item.penerima ? formatNameDegreeCasing(item.penerima) : '...........................................');

    return `
      <div class="half-kwitansi">
        <div class="border border-black grid grid-cols-12 overflow-hidden bg-white mb-2.5">
          <div class="col-span-8 p-2.5 flex flex-col justify-center border-r border-black">
            <h1 class="text-xl font-extrabold tracking-widest text-black leading-none uppercase">KWITANSI</h1>
            <p class="text-[9px] font-extrabold text-gray-800 mt-0.5 uppercase">Tanda Bukti Pengeluaran/Pembayaran</p>
          </div>
          <div class="col-span-4 bg-gray-100 p-2.5 border-l border-black flex flex-col justify-center items-center text-center">
            <span class="text-[9px] font-black text-black tracking-wider uppercase">NO KWITANSI</span>
            <span class="text-sm font-black text-black uppercase tracking-tight mt-0.5">${item.noKwitansi || ''}</span>
          </div>
        </div>

        <div class="space-y-3 text-[11px] text-black font-sans leading-normal">
          <div class="flex items-start">
            <span class="w-32 font-bold uppercase shrink-0 text-black">SUDAH TERIMA DARI</span>
            <span class="px-1 font-bold text-black">:</span>
            <span class="font-extrabold uppercase flex-1 break-words text-black leading-tight">${item.sudahTerimaDari}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold uppercase shrink-0 text-black">JUMLAH</span>
            <span class="px-1 font-bold text-black">:</span>
            <span class="font-extrabold uppercase flex-1 text-black">RP. ${formattedJumlah}</span>
          </div>

          <div class="flex items-center">
            <span class="w-32 font-bold uppercase shrink-0 text-black">TERBILANG</span>
            <span class="px-1 font-bold text-black">:</span>
            <div class="flex-1 bg-[#ffffcc] border border-black px-3.5 py-1.5 rounded-none font-sans leading-tight">
              <span class="font-black text-black uppercase italic tracking-wide text-[10px] leading-tight block">
                ${item.terbilang}
              </span>
            </div>
          </div>

          <div class="space-y-1.5 pt-0.5">
            <span class="font-bold underline uppercase text-[11px] block text-black">Untuk Pembayaran</span>
            ${kegiatanMarkup}
            ${rekeningMarkup}
          </div>
        </div>

        <div class="text-center py-1">
          <h2 class="font-extrabold text-black underline tracking-widest text-[11.5px] uppercase block leading-none">DIBAYAR LUNAS</h2>
          <p class="font-bold text-black text-[9.5px] mt-0.5">Pada Tanggal, ${item.tanggal}</p>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center text-black text-[10px] pt-1">
          <div class="flex flex-col justify-between h-[75px]">
            <div>
              <div class="font-bold underline leading-none">Menyetujui</div>
              <div class="font-semibold uppercase text-[8px] mt-0.5 leading-tight text-gray-700">Kepala ${user?.sekolah || 'Sekolah'}</div>
            </div>
            <div class="space-y-0.5 mt-auto text-center">
              <div class="font-extrabold text-[10.5px] underline truncate px-0.5">${kepsekName}</div>
              <div class="text-[8.5px] font-mono leading-none">NIP. ${kepsekNip}</div>
            </div>
          </div>

          <div class="flex flex-col justify-between h-[75px]">
            <div>
              <div class="invisible select-none leading-none">-</div>
              <div class="font-semibold uppercase text-[8.5px] mt-0.5 leading-tight text-gray-700">Bendahara BOS</div>
            </div>
            <div class="space-y-0.5 mt-auto text-center">
              <div class="font-extrabold text-[10.5px] underline truncate px-0.5">${bendaharaName}</div>
              <div class="text-[8.5px] font-mono leading-none">NIP. ${bendaharaNip}</div>
            </div>
          </div>

          <div class="flex flex-col justify-between h-[75px]">
            <div>
              <div class="invisible select-none leading-none">-</div>
              <div class="font-semibold uppercase text-[8.5px] mt-0.5 leading-tight text-gray-700">Penerima</div>
            </div>
            <div class="space-y-0.5 mt-auto text-center">
              <div class="font-extrabold text-[10.5px] truncate px-0.5">${penerimaName}</div>
              <div class="text-[8.5px] font-mono invisible select-none leading-none">NIP. -</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const handleLoadAllKwitansis = async () => {
    if (monthsWithData.length === 0) {
      toast.error("Tidak ada bulan dengan data transaksi BKU yang terdeteksi.");
      return;
    }
    setIsLoadingAll(true);
    setShowAllPreviewModal(true);
    
    try {
      const fetchedResults = await Promise.all(
        monthsWithData.map(async (month) => {
          const cacheKey = `siap_bos_cache_${user?.sekolah}_bku_${activeYear}_${month}`;
          const cached = sessionStorage.getItem(cacheKey);
          
          let cleanedRows = [];
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              cleanedRows = parsed.map((row: any) => ({
                ...row,
                tanggal: formatValueIfDate(row.tanggal, true),
              }));
            } catch (e) {
              console.error("Error parsing cached BKU rows", e);
            }
          }
          
          if (cleanedRows.length === 0) {
            try {
              const response = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  sekolah: user?.sekolah,
                  tahun: activeYear,
                  tipe: month
                })
              });
              const data = await response.json();
              if (data.success && data.rows && data.rows.length > 0) {
                cleanedRows = data.rows.map((row: any) => ({
                  ...row,
                  tanggal: formatValueIfDate(row.tanggal, true),
                  kodeKegiatan: String(row.kodeKegiatan || '').trim(),
                  kodeRekening: String(row.kodeRekening || '').trim(),
                }));
                sessionStorage.setItem(cacheKey, JSON.stringify(cleanedRows));
              }
            } catch (err) {
              console.error(`Error fetching BKU for ${month}:`, err);
            }
          }
          
          return { month, rows: cleanedRows };
        })
      );
      
      const compiledList: KwitansiPrintData[] = [];
      const sortedFetched = fetchedResults.sort((a, b) => {
        return months.indexOf(a.month) - months.indexOf(b.month);
      });
      
      sortedFetched.forEach(({ month, rows }) => {
        const validRows = rows.filter((row: any) => {
          const isKreditNonZero = parseFloat(row.kredit) > 0;
          const hasBukti = row.bukti && row.bukti.trim() !== '' && row.bukti.trim() !== '-';
          return hasBukti && isKreditNonZero;
        });
        
        const monthGroupedMap: { [key: string]: KwitansiGroup } = {};
        validRows.forEach((row: any) => {
          const bkt = row.bukti.trim();
          const tgl = row.tanggal;
          const ket = row.keterangan || '';
          const kre = parseFloat(row.kredit) || 0;
          const keg = row.kodeKegiatan || '';
          const rek = row.kodeRekening || '';
          
          if (!monthGroupedMap[bkt]) {
            monthGroupedMap[bkt] = {
              noBukti: bkt,
              tanggal: tgl,
              items: [],
              totalKredit: 0
            };
          }
          monthGroupedMap[bkt].items.push({
            keterangan: ket,
            kredit: kre,
            kodeKegiatan: keg,
            kodeRekening: rek
          });
          monthGroupedMap[bkt].totalKredit += kre;
        });
        
        const sortedGroups = Object.values(monthGroupedMap).sort((a, b) => 
          a.noBukti.localeCompare(b.noBukti)
        );
        
        sortedGroups.forEach(group => {
          const keyPenerima = `siap_bos_penerima_${user?.sekolah || ''}_${group.noBukti}`;
          const savedPenerima = localStorage.getItem(keyPenerima) || penerimaState[group.noBukti] || '';
          const schoolName = String(user?.sekolah || 'SEKOLAH').toUpperCase();
          const defaultSudahTerima = `BENDAHARA BOS ${schoolName}`;
          const joinedKeterangan = group.items.map(it => it.keterangan || '').filter(Boolean).join('; ');
          const firstItem = group.items.find(it => it.kodeRekening && String(it.kodeRekening).trim().startsWith('5.')) || group.items[0] || { kodeKegiatan: '', kodeRekening: '' };
          const { kodeKegiatan: resolvedKeg, kodeRekening: resolvedRek, namaKegiatan, namaRekening } = findRkasDescriptions(firstItem.kodeKegiatan, firstItem.kodeRekening);

          const isValidKegiatanCode = (code: string, hasRkasMatch: boolean): boolean => {
            const cleaned = String(code || '').trim();
            if (!cleaned || cleaned === '-' || cleaned === '0') return false;
            if (hasRkasMatch) return true;
            // Must look like a standard RKAS kegiatan code (e.g. starts with '0' followed by digits and a dot)
            return /^0?\d\./.test(cleaned);
          };

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

          if (kegiatanList.length === 0) kegiatanList.push({ kode: resolvedKeg || '05.08.03', nama: namaKegiatan });
          if (rekeningList.length === 0) rekeningList.push({ kode: resolvedRek || '5.1.02.03.02.0115', nama: namaRekening });

          compiledList.push({
            noKwitansi: group.noBukti,
            sudahTerimaDari: defaultSudahTerima,
            terbilang: getTerbilangString(group.totalKredit),
            jumlahUang: group.totalKredit,
            untukPembayaran: joinedKeterangan,
            tanggal: group.tanggal,
            tempat: schoolInfo.kecamatan || 'Jakarta',
            penerima: savedPenerima || '..........',
            mengetahui: schoolInfo.kepsek || '',
            nipMengetahui: schoolInfo.nipKepsek || '',
            kodeKegiatan: resolvedKeg || '',
            kodeRekening: resolvedRek || '',
            namaKegiatan,
            namaRekening,
            kegiatanList,
            rekeningList
          });
        });
      });
      
      setPreviewAllItems(compiledList);
    } catch (err) {
      console.error("Error loading all kwitansis:", err);
      toast.error("Gagal memuat rincian semua kwitansi.");
    } finally {
      setIsLoadingAll(false);
    }
  };

  const handlePrintAllSubmit = () => {
    if (previewAllItems.length === 0) {
      toast.error("Tidak ada kwitansi yang tersedia untuk dicetak.");
      return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela cetak. Pastikan izin popup browser diaktifkan.');
      return;
    }

    const pagesHtmlArray = [];
    for (let i = 0; i < previewAllItems.length; i += 2) {
      const itemTop = previewAllItems[i];
      const itemBottom = i + 1 < previewAllItems.length ? previewAllItems[i + 1] : null;

      pagesHtmlArray.push(`
        <div class="a4-page">
          <!-- Top Half -->
          ${generateReceiptHtmlForItem(itemTop, false)}

          <!-- Centered Divider Line -->
          <div class="divider-line flex items-center justify-center py-1">
            <div style="flex: 1; border-top: 1.5px dashed rgba(0,0,0,0.4);"></div>
            <span style="padding: 0 12px;">✂️ GUNTING / LIPAT DI SINI (SETENGAH KERTAS A4 PORTRAIT)</span>
            <div style="flex: 1; border-top: 1.5px dashed rgba(0,0,0,0.4);"></div>
          </div>

          <!-- Bottom Half -->
          ${itemBottom ? generateReceiptHtmlForItem(itemBottom, false) : '<div class="half-kwitansi" style="border: none !important;"></div>'}
        </div>
      `);
    }
    const pagesHtml = pagesHtmlArray.join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak Semua Kwitansi</title>
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
              margin: 4mm;
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
              max-width: 210mm !important;
              height: 288mm !important;
              padding: 0 !important;
              margin: 0 auto !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              background: white !important;
              gap: 2mm !important;
            }
          }
          .a4-page {
            width: 210mm;
            height: 297mm;
            box-sizing: border-box;
            background: white;
            margin: 20px auto;
            padding: 8mm 10mm;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            border: 1px solid #d1d5db;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            position: relative;
            gap: 2mm;
          }
          .half-kwitansi {
            height: 135mm;
            width: 100%;
            box-sizing: border-box;
            padding: 6mm 8mm;
            border: 3px double #000000;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            page-break-inside: avoid !important;
            overflow: hidden;
          }
          .divider-line {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: bold;
            color: rgba(0,0,0,0.6);
            font-family: monospace;
            padding: 2px 0;
            user-select: none;
            height: 6mm;
          }
        </style>
      </head>
      <body>
        <div class="no-print max-w-[210mm] mx-auto mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-2xl border border-gray-250">
          <div>
            <div class="text-sm font-bold text-gray-800">Pratinjau Cetak Semua Lembar Kwitansi PDF (Format A4 Portrait)</div>
            <div class="text-xs text-gray-500">Terdapat ${previewAllItems.length} lembar kwitansi terurut berdasarkan bulan dan nomor bukti.</div>
          </div>
          <button onclick="window.print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">
            Cetak Semua Manual
          </button>
        </div>

        ${pagesHtml}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 800);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Standard submit trigger for web print dialogue box
  const triggerPrintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printModalItem) return;
    
    // Update the layout container that gets printed
    setPreviewItems([printModalItem]);
    
    // Formulate a clean print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela cetak. Pastikan izin popup browser diaktifkan.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kwitansi ${printModalItem.noKwitansi}</title>
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
              margin: 4mm;
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
              max-width: 210mm !important;
              height: 288mm !important;
              padding: 0 !important;
              margin: 0 auto !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              background: white !important;
              gap: 2mm !important;
            }
          }
          .a4-page {
            width: 210mm;
            height: 297mm;
            box-sizing: border-box;
            background: white;
            margin: 0 auto;
            padding: 8mm 10mm;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            border: 1px solid #d1d5db;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            position: relative;
            gap: 2mm;
          }
          .half-kwitansi {
            height: 135mm;
            width: 100%;
            box-sizing: border-box;
            padding: 6mm 8mm;
            border: 3px double #000000;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            page-break-inside: avoid !important;
            overflow: hidden;
          }
          .divider-line {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: bold;
            color: rgba(0,0,0,0.6);
            font-family: monospace;
            padding: 2px 0;
            user-select: none;
            height: 6mm;
          }
        </style>
      </head>
      <body>
        <!-- Optional print action button for fallback if print layout did not automatically trigger -->
        <div class="no-print max-w-[210mm] mx-auto mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-2xl border border-gray-250">
          <div>
            <div class="text-sm font-bold text-gray-800">Pratinjau Cetak Lembar Kwitansi PDF (Format A4 Portrait)</div>
            <div class="text-xs text-gray-500">Kwitansi diformat sebagai setengah kertas A4 Portrait dengan garis potong dan pinggiran solid.</div>
          </div>
          <button onclick="window.print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">
            Cetak Manual
          </button>
        </div>

        <div class="a4-page">
          <!-- Top Half: ASLI -->
          ${generateReceiptHtmlForItem(printModalItem, false)}

          <!-- Centered Divider Line -->
          <div class="divider-line flex items-center justify-center py-1" style="${!showDuplicate ? 'visibility: hidden; height: 10px;' : ''}">
            <div style="flex: 1; border-top: 1.5px dashed rgba(0,0,0,0.4);"></div>
            <span style="padding: 0 12px;">✂️ GUNTING / LIPAT DI SINI (SETENGAH KERTAS A4 PORTRAIT)</span>
            <div style="flex: 1; border-top: 1.5px dashed rgba(0,0,0,0.4);"></div>
          </div>

          <!-- Bottom Half: ARSIP -->
          ${showDuplicate ? generateReceiptHtmlForItem(printModalItem, true) : '<div class="half-kwitansi" style="border: none !important;"></div>'}
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

    // Auto-dismiss setup popup
    setPrintModalItem(null);
  };

  const handlePrintAllFiltered = () => {
    if (filteredGroupedKwitansis.length === 0) {
      toast.error('Tidak ada kwitansi yang terfilter untuk dicetak.');
      return;
    }

    const itemsToPrint: KwitansiPrintData[] = filteredGroupedKwitansis.map(group => {
      const keyPenerima = `siap_bos_penerima_${user?.sekolah || ''}_${group.noBukti}`;
      const savedPenerima = localStorage.getItem(keyPenerima) || penerimaState[group.noBukti] || '';
      const schoolName = String(user?.sekolah || 'SEKOLAH').toUpperCase();
      const defaultSudahTerima = `BENDAHARA BOS ${schoolName}`;
      const joinedKeterangan = group.items.map(it => it.keterangan).join('; ');
      const firstItem = group.items.find(it => it.kodeRekening && it.kodeRekening.trim().startsWith('5.')) || group.items[0] || { kodeKegiatan: '', kodeRekening: '' };
      const { kodeKegiatan: resolvedKeg, kodeRekening: resolvedRek, namaKegiatan, namaRekening } = findRkasDescriptions(firstItem.kodeKegiatan, firstItem.kodeRekening);

      const isValidKegiatanCode = (code: string, hasRkasMatch: boolean): boolean => {
        const cleaned = String(code || '').trim();
        if (!cleaned || cleaned === '-' || cleaned === '0') return false;
        if (hasRkasMatch) return true;
        return /^0?\d\./.test(cleaned);
      };

      const kegiatanList: { kode: string; nama: string }[] = [];
      const rekeningList: { kode: string; nama: string }[] = [];
      const seenKegs = new Set<string>();
      const seenReks = new Set<string>();

      group.items.forEach(it => {
        const pureRek = String(it.kodeRekening || '').replace(/\s+/g, '').trim();
        if (pureRek && pureRek.startsWith('5.')) {
          const pureKeg = String(it.kodeKegiatan || '').replace(/\s+/g, '').trim();
          if (pureKeg) {
            const res = findRkasDescriptions(pureKeg, '');
            const kegCode = res.kodeKegiatan;
            const kegName = res.namaKegiatan;
            const hasKegMatch = res.hasKegMatch;
            
            if (isValidKegiatanCode(kegCode || pureKeg, hasKegMatch)) {
              const kegKey = String(kegCode || pureKeg).toLowerCase();
              if (!seenKegs.has(kegKey)) {
                seenKegs.add(kegKey);
                kegiatanList.push({ kode: kegCode || pureKeg, nama: kegName });
              }
            }
          }
          const resRek = findRkasDescriptions('', pureRek);
          const rekKey = String(resRek.kodeRekening || pureRek).toLowerCase();
          if (!seenReks.has(rekKey)) {
            seenReks.add(rekKey);
            rekeningList.push({ kode: resRek.kodeRekening || pureRek, nama: resRek.namaRekening });
          }
        }
      });

      if (kegiatanList.length === 0) kegiatanList.push({ kode: resolvedKeg || '05.08.03', nama: namaKegiatan });
      if (rekeningList.length === 0) rekeningList.push({ kode: resolvedRek || '5.1.02.03.02.0115', nama: namaRekening });

      return {
        noKwitansi: group.noBukti,
        sudahTerimaDari: defaultSudahTerima,
        terbilang: getTerbilangString(group.totalKredit),
        jumlahUang: group.totalKredit,
        untukPembayaran: joinedKeterangan,
        tanggal: group.tanggal,
        tempat: schoolInfo.kecamatan || 'Jakarta',
        penerima: savedPenerima || '..........',
        mengetahui: schoolInfo.kepsek || '',
        nipMengetahui: schoolInfo.nipKepsek || '',
        kodeKegiatan: resolvedKeg || '',
        kodeRekening: resolvedRek || '',
        namaKegiatan,
        namaRekening,
        kegiatanList,
        rekeningList
      };
    });

    setPreviewItems(itemsToPrint);
    setTimeout(() => {
      window.print();
    }, 450);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto mt-4 px-2">
      {autoPrint && (
        <style dangerouslySetInnerHTML={{ __html: `
          /* Disable the layout shell entirely when we want to display/print clean PDF pages */
          aside, header, nav, button:not(.print-btn), .no-print, [role="banner"], .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          html, body, #root, .min-h-screen, .flex.min-h-screen {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          #print-receipt-section {
            display: block !important;
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          @media print {
            aside, header, nav, button, .print-hidden, .print\\:hidden {
              display: none !important;
              visibility: hidden !important;
            }
            body, html, #root, main, .flex.min-h-screen {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 210mm !important;
              max-width: 210mm !important;
              height: auto !important;
              overflow: visible !important;
            }
            #print-receipt-section {
              display: block !important;
              width: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .a4-page {
              page-break-after: always !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        ` }} />
      )}

      {autoPrint && (
        <div className="print:hidden bg-indigo-50/90 dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-6xl mx-auto mb-6 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight font-sans">Pratinjau Cetak Lembar Kwitansi PDF</h3>
              <p className="text-xs text-gray-400 font-medium font-sans">Sistem secara otomatis memicu dialog print browser Anda. Gunakan tombol berikut untuk mencetak ulang atau kembali.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="print-btn px-4 py-2 bg-indigo-650 hover:bg-indigo-755 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer size={13} />
              Cetak Ulang
            </button>
            <button
              onClick={() => navigate('/cetak')}
              className="print-btn px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750 border border-gray-250 dark:border-gray-700 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              ← Kembali ke Menu Cetak
            </button>
          </div>
        </div>
      )}

      {autoPrint && !hasAutoPrinted && (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 print:hidden">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-extrabold animate-pulse tracking-widest text-[10px] uppercase">Menyiapkan Kwitansi...</p>
        </div>
      )}

      {!autoPrint && (
        <div className="space-y-6 print:hidden">
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
            id="print-all-kwitansi-button"
            onClick={handleLoadAllKwitansis}
            disabled={refreshing || loadingDatabases}
            className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-black text-xs rounded-xl shadow-xs transition hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
            title="Lihat Semua Kwitansi Berurutan berdasarkan Bulan dan Nomor Bukti"
          >
            <Printer size={13} className="stroke-[2.5]" />
            <span>Lihat Semua Kwitansi</span>
          </button>

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
        </div>
      )}

      {/* Setup / Customizer & Live Print preview Modal */}
          <AnimatePresence>
            {printModalItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm print:hidden overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-gray-900 border-[3px] border-black rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col my-8"
                >
                  
                  {/* Modal Header */}
                  <div className="bg-black text-white p-5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Receipt size={18} className="text-indigo-400 shrink-0" />
                      <h3 className="text-sm font-black tracking-wider uppercase font-mono">Pratinjau Lembar Kwitansi</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrintModalItem(null)}
                      className="px-3 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <form onSubmit={triggerPrintSubmit} className="flex-1 flex flex-col overflow-y-auto max-h-[80vh]">
                    
                    {/* Right pane: Elegant paper simulation preview */}
                    <div className="p-6 bg-[#1a1715] text-[#f5f5f4] flex flex-col justify-between max-h-[80vh] overflow-y-auto w-full">
                      <div className="text-[11px] text-gray-400 font-extrabold pb-3 flex items-center gap-1 uppercase tracking-widest font-mono select-none">
                        <ClipboardList className="text-teal-400 font-bold" size={12} /> 
                        <span>Virtual A4 Portrait Page Simulation (ASLI Top & ARSIP Bottom halves)</span>
                      </div>

                      {/* Paper canvas */}
                      <div className="bg-[#e4e4e7] text-black p-4 md:p-6 border border-black shadow-2xl rounded-none font-sans text-xs flex flex-col gap-4 my-auto max-w-xl mx-auto w-full select-none">
                        
                        {/* ASLI (Atas) half-A4 block */}
                        <div className="bg-white p-1 rounded-sm shadow-sm border border-gray-300">
                          {renderKwitansiCard(printModalItem, false)}
                        </div>

                        {/* Middle cutting dashed guideline */}
                        <div className="flex items-center justify-center py-2 select-none">
                          <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
                          <span className="px-2 font-mono text-[9px] font-black text-gray-500 bg-transparent flex items-center gap-1">
                            ✂️ GUNTING / LIPAT DI SINI (SETENGAH KERTAS A4)
                          </span>
                          <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
                        </div>

                        {/* ARSIP (Bawah) half-A4 block */}
                        {showDuplicate && (
                          <div className="bg-white p-1 rounded-sm shadow-sm border border-gray-300">
                            {renderKwitansiCard(printModalItem, true)}
                          </div>
                        )}

                      </div>

                      {/* Modal Action bar */}
                      <div className="flex justify-between items-center gap-2.5 pt-5 border-t border-gray-800 mt-5 shrink-0">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showDuplicate}
                            onChange={(e) => setShowDuplicate(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                          />
                          Cetak Duplicate (Arsip)
                        </label>
                        
                        <div className="flex justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => setPrintModalItem(null)}
                            className="px-4 py-2 bg-transparent hover:bg-gray-800 hover:text-white border border-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                          >
                            Tutup
                          </button>
                          
                          <button
                            type="submit"
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                          >
                            <Printer size={13} className="stroke-[2.5]" />
                            <span>Mulai Cetak Sekarang (Print)</span>
                          </button>
                        </div>
                      </div>

                    </div>

                  </form>
                </motion.div>
              </div>
            )}

            {showAllPreviewModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm print:hidden overflow-y-auto w-full max-h-screen">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-gray-900 border-[3px] border-black rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-8 h-[90vh]"
                >
                  
                  {/* Modal Header */}
                  <div className="bg-black text-white p-5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                      <Receipt size={18} className="text-teal-400 shrink-0" />
                      <h3 className="text-sm font-black tracking-wider uppercase font-mono">Pratinjau Semua Kwitansi ({previewAllItems.length} Lembar)</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllPreviewModal(false)}
                      className="px-3 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col overflow-y-auto w-full p-4 md:p-6 bg-[#1a1715] text-[#f5f5f4]">
                    <div className="text-[11px] text-gray-400 font-extrabold pb-3 flex items-center gap-1 uppercase tracking-widest font-mono select-none shrink-0">
                      <ClipboardList className="text-teal-400 font-bold" size={12} /> 
                      <span>Virtual A4 Portrait Page Simulation</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-8 pr-2 pb-6">
                      {isLoadingAll ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-gray-400 py-12">
                          <RefreshCw className="animate-spin text-indigo-500 w-8 h-8 mx-auto" />
                          <div className="font-bold text-sm tracking-wide">Memuat rincian kwitansi...</div>
                          <div className="text-xs">Mengekstrak data transaksi BKU dan menyusun format cetak PDF</div>
                        </div>
                      ) : previewAllItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-gray-400 py-12">
                          <div className="font-bold text-sm tracking-wide text-red-400">Tidak ada data</div>
                          <div className="text-xs">Tidak ada kwitansi yang tersedia.</div>
                        </div>
                      ) : (
                        Array.from({ length: Math.ceil(previewAllItems.length / 2) }).map((_, pageIdx) => {
                          const topIdx = pageIdx * 2;
                          const bottomIdx = topIdx + 1;
                          const itemTop = previewAllItems[topIdx];
                          const itemBottom = bottomIdx < previewAllItems.length ? previewAllItems[bottomIdx] : null;

                          return (
                            <div key={pageIdx} className="bg-[#e4e4e7] text-black p-4 md:p-6 border border-black shadow-2xl rounded-none font-sans text-xs flex flex-col gap-4 mx-auto w-full max-w-xl select-none">
                              <div className="text-center font-bold text-gray-500 mb-1">
                                Lembar {pageIdx + 1} dari {Math.ceil(previewAllItems.length / 2)} <br/>
                                <span className="text-[10px] font-normal">{itemTop.noKwitansi} {itemBottom && `& ${itemBottom.noKwitansi}`}</span>
                              </div>
                              
                              {/* Top half-A4 block */}
                              <div className="bg-white p-1 rounded-sm shadow-sm border border-gray-300">
                                {renderKwitansiCard(itemTop, false)}
                              </div>

                              {/* Middle cutting dashed guideline */}
                              <div className="flex items-center justify-center py-2 select-none">
                                <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
                                <span className="px-2 font-mono text-[9px] font-black text-gray-500 bg-transparent flex items-center gap-1 text-center leading-tight">
                                  ✂️ GUNTING / LIPAT DI SINI (SETENGAH KERTAS A4)
                                </span>
                                <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
                              </div>

                              {/* Bottom half-A4 block */}
                              {itemBottom ? (
                                <div className="bg-white p-1 rounded-sm shadow-sm border border-gray-300">
                                  {renderKwitansiCard(itemBottom, false)}
                                </div>
                              ) : (
                                <div className="half-kwitansi !border-none"></div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Modal Action bar */}
                    <div className="flex justify-end items-center gap-2.5 pt-5 border-t border-gray-800 mt-2 shrink-0">
                      
                      <div className="flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowAllPreviewModal(false)}
                          className="px-4 py-2 bg-transparent hover:bg-gray-800 hover:text-white border border-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                        >
                          Tutup
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            handlePrintAllSubmit();
                          }}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                        >
                          <Printer size={13} className="stroke-[2.5]" />
                          <span>Mulai Cetak Semua (Print)</span>
                        </button>
                      </div>
                    </div>
                  </div>
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
          </div>
        )}

          {/* Printable HTML Layout (Visible only inside system browser print renderer) */}
          {previewItems.length > 0 && (
            <div id="print-receipt-section" className={`${autoPrint ? 'block' : 'hidden'} print:block w-full`}>
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: white !important;
                    -webkit-print-color-adjust: exact;
                  }
                  #print-receipt-section {
                    width: 210mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                }
              ` }} />
              {(() => {
                const chunks: [any, any | null][] = [];
                for (let i = 0; i < previewItems.length; i += 2) {
                  chunks.push([previewItems[i], previewItems[i + 1] || null]);
                }
                return chunks.map(([itemTop, itemBottom], idx) => (
                  <div key={idx} className="a4-page bg-white text-black flex flex-col justify-between h-[297mm] w-[210mm] p-[8mm_10mm] box-border relative mx-auto my-0 print:m-0 print:border-none print:shadow-none shadow-md border border-gray-200">
                    {/* Top Item */}
                    {renderKwitansiCard(itemTop, false)}
                    
                    {/* Cutting Line separator */}
                    <div className="flex items-center justify-center py-2 select-none font-mono text-[9px] font-bold text-gray-500 w-full">
                      <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
                      <span className="px-3">✂️ GUNTING / LIPAT DI SINI (SETENGAH KERTAS A4 PORTRAIT)</span>
                      <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
                    </div>

                    {/* Bottom Item */}
                    {itemBottom ? (
                      renderKwitansiCard(itemBottom, false)
                    ) : (
                      <div className="h-[134mm] w-full bg-white border border-transparent"></div>
                    )}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      );
    }
