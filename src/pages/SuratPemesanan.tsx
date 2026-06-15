import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cleanGoogleSheetsDateToCode } from './Rkas';
import { 
  FileText, Plus, Trash2, Edit2, Printer, Search, Calendar, User, MapPin, Store, Receipt, HelpCircle, Save, X, ArrowLeft, Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderedItem {
  id: string;
  namaBarang: string;
  kodeKegiatan: string;
  kodeRekening: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  total: number;
  originalTotal?: number;
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
  
  // Specific fields for our template match
  kodeBukti?: string;
  tanggalSurat?: string;
  kabupatenCetak?: string;
  tanggalKirim?: string;
  transactionType?: 'SIPLAH' | 'HONORARIUM' | 'PERJALANAN_DINAS' | 'TIDAK_MEMERLUKAN_SURAT';
}

// Universal smart parser to avoid Javascript new Date() swapping day and month for Indonesian DD/MM/YYYY dates
function parseSmartDate(str: any): Date | null {
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
}

// Helper to format values if they are dates
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

// Smart date subtraction helper
function getOneDayBefore(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseSmartDate(dateStr);
  if (d && !isNaN(d.getTime())) {
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dateStr;
}

// Convert any date format to beautiful ID long month format
function tryFormatToIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseSmartDate(dateStr);
  if (d && !isNaN(d.getTime())) {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dateStr;
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

export default function SuratPemesanan() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('siap_bos_active_year') || '2026';
  });

  const [orders, setOrders] = useState<SuratPemesananData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // Added filterMonth state
  const [editingOrder, setEditingOrder] = useState<SuratPemesananData | null>(null);
  const [printItem, setPrintItem] = useState<SuratPemesananData | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const printId = searchParams.get('id');
  const autoPrint = searchParams.get('autoPrint') === 'true';

  useEffect(() => {
    if (printId && orders.length > 0) {
      const match = orders.find(o => o.id === printId);
      if (match) {
        setPrintItem(match);
        if (autoPrint) {
          setTimeout(() => {
            window.print();
          }, 800);
        }
      }
    }
  }, [printId, autoPrint, orders]);


  // Form states
  const [formNomorSp, setFormNomorSp] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formNamaPenyedia, setFormNamaPenyedia] = useState('');
  const [formAlamatPenyedia, setFormAlamatPenyedia] = useState('');
  const [formPimpinanPenyedia, setFormPimpinanPenyedia] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formItems, setFormItems] = useState<OrderedItem[]>([]);
  const [formSpType, setFormSpType] = useState('');
  
  // School personnel details
  const [formKepsek, setFormKepsek] = useState('');
  const [formNipKepsek, setFormNipKepsek] = useState('');
  const [formBendahara, setFormBendahara] = useState('');
  const [formNipBendahara, setFormNipBendahara] = useState('');

  // Item form inputs
  const [itemNama, setItemNama] = useState('');
  const [itemKeg, setItemKeg] = useState('');
  const [itemRek, setItemRek] = useState('');
  const [itemVol, setItemVol] = useState(1);
  const [itemSatuan, setItemSatuan] = useState('Pcs');
  const [itemHarga, setItemHarga] = useState(0);

  // BKU/Kwitansi Autocomplete States
  const [bkuLookups, setBkuLookups] = useState<any[]>([]);
  const [personnelInfo, setPersonnelInfo] = useState<any>(null);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [rkasRows, setRkasRows] = useState<any[]>([]);
  const [rkasPhasedRows, setRkasPhasedRows] = useState<any[]>([]);

  const findRkasPhasedMatch = (
    bkuKeg: string,
    bkuRek: string,
    bkuKeterangan: string,
    phasedRows: any[]
  ) => {
    if (!phasedRows || phasedRows.length === 0) return null;

    const cleanVal = (s: string) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCode = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/^\.+|\.+$/g, '');

    const targetKeg = cleanCode(bkuKeg);
    const targetRek = cleanCode(bkuRek);
    const targetKeterangan = cleanVal(bkuKeterangan);

    // Filter phased rows by matching codes first
    const candidatesByCode = phasedRows.filter(row => {
      const rowKeg = cleanCode(row.kodeKegiatan);
      const rowRek = cleanCode(row.kodeRekening);
      return (
        (rowKeg === targetKeg || rowKeg.includes(targetKeg) || targetKeg.includes(rowKeg)) &&
        (rowRek === targetRek || rowRek.includes(targetRek) || targetRek.includes(rowRek))
      );
    });

    if (candidatesByCode.length === 0) {
      const candidatesByRek = phasedRows.filter(row => {
        const rowRek = cleanCode(row.kodeRekening);
        return rowRek === targetRek || rowRek.includes(targetRek) || targetRek.includes(rowRek);
      });
      if (candidatesByRek.length > 0) {
        candidatesByCode.push(...candidatesByRek);
      }
    }

    const finalCandidates = candidatesByCode.length > 0 ? candidatesByCode : phasedRows;

    let bestMatch: any = null;
    let highestScore = -1;

    for (const row of finalCandidates) {
      const rowUraian = cleanVal(row.uraian);
      if (!rowUraian) continue;

      if (rowUraian === targetKeterangan) {
        return row; // perfect exact name match
      }

      if (rowUraian.includes(targetKeterangan) || targetKeterangan.includes(rowUraian)) {
        const score = Math.min(rowUraian.length, targetKeterangan.length) / Math.max(rowUraian.length, targetKeterangan.length);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = row;
        }
      }
    }

    if (!bestMatch) {
      const targetWords = targetKeterangan.split(/\s+/).filter(w => w.length > 1);
      for (const row of finalCandidates) {
        const rowUraian = cleanVal(row.uraian);
        if (!rowUraian) continue;
        const rowWords = rowUraian.split(/\s+/).filter(w => w.length > 1);
        
        const overlap = targetWords.filter(w => rowWords.includes(w));
        if (overlap.length > 0) {
          const score = overlap.length / Math.max(targetWords.length, rowWords.length);
          if (score > highestScore) {
            highestScore = score;
            bestMatch = row;
          }
        }
      }
    }

    return bestMatch;
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
      else if (normCheck.startsWith('5.1.02.02.01.0060')) {
        namaRekening = 'Belanja Tagihan Air';
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
      namaRekening: namaRekening || 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor' 
    };
  };

  // Dynamic template matching fields
  const [formKodeBukti, setFormKodeBukti] = useState('');
  const [formTanggalKirim, setFormTanggalKirim] = useState('');
  const [formTanggalSurat, setFormTanggalSurat] = useState('');
  const [formKabupatenCetak, setFormKabupatenCetak] = useState('Nagan Raya');
  const [formSelectedMonth, setFormSelectedMonth] = useState('');

  // Pre-save preview states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [temporaryPreviewData, setTemporaryPreviewData] = useState<SuratPemesananData | null>(null);
  const [previewCameFromForm, setPreviewCameFromForm] = useState(false);

  // Background lookup loader function
  const loadBkuAndKwitansiLookups = async () => {
    if (!user?.sekolah || !activeYear) return;
    setLoadingLookups(true);
    try {
      // Fetch RKAS rows for auto-lookup
      const rkasCacheKey = `siap_bos_cache_${user.sekolah}_rkas_${activeYear}`;
      let fetchedRkasRows = [];
      const cachedRkas = sessionStorage.getItem(rkasCacheKey);
      if (cachedRkas) {
        try {
          fetchedRkasRows = JSON.parse(cachedRkas);
        } catch (e) {}
      } else {
        try {
          const rkasResp = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              sekolah: user.sekolah,
              tahun: activeYear,
              tipe: 'RKAS'
            })
          });
          const rkasData = await rkasResp.json();
          if (rkasData.success && rkasData.rows) {
            fetchedRkasRows = rkasData.rows.map((row: any) => ({
              ...row,
              kode: cleanGoogleSheetsDateToCode(row.kode)
            }));
            sessionStorage.setItem(rkasCacheKey, JSON.stringify(fetchedRkasRows));
          }
        } catch (e) {
          console.error("Error fetching RKAS under loadBkuAndKwitansiLookups:", e);
        }
      }
      setRkasRows(fetchedRkasRows);

      // Fetch RKAS Phased rows for detailed auto-lookup
      const rkasPhasedCacheKey = `siap_bos_cache_${user.sekolah}_rkas_phased_${activeYear}`;
      let fetchedRkasPhasedRows = [];
      const cachedRkasPhased = sessionStorage.getItem(rkasPhasedCacheKey);
      if (cachedRkasPhased) {
        try {
          fetchedRkasPhasedRows = JSON.parse(cachedRkasPhased);
        } catch (e) {}
      } else {
        try {
          const rkasPhasedResp = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              sekolah: user.sekolah,
              tahun: activeYear,
              tipe: 'RKAS_PHASED'
            })
          });
          const rkasPhasedData = await rkasPhasedResp.json();
          if (rkasPhasedData.success && rkasPhasedData.rows) {
            fetchedRkasPhasedRows = rkasPhasedData.rows;
            sessionStorage.setItem(rkasPhasedCacheKey, JSON.stringify(fetchedRkasPhasedRows));
          }
        } catch (e) {
          console.error("Error fetching RKAS Phased under loadBkuAndKwitansiLookups:", e);
        }
      }
      setRkasPhasedRows(fetchedRkasPhasedRows);

      // 1. Fetch school and personnel details
      const personnelResponse = await fetch(`${import.meta.env.VITE_API_URL}?action=getDataSekolah`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ role: user.role, sekolah: user.sekolah })
      });
      const personnelData = await personnelResponse.json();
      let schoolDetails: any = null;
      if (personnelData.success && personnelData.data && personnelData.data.length > 0) {
        let rows = personnelData.data;
        if (rows[0] && (rows[0][0] === "ID" || rows[0][0] === "id" || typeof rows[0][0] === "string" && rows[0][0].toLowerCase() === "id" || rows[0][0] === "NPSN")) {
          rows = rows.slice(1);
        }
        if (rows.length > 0) {
          const s = rows[0];
          schoolDetails = {
            nama: s[2] || user.sekolah,
            kepsek: s[6] || '',
            nipKepsek: s[7] || '',
            bendahara: s[8] || '',
            nipBendahara: s[9] || '',
            kabupaten: s[4] || 'Nagan Raya',
            kecamatan: s[3] || 'Laot Tadu',
          };
          setPersonnelInfo(schoolDetails);
          setFormKepsek(schoolDetails.kepsek);
          setFormNipKepsek(schoolDetails.nipKepsek);
          setFormBendahara(schoolDetails.bendahara);
          setFormNipBendahara(schoolDetails.nipBendahara);
          setFormKabupatenCetak(schoolDetails.kabupaten || 'Nagan Raya');
        }
      }

      // 2. Fetch BKU Months status
      const monthsResponse = await fetch(`${import.meta.env.VITE_API_URL}?action=checkBkuMonths`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user.sekolah, tahun: activeYear })
      });
      const monthsData = await monthsResponse.json();
      const activeMonths = monthsData.success && monthsData.months ? monthsData.months : [];

      // 3. Fetch BKU columns for all active months in parallel
      const fetchPromises = activeMonths.map(async (m: string) => {
        const cacheKey = `siap_bos_cache_${user.sekolah}_bku_${activeYear}_${m}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const formatted = parsed.map((row: any) => ({
              ...row,
              tanggal: formatValueIfDate(row.tanggal, true),
            }));
            return { month: m, rows: formatted };
          } catch (e) {}
        }
        try {
          const resp = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ sekolah: user.sekolah, tahun: activeYear, tipe: m })
          });
          const res = await resp.json();
          if (res.success && res.rows) {
            const formatted = res.rows.map((row: any) => ({
              ...row,
              tanggal: formatValueIfDate(row.tanggal, true),
            }));
            sessionStorage.setItem(cacheKey, JSON.stringify(formatted));
            return { month: m, rows: formatted };
          }
        } catch (err) {}
        return { month: m, rows: [] };
      });

      const promisesResults = await Promise.all(fetchPromises);
      const bkuGrouped: { [key: string]: any } = {};

      promisesResults.forEach((resObj: any) => {
        if (resObj && resObj.rows) {
          resObj.rows.forEach((row: any) => {
            const bukti = String(row.bukti || '').trim();
            const kreditVal = parseFloat(row.kredit) || 0;
            if (bukti && bukti !== '-' && kreditVal > 0) {
              if (!bkuGrouped[bukti]) {
                bkuGrouped[bukti] = {
                  bukti,
                  tanggal: String(row.tanggal).trim(),
                  bulan: resObj.month,
                  items: [],
                  totalKredit: 0,
                };
              }
              bkuGrouped[bukti].items.push({
                keterangan: String(row.keterangan || '').trim(),
                kredit: kreditVal,
                kodeKegiatan: String(row.kodeKegiatan || '').trim(),
                kodeRekening: String(row.kodeRekening || '').trim(),
              });
              bkuGrouped[bukti].totalKredit += kreditVal;
            }
          });
        }
      });

      // Fetch saved Kwitansis to obtain recipients for each noBukti/bukti
      const kwResponse = await fetch(`${import.meta.env.VITE_API_URL}?action=getKwitansis`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user.sekolah, tahun: activeYear })
      });
      const kwData = await kwResponse.json();
      const kwMap: { [key: string]: string } = {};
      if (kwData.success && kwData.data) {
        kwData.data.forEach((kw: any) => {
          if (kw.noKwitansi) {
            kwMap[kw.noKwitansi] = kw.penerima;
          }
        });
      }

      const lookupsArray = Object.values(bkuGrouped).map((group: any) => {
        const localRecipient = localStorage.getItem(`siap_bos_penerima_${group.bukti}`) || kwMap[group.bukti] || '';
        return {
          ...group,
          penerima: localRecipient,
        };
      });

      // Sort lookupsArray ascending alphabetically/numerically so BPU01, BPU02, etc. are at the top
      lookupsArray.sort((a, b) => {
        const codeA = String(a.bukti || '').trim();
        const codeB = String(b.bukti || '').trim();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setBkuLookups(lookupsArray);
    } catch (e) {
      console.error("Error setting up BKU lookups:", e);
    } finally {
      setLoadingLookups(false);
    }
  };

  // Load orders and lookup details
  useEffect(() => {
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

    const storageKey = `siap_bos_sp_${user?.sekolah || 'default'}_${activeYear}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setOrders(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing saved SP:", e);
      }
    } else {
      setOrders([]);
    }

    // Call lookups loader to load school and BKU info
    loadBkuAndKwitansiLookups();
  }, [user?.sekolah, activeYear]);

  // Synchronize school personnel details from personnelInfo to the form automatically
  useEffect(() => {
    if (personnelInfo && showFormModal) {
      setFormKepsek(personnelInfo.kepsek || '');
      setFormNipKepsek(personnelInfo.nipKepsek || '');
      setFormBendahara(personnelInfo.bendahara || '');
      setFormNipBendahara(personnelInfo.nipBendahara || '');
    }
  }, [personnelInfo, showFormModal]);

  // Save back to local storage
  const saveOrdersToStorage = (updatedOrders: SuratPemesananData[]) => {
    const storageKey = `siap_bos_sp_${user?.sekolah || 'default'}_${activeYear}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedOrders));
    setOrders(updatedOrders);
  };

  const handleOpenCreateModal = () => {
    setEditingOrder(null);
    setFormNomorSp('');
    setFormTanggal(new Date().toISOString().substring(0, 10));
    setFormNamaPenyedia('');
    setFormAlamatPenyedia('');
    setFormPimpinanPenyedia('');
    setFormCatatan('');
    setFormItems([]);
    setFormKodeBukti('');
    setFormSelectedMonth('');
    setFormTanggalKirim(tryFormatToIndonesianDate(new Date().toISOString().substring(0,10)));
    setFormTanggalSurat(getOneDayBefore(new Date().toISOString().substring(0,10)));
    setFormKabupatenCetak(personnelInfo?.kabupaten || 'Nagan Raya');
    setFormSpType('');

    // Load personnel details from cache or lookups
    if (personnelInfo) {
      setFormKepsek(personnelInfo.kepsek || '');
      setFormNipKepsek(personnelInfo.nipKepsek || '');
      setFormBendahara(personnelInfo.bendahara || '');
      setFormNipBendahara(personnelInfo.nipBendahara || '');
    } else {
      const personnelCacheKey = `siap_bos_cache_${user?.sekolah || 'default'}_personnel`;
      const cachedPersonnel = sessionStorage.getItem(personnelCacheKey);
      if (cachedPersonnel) {
        try {
          const info = JSON.parse(cachedPersonnel);
          setFormKepsek(info.kepsek || '');
          setFormNipKepsek(info.nipKepsek || '');
          setFormBendahara(info.bendahara || '');
          setFormNipBendahara(info.nipBendahara || '');
        } catch (e) {}
      }
    }
    setShowFormModal(true);
  };

  const handleOpenEditModal = (order: SuratPemesananData) => {
    setEditingOrder(order);
    setFormNomorSp(order.nomorSp);
    setFormTanggal(order.tanggal);
    setFormNamaPenyedia(order.namaPenyedia);
    setFormAlamatPenyedia(order.alamatPenyedia || '');
    setFormPimpinanPenyedia(order.pimpinanPenyedia || '');
    setFormCatatan(order.catatan || '');
    setFormItems(order.items);
    setFormKepsek(order.kepsek);
    setFormNipKepsek(order.nipKepsek);
    setFormBendahara(order.bendahara);
    setFormNipBendahara(order.nipBendahara);
    
    setFormKodeBukti(order.kodeBukti || '');
    const matchedBku = bkuLookups.find(l => l.bukti === (order.kodeBukti || ''));
    setFormSelectedMonth(matchedBku ? (matchedBku.bulan || '') : '');
    
    setFormTanggalKirim(order.tanggalKirim || tryFormatToIndonesianDate(order.tanggal));
    setFormTanggalSurat(order.tanggalSurat || getOneDayBefore(order.tanggal));
    setFormKabupatenCetak(order.kabupatenCetak || personnelInfo?.kabupaten || 'Nagan Raya');
    setFormSpType(order.transactionType || '');
    
    setShowFormModal(true);
  };

  const handleDeleteOrder = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteOrder = () => {
    if (deleteConfirmId) {
      const updated = orders.filter(o => o.id !== deleteConfirmId);
      saveOrdersToStorage(updated);
      setDeleteConfirmId(null);
      toast.success("Surat Pemesanan berhasil dihapus.");
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

    const newItem: OrderedItem = {
      id: Date.now().toString(),
      namaBarang: itemNama,
      kodeKegiatan: itemKeg,
      kodeRekening: itemRek || '5.1.02.01.01.0026',
      volume: itemVol,
      satuan: itemSatuan,
      hargaSatuan: itemHarga,
      total: itemVol * itemHarga
    };

    setFormItems([...formItems, newItem]);
    setItemNama('');
    setItemKeg('');
    setItemRek('');
    setItemVol(1);
    setItemSatuan('Pcs');
    setItemHarga(0);
    toast.success("Barang pesanan ditambahkan ke daftar.");
  };

  const handleRemoveItem = (id: string) => {
    setFormItems(formItems.filter(item => item.id !== id));
  };

  const handleSaveOrder = () => {
    if (formItems.length === 0) {
      toast.warning("Masukkan minimal 1 barang pesanan!");
      return;
    }

    const orderData: SuratPemesananData = {
      id: editingOrder ? editingOrder.id : Date.now().toString(),
      nomorSp: formNomorSp,
      tanggal: formTanggal,
      namaPenyedia: formNamaPenyedia,
      alamatPenyedia: formAlamatPenyedia,
      pimpinanPenyedia: formPimpinanPenyedia,
      items: formItems,
      kepsek: formKepsek,
      nipKepsek: formNipKepsek,
      bendahara: formBendahara,
      nipBendahara: formNipBendahara,
      catatan: formCatatan,
      activeYear: activeYear,
      
      kodeBukti: formKodeBukti,
      tanggalKirim: formTanggalKirim,
      tanggalSurat: formTanggalSurat,
      kabupatenCetak: formKabupatenCetak,
      transactionType: formSpType as any,
    };

    let updatedList = [...orders];
    if (editingOrder) {
      updatedList = updatedList.map(item => item.id === editingOrder.id ? orderData : item);
      toast.success("Surat Pemesanan berhasil diperbarui!");
    } else {
      updatedList.unshift(orderData);
      toast.success("Surat Pemesanan baru berhasil disimpan!");
    }

    saveOrdersToStorage(updatedList);
    setShowFormModal(false);
  };

  const handlePreviewFromForm = () => {
    if (formItems.length === 0) {
      toast.warning("Masukkan minimal 1 barang pesanan untuk melihat preview!");
      return;
    }
    const currentPreviewData: SuratPemesananData = {
      id: editingOrder ? editingOrder.id : 'preview_temp',
      nomorSp: formNomorSp,
      tanggal: formTanggal,
      namaPenyedia: formNamaPenyedia,
      alamatPenyedia: formAlamatPenyedia,
      pimpinanPenyedia: formPimpinanPenyedia,
      items: formItems,
      kepsek: formKepsek,
      nipKepsek: formNipKepsek,
      bendahara: formBendahara,
      nipBendahara: formNipBendahara,
      catatan: formCatatan,
      activeYear: activeYear,
      kodeBukti: formKodeBukti,
      tanggalKirim: formTanggalKirim,
      tanggalSurat: formTanggalSurat,
      kabupatenCetak: formKabupatenCetak,
    };
    setPreviewCameFromForm(true);
    setTemporaryPreviewData(currentPreviewData);
    setShowFormModal(false);
    setShowPreviewModal(true);
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
    if (previewCameFromForm) {
      setShowFormModal(true);
    }
  };

  const triggerPrint = (order: SuratPemesananData) => {
    if (!order) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela cetak. Pastikan izin popup browser diaktifkan.');
      return;
    }

    const itemsHtml = order.items.map((item, idx) => `
      <tr class="border-b border-black">
        <td class="border border-black py-1 text-center text-[11px]">${idx + 1}</td>
        <td class="border border-black py-1 px-2.5 text-[11px] text-justify font-bold">${item.namaBarang}</td>
        <td class="border border-black py-1 text-center font-bold text-[11px]">${item.volume}</td>
        <td class="border border-black py-1 text-center uppercase text-[11px]">${item.satuan}</td>
        <td class="border border-black py-1 px-2.5 text-right text-[11px]">
          <div class="flex justify-between w-full font-mono">
            <span>RP</span>
            <span>${item.hargaSatuan.toLocaleString('id-ID')}</span>
          </div>
        </td>
        <td class="border border-black py-1 px-2.5 text-right font-black text-[11px]">
          <div class="flex justify-between w-full font-mono">
            <span>RP</span>
            <span>${(item.volume * item.hargaSatuan).toLocaleString('id-ID')}</span>
          </div>
        </td>
      </tr>
    `).join('');

    const totalKredit = order.items.reduce((acc, it) => acc + (it.volume * it.hargaSatuan), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Pemesanan - ${order.nomorSp}</title>
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
            <div class="text-sm font-bold text-gray-800">Pratinjau Surat Pemesanan (A4 Portrait)</div>
            <div class="text-xs text-gray-500">Nomor SP: ${order.nomorSp}</div>
          </div>
          <button onclick="window.print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">
            Cetak Surat Pemesanan
          </button>
        </div>

        <div class="a4-page text-black leading-snug text-[11.5px]">
          <!-- Centered Title -->
          <div class="text-center mb-5">
            <h1 class="text-[14px] font-bold tracking-wide uppercase">SURAT PEMESANAN BARANG</h1>
          </div>

          <!-- Metadata table following exactly the design image -->
          <div class="mb-4 text-left text-black">
            <table class="w-full text-[11.5px] text-black border-none border-collapse text-left">
              <tbody>
                <tr class="border-none">
                  <td class="w-24 font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Nomor</td>
                  <td class="w-4 py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 valign-top align-top border-none text-black font-semibold">${order.nomorSp || '……………………………………'}</td>
                </tr>
                <tr class="border-none">
                  <td class="font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Pemesan</td>
                  <td class="py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 border-none text-black">
                    <div class="font-normal">${user?.sekolah || 'SD Negeri 2 Laot Tadu'}</div>
                    <div class="pl-4 mt-0.5 space-y-0.5 text-black">
                      <p>1. ${order.kepsek || 'Budiyanto, S.Pd'} (Kepala Sekolah)</p>
                      <p>2. ${order.bendahara || 'Nana Rosdiana, S.Pd'} (Bendahara Sekolah)</p>
                    </div>
                  </td>
                </tr>
                <tr class="border-none">
                  <td class="font-normal py-0.5 px-0 valign-top align-top whitespace-nowrap border-none text-black">Penyedia</td>
                  <td class="py-0.5 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td class="py-0.5 px-0 valign-top align-top border-none text-black">${order.namaPenyedia || 'Toko Hafifi 2'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Underlined selection label -->
          <p class="mt-4 mb-2 text-[11.5px] font-normal underline text-black">Dengan ini memesan barang sebagai berikut :</p>

          <!-- Table -->
          <table class="w-full border-collapse border border-black text-[11.5px] mb-4">
            <thead>
              <tr class="font-bold border-b border-black text-black bg-gray-50/50">
                <th class="border border-black py-1 px-1 text-center w-10">NO</th>
                <th class="border border-black py-1 px-2.5 text-left">NAMA BARANG</th>
                <th class="border border-black py-1 px-2 text-center w-16">VOLUME</th>
                <th class="border border-black py-1 px-2 text-center w-20">SATUAN</th>
                <th class="border border-black py-1 px-2.5 text-right w-32">HARGA SATUAN</th>
                <th class="border border-black py-1 px-2.5 text-right w-32">JUMLAH</th>
              </tr>
            </thead>
            <tbody class="text-black">
              ${itemsHtml}
              <tr class="font-bold">
                <td colSpan="5" class="border border-black py-1 px-2.5 text-center uppercase text-black">TOTAL</td>
                <td class="border border-black py-1 px-2.5 text-right text-black font-black">
                  <div class="flex justify-between w-full font-mono">
                    <span>RP</span>
                    <span class="underline">${totalKredit.toLocaleString('id-ID')}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Body paragraph text strictly following formatting -->
          <p class="mb-2 text-[11.5px] text-justify leading-relaxed text-black font-normal">
            Kami berharap barang yang dipesan agar segera diproses dan dikirimkan kesekolah pada tanggal <strong class="font-bold">${order.tanggalKirim || '4 Februari 2025'}</strong>. Pembayaran akan dilakukan setelah barang diterima dalam keadaan baik dan sesuai pemesanan.
          </p>

          <p class="mb-4 text-[11.5px] text-justify leading-relaxed text-black font-normal">
            Demikian surat pemesanan barang ini kami buat. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.
          </p>

          <!-- Signatures on the right side - Kepala Sekolah only -->
          <div class="mt-6 flex justify-end text-[11.5px] text-black font-normal">
            <div class="w-72 space-y-12 text-left">
              <div>
                <p>${order.kabupatenCetak || 'Nagan Raya'}, ${order.tanggalSurat || '3 Februari 2025'}</p>
                <p>Hormat kami,</p>
                <p>Kepala ${user?.sekolah || 'SD Negeri 2 Laot Tadu'}</p>
              </div>
              <div class="space-y-0.5">
                <p class="font-bold underline">${order.kepsek || 'Budiyanto, S.Pd'}</p>
                ${(order.nipKepsek && order.nipKepsek.trim() !== '') ? `<p>NIP. ${order.nipKepsek}</p>` : ''}
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

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.nomorSp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.namaPenyedia.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some(item => item.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()));
      
    let matchesMonth = true;
    if (filterMonth) {
      const d = parseSmartDate(o.tanggal);
      if (d) {
        // Month is 0-indexed, so we add 1 for comparison
        matchesMonth = (d.getMonth() + 1).toString() === filterMonth;
      } else {
        matchesMonth = false;
      }
    }
    
    return matchesSearch && matchesMonth;
  }).sort((a, b) => {
    const codeA = String(a.kodeBukti || a.nomorSp || '').trim();
    const codeB = String(b.kodeBukti || b.nomorSp || '').trim();
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const getKeterangan = (item: OrderedItem): string => {
    const desc = findRkasDescriptions(item.kodeKegiatan, item.kodeRekening);
    return `${desc.namaKegiatan} (${item.kodeKegiatan})`;
  };

  const calculateTotal = (items: OrderedItem[]) => {
    return items.reduce((sum, item) => sum + (item.volume * item.hargaSatuan), 0);
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
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight font-sans">Pratinjau Cetak Surat Pemesanan PDF</h3>
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
              <FileText size={24} />
            </span>
            Surat Pemesanan (Order Kerja)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manajemen dokumen pemesanan barang dan jasa sekolah (BOS) kepada penyedia/toko rekanan.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-xs"
          >
            <Plus size={18} />
            Buat Surat Pemesanan
          </button>
        </div>
      </div>

      {/* Main UI Search and Lists */}
      <div className="grid grid-cols-1 gap-6 print:hidden">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor SP, nama toko/rekanan, atau item barang..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 transition text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase">Bulan:</span>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="py-1.5 px-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden"
              >
                <option value="">Semua</option>
                {[...Array(12).keys()].map(m => (
                  <option key={m + 1} value={(m + 1).toString()}>{new Date(2026, m).toLocaleString('id-ID', { month: 'long' })}</option>
                ))}
              </select>
              <span className="text-xs font-semibold text-gray-400 uppercase ml-2">Tahun Aktif:</span>
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
            {filteredOrders.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-gray-950">
                    <th className="py-3 px-4">No. Bukti</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-right">Nilai Pesanan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                  {filteredOrders.map((order) => {
                    const totalVal = calculateTotal(order.items);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 text-gray-900 dark:text-white transition-colors">
                        <td className="py-3 px-4 font-bold font-mono">{order.kodeBukti || order.nomorSp || '-'}</td>
                        <td className="py-3 px-4 max-w-xs truncate text-[11px]">
                          {order.items.length > 0 ? getKeterangan(order.items[0]) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totalVal)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!['SIPLAH', 'HONORARIUM', 'PERJALANAN_DINAS', 'TIDAK_MEMERLUKAN_SURAT'].includes(order.transactionType || '') && (
                              <>
                                <button
                                  onClick={() => {
                                    setPreviewCameFromForm(false);
                                    setTemporaryPreviewData(order);
                                    setShowPreviewModal(true);
                                  }}
                                  title="Preview Surat Pemesanan"
                                  className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/55 rounded-lg transition"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => triggerPrint(order)}
                                  title="Cetak Surat Pemesanan"
                                  className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                                >
                                  <Printer size={16} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleOpenEditModal(order)}
                              title="Edit SP"
                              className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              title="Hapus SP"
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
                <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                <p className="font-semibold">Belum ada Surat Pemesanan</p>
                <p className="text-xs mt-1">Buat surat pemesanan baru untuk mengawasi pesanan sekolah ke rekanan.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save / Create Modal Dialog */}
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
                  <FileText className="text-indigo-600" />
                  {editingOrder ? 'Edit Surat Pemesanan' : 'Buat Surat Pemesanan Baru'}
                </h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Kode Bukti Auto-Link dropdowns (Month & No. Bukti Selector) */}
              <div className="mb-6 p-5 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase mb-1 flex items-center gap-1.5 font-sans">
                      <Calendar size={14} /> 1. Pilih Bulan RKAS/BKU
                    </label>
                    <select
                      value={formSelectedMonth}
                      onChange={(e) => {
                        setFormSelectedMonth(e.target.value);
                        setFormKodeBukti(''); // reset No.Bukti
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs text-gray-900 dark:text-white font-bold tracking-wide focus:outline-hidden"
                    >
                      <option value="">-- Semua Bulan BKU --</option>
                      {(() => {
                        const standardIndonesianMonths = [
                          { id: 'januari', name: 'Januari' },
                          { id: 'februari', name: 'Februari' },
                          { id: 'maret', name: 'Maret' },
                          { id: 'april', name: 'April' },
                          { id: 'mei', name: 'Mei' },
                          { id: 'juni', name: 'Juni' },
                          { id: 'juli', name: 'Juli' },
                          { id: 'agustus', name: 'Agustus' },
                          { id: 'september', name: 'September' },
                          { id: 'oktober', name: 'Oktober' },
                          { id: 'november', name: 'November' },
                          { id: 'desember', name: 'Desember' },
                        ];
                        const uniqueFormMonths = Array.from(new Set(bkuLookups.map(l => String(l.bulan || '').trim().toLowerCase()))).filter(Boolean);
                        const availableMonths = uniqueFormMonths.length > 0
                          ? standardIndonesianMonths.filter(m => uniqueFormMonths.includes(m.id))
                          : standardIndonesianMonths;
                        
                        return availableMonths.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div className="md:col-span-8">
                    <label className="block text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase mb-1 flex items-center gap-1.5 font-sans">
                      <Receipt size={14} /> 2. Pilih No. Bukti Transaksi
                    </label>
                    <select
                      value={formKodeBukti}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormKodeBukti(val);
                        if (val === '') return;
                        
                        const matched = bkuLookups.find(l => l.bukti === val);
                        if (matched) {
                          setFormNamaPenyedia(matched.penerima || 'Toko Hafifi 2');
                          setFormTanggal(matched.tanggal);
                          setFormTanggalKirim(tryFormatToIndonesianDate(matched.tanggal));
                          setFormTanggalSurat(getOneDayBefore(matched.tanggal));
                          setFormNomorSp('');
                          
                          const mappedItems = matched.items.map((it: any, index: number) => {
                            const rkasMatch = findRkasPhasedMatch(
                              it.kodeKegiatan,
                              it.kodeRekening,
                              it.keterangan,
                              rkasPhasedRows
                            );

                            let hargaSatuanObj = parseFloat(it.kredit || 0);
                            let satuanObj = 'Pcs';
                            let volumeObj = 1;

                            if (rkasMatch) {
                              const matchedTarif = parseFloat(String(rkasMatch.tarifHarga || '').replace(/[^0-9.-]+/g, '')) || 0;
                              if (matchedTarif > 0) {
                                hargaSatuanObj = matchedTarif;
                                const totalKredit = parseFloat(it.kredit || 0);
                                if (totalKredit > 0) {
                                  volumeObj = Math.round(totalKredit / matchedTarif) || 1;
                                }
                              }
                              if (rkasMatch.satuan) {
                                satuanObj = rkasMatch.satuan;
                              }
                            }

                            return {
                              id: `bku_${index}_${Date.now()}`,
                              namaBarang: it.keterangan,
                              kodeKegiatan: it.kodeKegiatan,
                              kodeRekening: it.kodeRekening,
                              volume: volumeObj,
                              satuan: satuanObj,
                              hargaSatuan: hargaSatuanObj,
                              total: volumeObj * hargaSatuanObj,
                              originalTotal: parseFloat(it.kredit || 0),
                            };
                          });
                          setFormItems(mappedItems);
                          toast.success(`Transaksi ${val} berhasil dimuat otomatis.`);
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs text-gray-900 dark:text-white font-bold tracking-wide focus:outline-hidden"
                    >
                      <option value="">-- Buat / Ketik Manual (Tanpa Kode Bukti) --</option>
                      {bkuLookups
                        .filter(l => !formSelectedMonth || (l.bulan && l.bulan.toLowerCase() === formSelectedMonth.toLowerCase()))
                        .map(look => {
                          const isCreated = orders.some(o => o.kodeBukti === look.bukti);
                          const readableDate = tryFormatToIndonesianDate(look.tanggal);
                          return (
                            <option key={look.bukti} value={look.bukti}>
                              {isCreated ? '✔️ [SUDAH DIBUAT] ' : '📄 '} {look.bukti} - {look.penerima || 'Tanpa Penerima'} ({readableDate}) ({look.items.length} item - Rp {look.totalKredit.toLocaleString('id-ID')})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {/* Uraian Kegiatan Berdasarkan Kode Kegiatan dan Kode Rekening */}
                {(() => {
                  const currentBkuGroup = bkuLookups.find(l => l.bukti === formKodeBukti);
                  if (!currentBkuGroup) return null;

                  // Get unique pairs of Kode Kegiatan & Kode Rekening to avoid duplication and clutter
                  const uniquePairs: { kodeKegiatan: string; kodeRekening: string }[] = [];
                  currentBkuGroup.items.forEach((it: any) => {
                    const alreadyExists = uniquePairs.some(
                      p => p.kodeKegiatan === it.kodeKegiatan && p.kodeRekening === it.kodeRekening
                    );
                    if (!alreadyExists) {
                      uniquePairs.push({
                        kodeKegiatan: it.kodeKegiatan || '',
                        kodeRekening: it.kodeRekening || ''
                      });
                    }
                  });

                  return (
                    <div className="mt-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 rounded-xl">
                      <h4 className="text-[11px] font-extrabold text-emerald-850 dark:text-emerald-400 uppercase tracking-wider mb-2.5">
                        Keterangan Kode Kegiatan dan Kode Rekening RKAS:
                      </h4>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {uniquePairs.map((pair, idx) => {
                          const rkasDesc = findRkasDescriptions(pair.kodeKegiatan, pair.kodeRekening);
                          return (
                            <div 
                              key={idx} 
                              className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-150 dark:border-gray-800 text-xs flex flex-col gap-3 shadow-xs"
                            >
                              <div className="space-y-3 text-xs">
                                <div>
                                  <span className="font-extrabold text-[9.5px] text-emerald-800 dark:text-emerald-400 uppercase tracking-widest block mb-0.5">Kode Kegiatan</span>
                                  <div className="bg-emerald-50/20 dark:bg-emerald-950/5 p-2 rounded-lg border border-emerald-100/40 dark:border-emerald-950/20 leading-relaxed text-[11px]">
                                    <strong className="font-mono text-emerald-700 dark:text-emerald-300 font-bold mr-1">{rkasDesc.kodeKegiatan}</strong>
                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{rkasDesc.namaKegiatan}</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="font-extrabold text-[9.5px] text-blue-800 dark:text-blue-400 uppercase tracking-widest block mb-0.5">Kode Rekening</span>
                                  <div className="bg-blue-50/20 dark:bg-blue-950/5 p-2 rounded-lg border border-blue-100/40 dark:border-blue-950/20 leading-relaxed text-[11px]">
                                    <strong className="font-mono text-blue-700 dark:text-blue-300 font-bold mr-1">{rkasDesc.kodeRekening}</strong>
                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{rkasDesc.namaRekening}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Pilihan Metode Pemesanan / Jenis Pengeluaran */}
              <div className="mt-4 p-4.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl bg-indigo-50/50">
                <label className="block text-xs font-bold text-indigo-750 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <HelpCircle size={15} className="text-indigo-600 dark:text-indigo-400" /> Pilihan Tipe / Metode Transaksi:
                </label>
                <select
                  value={formSpType}
                  onChange={(e) => setFormSpType(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs text-gray-900 dark:text-white font-extrabold tracking-wide focus:outline-hidden"
                >
                  <option value="">-- BUAT / CETAK SURAT PEMESANAN BARU (MANUAL ATAU BKU) --</option>
                  <option value="SIPLAH">SIPLAH (JIKA SIPLAH UNTUK SURAT PEMESANAN SUDAH ADA DI APLIKASI SIPLAH)</option>
                  <option value="HONORARIUM">HONORARIUM (DATA NO.BUKTI MASUK KE MENU HONORARIUM)</option>
                  <option value="PERJALANAN_DINAS">PERJALANAN DINAS (DATA NO.BUKTI MASUK KE MENU HONORARIUM)</option>
                  <option value="TIDAK_MEMERLUKAN_SURAT">TIDAK MEMERLUKAN SURAT PEMESANAN (TIDAK ADA AKSI PREVIEW/CETAK)</option>
                </select>
                <div className="flex flex-wrap gap-4 mt-3">
                  {['SIPLAH', 'HONORARIUM', 'PERJALANAN_DINAS', 'TIDAK_MEMERLUKAN_SURAT'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSpType === type} 
                        onChange={() => setFormSpType(type)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {`[${type.replace('_', ' ')}]`}
                    </label>
                  ))}
                </div>
              </div>

              {formSpType === "" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left col: Order metadata */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor Surat Pemesanan</label>
                    <input
                      type="text"
                      value={formNomorSp}
                      onChange={(e) => setFormNomorSp(e.target.value)}
                      placeholder="e.g. ...../SP/BOS/2026"
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-900 dark:text-white font-medium"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Kabupaten Pembuatan</label>
                    <input
                      type="text"
                      value={formKabupatenCetak}
                      disabled={true}
                      placeholder="e.g. Nagan Raya"
                      className="w-full px-3.5 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-hidden text-gray-500 dark:text-gray-400 font-bold cursor-not-allowed opacity-80"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tgl Surat Pemesanan</label>
                      <input
                        type="text"
                        value={formTanggalSurat}
                        onChange={(e) => setFormTanggalSurat(e.target.value)}
                        placeholder="e.g. 3 Februari 2025"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 text-gray-900 dark:text-white font-semibold text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tgl Kirim Barang</label>
                      <input
                        type="text"
                        value={formTanggalKirim}
                        disabled={true}
                        placeholder="e.g. 4 Februari 2025"
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden text-gray-550 dark:text-gray-400 font-bold text-center cursor-not-allowed opacity-80"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/30">
                    <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase mb-2">Informasi Penyedia</h3>
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        placeholder="Nama Penyedia"
                        value={formNamaPenyedia}
                        onChange={(e) => setFormNamaPenyedia(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Alamat Penyedia"
                        value={formAlamatPenyedia}
                        onChange={(e) => setFormAlamatPenyedia(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Nama Pimpinan/Penanggung Jawab"
                        value={formPimpinanPenyedia}
                        onChange={(e) => setFormPimpinanPenyedia(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Right col: School personnel default */}
                <div className="space-y-4">
                  <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100/30 space-y-2.5">
                    <h3 className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase mb-1">Pejabat Sekolah (Penandatangan)</h3>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Kepala Sekolah (Kepsek)</label>
                      <input
                        type="text"
                        value={formKepsek}
                        disabled={true}
                        placeholder="Nama Kepala Sekolah"
                        className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-550 dark:text-gray-400 font-bold cursor-not-allowed opacity-80"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">NIP Kepala Sekolah</label>
                      <input
                        type="text"
                        value={formNipKepsek}
                        disabled={true}
                        placeholder="NIP Kepsek"
                        className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-550 dark:text-gray-400 font-bold cursor-not-allowed opacity-80"
                      />
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800/80 my-2 pt-2" />
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Bendahara BOS</label>
                      <input
                        type="text"
                        value={formBendahara}
                        disabled={true}
                        placeholder="Nama Bendahara"
                        className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-550 dark:text-gray-400 font-bold cursor-not-allowed opacity-80"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">NIP Bendahara</label>
                      <input
                        type="text"
                        value={formNipBendahara}
                        disabled={true}
                        placeholder="NIP Bendahara"
                        className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs focus:outline-hidden text-gray-550 dark:text-gray-400 font-bold cursor-not-allowed opacity-80"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic ordered item addition */}
              <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4 font-sans">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Rincian Barang yang Dipesan</h3>

                {/* Table of added items with INLINE EDITING */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 bg-gray-50 dark:bg-gray-950 font-bold">
                        <th className="py-2.5 px-3">Nama Belanja</th>
                        <th className="py-2.5 px-3 text-center w-16">Vol</th>
                        <th className="py-2.5 px-3 text-center w-20">Satuan</th>
                        <th className="py-2.5 px-3 text-right w-32">Harga Satuan (Rp)</th>
                        <th className="py-2.5 px-3 text-right w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {formItems.map((it, idx) => (
                        <tr key={it.id} className="text-gray-950 dark:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                          <td className="py-2 px-1">
                            <input
                              type="text"
                              value={it.namaBarang}
                              disabled
                              className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                          </td>
                          <td className="py-2 px-1 w-16">
                            <input
                              type="number"
                              value={it.volume}
                              onChange={(e) => {
                                const updated = [...formItems];
                                const newVolume = Math.max(1, parseInt(e.target.value) || 1);
                                updated[idx].volume = newVolume;
                                updated[idx].total = newVolume * updated[idx].hargaSatuan;
                                setFormItems(updated);
                              }}
                              className="w-full px-1.5 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-xs font-bold text-center text-gray-950 dark:text-white"
                            />
                          </td>
                          <td className="py-2 px-1 w-20">
                            <input
                              type="text"
                              value={it.satuan}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].satuan = e.target.value;
                                setFormItems(updated);
                              }}
                              placeholder="Rim/Pcs"
                              className="w-full px-1.5 py-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-xs text-center text-gray-955 dark:text-white"
                            />
                          </td>
                          <td className="py-2 px-1 w-32">
                            <input
                              type="number"
                              value={isNaN(it.hargaSatuan) ? '' : it.hargaSatuan}
                              disabled
                              className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-md text-xs font-medium text-right text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className={`font-bold ${it.originalTotal !== undefined && Math.round(it.volume * it.hargaSatuan) !== Math.round(it.originalTotal) ? 'text-gray-400 text-[10px]' : 'text-gray-900 dark:text-white font-black'}`}>
                              Rp {(it.originalTotal ?? it.total).toLocaleString('id-ID')}
                            </div>
                            {it.originalTotal !== undefined && Math.round(it.volume * it.hargaSatuan) !== Math.round(it.originalTotal) && (
                              <div className="text-red-500 font-black text-xs mt-0.5 animate-pulse">
                                Rp {(it.volume * it.hargaSatuan).toLocaleString('id-ID')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {formItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                            Belum ada item pesanan yang dimasukkan. silakan hubungkan dengan Kode Bukti di atas atau masukkan item manually.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col items-end gap-2 p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                  {formItems.some(it => it.originalTotal !== undefined && Math.round(it.volume * it.hargaSatuan) !== Math.round(it.originalTotal)) && (
                    <div className="text-red-500 text-[11px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Jumlah harga pemesanan tidak sesuai pada data BKU
                    </div>
                  )}
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2 text-[10px]">Total Nilai : </span>
                    <span className={`font-black text-xl ${
                      formItems.some(it => it.originalTotal !== undefined && Math.round(it.volume * it.hargaSatuan) !== Math.round(it.originalTotal)) 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      Rp {calculateTotal(formItems).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>


              </div>
                </>
              ) : (
                /* Explanation panel when other methods are selected */
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 p-6 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-850 dark:text-amber-350">
                        {formSpType === 'SIPLAH' && 'Pemesanan Resmi Melalui Portal SIPLAH'}
                        {formSpType === 'HONORARIUM' && 'Transaksi Honorarium Pendidik / Tenaga Kependidikan'}
                        {formSpType === 'PERJALANAN_DINAS' && 'Belanja Perjalanan Dinas & Transport Resmi'}
                      </h4>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                        {formSpType === 'SIPLAH' && (
                          <>
                            <strong>Surat Pemesanan (PO) untuk transaksi ini tidak perlu dibuat secara manual di sini.</strong>
                            {" Segala dokumen penawaran sah, pemesanan, dan bast telah diterbitkan secara otomatis dan resmi oleh sistem Kemdikbudristek (SIPLAH) dan terintegrasi dengan penyedia terkait."}
                          </>
                        )}
                        
                        {formSpType === 'HONORARIUM' && (
                          <>
                            <strong>Jenis pengeluaran ini adalah pembayaran honorarium / upah buranan guru, TU, operator, atau penjaga sekolah.</strong>
                            {" Transaksi pembayaran honor tenaga kerja tidak memerlukan dokumen administrasi Surat Pemesanan (PO) barang belanja."}
                          </>
                        )}

                        {formSpType === 'PERJALANAN_DINAS' && (
                          <>
                            <strong>Jenis pengeluaran ini adalah biaya perjalanan dinas/studi banding/pelatihan guru.</strong>
                            {" Transaksi perjalanan dinas tidak memerlukan pembuatan dokumen Surat Pemesanan (PO) barang."}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-150 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                    {formSpType === 'SIPLAH' && (
                      <>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold block mb-1">💡 Status Pemesanan</span>
                        <span>Sistem mendeteksi transaksi Anda diproses melalui platform SIPLAH. Seluruh isian manual Surat Pemesanan di bawah dinonaktifkan / langsung ditutup karena dokumen pemesanan Anda sudah diterbitkan resmi di SIPLAH.</span>
                      </>
                    )}

                    {formSpType === 'HONORARIUM' && (
                      <>
                        <span className="text-indigo-700 dark:text-indigo-400 font-bold block mb-1">📂 Informasi Menu</span>
                        <span>Data nomor bukti transaksi ini masuk ke modul menu <strong>Honorarium</strong>. Silakan kelola berkas atau kwitansi honorarium terkait di menu tersebut.</span>
                      </>
                    )}

                    {formSpType === 'PERJALANAN_DINAS' && (
                      <>
                        <span className="text-blue-700 dark:text-blue-400 font-bold block mb-1">📂 Informasi Menu</span>
                        <span>Data nomor bukti transaksi perjalanan dinas ini terintegrasi dengan modul menu <strong>Honorarium / Perjalanan Dinas</strong>. Silakan kelola berkas Surat Perjalanan Dinas (SPD) di menu tersebut.</span>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
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
                  onClick={handleSaveOrder}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-sm text-sm"
                >
                  <Save size={16} />
                  Simpan Surat Pemesanan
                </button>
                {formSpType === "" && (
                  <button
                    type="button"
                    onClick={handlePreviewFromForm}
                    className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-350 font-semibold py-2.5 px-5 rounded-xl transition text-sm"
                  >
                    <Eye size={16} />
                    Preview Hasil Surat
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ON-SCREEN PREVIEW DIALOG MODAL */}
      <AnimatePresence>
        {showPreviewModal && temporaryPreviewData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/75 backdrop-blur-sm print:hidden overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-5xl shadow-2xl max-h-[92vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-black text-gray-950 dark:text-white">
                    Preview Hasil Cetak Surat Pemesanan
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={18} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
                </button>
              </div>

              {/* Simulated Paper Container with realistic details */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="bg-white text-black dark:bg-white dark:text-black dark:[&_*]:text-black dark:[&_*]:border-black p-10 md:p-12 w-full max-w-4xl shadow-xl font-sans text-[13px] leading-relaxed border border-gray-300 select-none mx-auto">
                  
                  {/* Centered Title */}
                  <div className="text-center mb-6">
                    <h1 className="text-[16px] font-bold tracking-wide uppercase">SURAT PEMESANAN BARANG</h1>
                  </div>

                  {/* Metadata table following exactly the design image */}
                  <div className="mb-6 text-left">
                    <table className="w-full text-[13px] text-black border-none border-collapse text-left">
                      <tbody>
                        <tr className="border-none">
                          <td className="w-24 font-normal py-1 px-0 valign-top align-top whitespace-nowrap border-none">Nomor</td>
                          <td className="w-4 py-1 px-0 valign-top align-top text-center border-none">:</td>
                          <td className="py-1 px-0 valign-top align-top border-none">{temporaryPreviewData.nomorSp || '……………………………………'}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="font-normal py-1 px-0 valign-top align-top whitespace-nowrap border-none">Pemesan</td>
                          <td className="py-1 px-0 valign-top align-top text-center border-none">:</td>
                          <td className="py-1 px-0 border-none">
                            <div className="font-normal">{user?.sekolah || 'SD Negeri 2 Laot Tadu'}</div>
                            <div className="pl-4 mt-1 space-y-1 text-gray-800">
                              <p>1. {temporaryPreviewData.kepsek || 'Budiyanto, S.Pd'} (Kepala Sekolah)</p>
                              <p>2. {temporaryPreviewData.bendahara || 'Nana Rosdiana, S.Pd'} (Bendahara Sekolah)</p>
                            </div>
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="font-normal py-1 px-0 valign-top align-top whitespace-nowrap border-none">Penyedia</td>
                          <td className="py-1 px-0 valign-top align-top text-center border-none">:</td>
                          <td className="py-1 px-0 valign-top align-top border-none">{temporaryPreviewData.namaPenyedia || 'Toko Hafifi 2'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Underlined selection label */}
                  <p className="mt-6 mb-4 text-[13px] font-normal underline">Dengan ini memesan barang sebagai berikut :</p>

                  {/* Table of items inside preview */}
                  <table className="w-full border-collapse border border-black text-[13px] mb-6">
                    <thead>
                      <tr className="font-bold border-b border-black text-black">
                        <th className="border border-black py-2 px-1 text-center w-12">NO</th>
                        <th className="border border-black py-2 px-3 text-left">NAMA BARANG</th>
                        <th className="border border-black py-2 px-2 text-center w-20">VOLUME</th>
                        <th className="border border-black py-2 px-2 text-center w-24">SATUAN</th>
                        <th className="border border-black py-2 px-3 text-right w-36">HARGA SATUAN</th>
                        <th className="border border-black py-2 px-3 text-right w-36">JUMLAH</th>
                      </tr>
                    </thead>
                    <tbody className="text-black">
                      {temporaryPreviewData.items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-black">
                          <td className="border border-black py-2 text-center">{idx + 1}</td>
                          <td className="border border-black py-2 px-3">{item.namaBarang}</td>
                          <td className="border border-black py-2 text-center font-bold">{item.volume}</td>
                          <td className="border border-black py-2 text-center uppercase">{item.satuan}</td>
                          <td className="border border-black py-2 px-3 text-right">
                            <div className="flex justify-between w-full">
                              <span>RP</span>
                              <span>{item.hargaSatuan.toLocaleString('id-ID')}</span>
                            </div>
                          </td>
                          <td className="border border-black py-2 px-3 text-right font-semibold">
                            <div className="flex justify-between w-full">
                              <span>RP</span>
                              <span>{(item.volume * item.hargaSatuan).toLocaleString('id-ID')}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black py-2 px-3 text-center uppercase">TOTAL</td>
                        <td className="border border-black py-2 px-3 text-right font-bold">
                          <div className="flex justify-between w-full">
                            <span>RP</span>
                            <span className="underline">{calculateTotal(temporaryPreviewData.items).toLocaleString('id-ID')}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Body paragraph text strictly following formatting */}
                  <p className="mb-4 text-[13px] text-justify leading-relaxed text-black font-normal">
                    Kami berharap barang yang dipesan agar segera diproses dan dikirimkan kesekolah pada tanggal <strong className="font-bold">{temporaryPreviewData.tanggalKirim || '4 Februari 2025'}</strong>. Pembayaran akan dilakukan setelah barang diterima dalam keadaan baik dan sesuai pemesanan.
                  </p>

                  <p className="mb-6 text-[13px] text-justify leading-relaxed text-black font-normal">
                    Demikian surat pemesanan barang ini kami buat. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.
                  </p>

                  {/* Signatures on the right side - Kepala Sekolah only */}
                  <div className="mt-12 flex justify-end text-[13px] text-black font-normal">
                    <div className="w-80 space-y-16 text-left">
                      <div>
                        <p>{temporaryPreviewData.kabupatenCetak || 'Nagan Raya'}, {temporaryPreviewData.tanggalSurat || '3 Februari 2025'}</p>
                        <p>Hormat kami,</p>
                        <p>Kepala {user?.sekolah || 'SD Negeri 2 Laot Tadu'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold underline">{temporaryPreviewData.kepsek || 'Budiyanto, S.Pd'}</p>
                        {temporaryPreviewData.nipKepsek && temporaryPreviewData.nipKepsek.trim() !== '' && (
                          <p>NIP. {temporaryPreviewData.nipKepsek}</p>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons inside Preview dialog */}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="px-5 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-250 rounded-xl text-sm font-semibold transition bg-gray-250 dark:bg-gray-750"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleClosePreview();
                    triggerPrint(temporaryPreviewData);
                  }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition text-sm shadow-sm"
                >
                  <Printer size={16} />
                  Cetak Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-sm font-black text-gray-950 dark:text-white">
                    Hapus Surat Pemesanan?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                    Apakah Anda yakin ingin menghapus surat pemesanan ini? Tindakan ini bersifat permanen dan data pemesanan tidak dapat dipulihkan.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteOrder}
                  className="px-5 py-2 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINTABLE CONTAINER (Only visible during standard browsers @media print mode) */}
      {printItem && (
        <div id="siap-print-sp-canvas" className="hidden print:block bg-white text-black dark:bg-white dark:text-black dark:[&_*]:text-black dark:[&_*]:border-black p-12 max-w-4xl mx-auto font-sans leading-relaxed text-[13px]">
          
          {/* Centered Title */}
          <div className="text-center mb-6">
            <h1 className="text-[16px] font-bold tracking-wide uppercase">SURAT PEMESANAN BARANG</h1>
          </div>

          {/* Metadata table following exactly the design image */}
          <div className="mb-6 text-left text-black">
            <table className="w-full text-[13px] text-black border-none border-collapse text-left">
              <tbody>
                <tr className="border-none">
                  <td className="w-24 font-normal py-1 px-0 valign-top align-top whitespace-nowrap border-none text-black">Nomor</td>
                  <td className="w-4 py-1 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td className="py-1 px-0 valign-top align-top border-none text-black">{printItem.nomorSp || '……………………………………'}</td>
                </tr>
                <tr className="border-none">
                  <td className="font-normal py-1 px-0 valign-top align-top whitespace-nowrap border-none text-black">Pemesan</td>
                  <td className="py-1 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td className="py-1 px-0 border-none text-black">
                    <div className="font-normal">{user?.sekolah || 'SD Negeri 2 Laot Tadu'}</div>
                    <div className="pl-4 mt-1 space-y-1 text-black">
                      <p>1. {printItem.kepsek || 'Budiyanto, S.Pd'} (Kepala Sekolah)</p>
                      <p>2. {printItem.bendahara || 'Nana Rosdiana, S.Pd'} (Bendahara Sekolah)</p>
                    </div>
                  </td>
                </tr>
                <tr className="border-none">
                  <td className="font-normal py-1 px-0 valign-top align-top whitespace-nowrap border-none text-black">Penyedia</td>
                  <td className="py-1 px-0 valign-top align-top text-center border-none text-black">:</td>
                  <td className="py-1 px-0 valign-top align-top border-none text-black">{printItem.namaPenyedia || 'Toko Hafifi 2'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Underlined selection label */}
          <p className="mt-6 mb-4 text-[13px] font-normal underline text-black">Dengan ini memesan barang sebagai berikut :</p>

          {/* Table */}
          <table className="w-full border-collapse border border-black text-[13px] mb-6">
            <thead>
              <tr className="font-bold border-b border-black text-black">
                <th className="border border-black py-2 px-1 text-center w-12">NO</th>
                <th className="border border-black py-2 px-3 text-left">NAMA BARANG</th>
                <th className="border border-black py-2 px-2 text-center w-20">VOLUME</th>
                <th className="border border-black py-2 px-2 text-center w-24">SATUAN</th>
                <th className="border border-black py-2 px-3 text-right w-36">HARGA SATUAN</th>
                <th className="border border-black py-2 px-3 text-right w-36">JUMLAH</th>
              </tr>
            </thead>
            <tbody className="text-black">
              {printItem.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-black">
                  <td className="border border-black py-2 text-center">{idx + 1}</td>
                  <td className="border border-black py-2 px-3">{item.namaBarang}</td>
                  <td className="border border-black py-2 text-center font-bold">{item.volume}</td>
                  <td className="border border-black py-2 text-center uppercase">{item.satuan}</td>
                  <td className="border border-black py-2 px-3 text-right">
                    <div className="flex justify-between w-full">
                      <span>RP</span>
                      <span>{item.hargaSatuan.toLocaleString('id-ID')}</span>
                    </div>
                  </td>
                  <td className="border border-black py-2 px-3 text-right font-semibold">
                    <div className="flex justify-between w-full">
                      <span>RP</span>
                      <span>{(item.volume * item.hargaSatuan).toLocaleString('id-ID')}</span>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={5} className="border border-black py-2 px-3 text-center uppercase text-black">TOTAL</td>
                <td className="border border-black py-2 px-3 text-right text-black font-bold">
                  <div className="flex justify-between w-full">
                    <span>RP</span>
                    <span className="underline">{calculateTotal(printItem.items).toLocaleString('id-ID')}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Body paragraph text strictly following formatting */}
          <p className="mb-4 text-[13px] text-justify leading-relaxed text-black font-normal">
            Kami berharap barang yang dipesan agar segera diproses dan dikirimkan kesekolah pada tanggal <strong className="font-bold">{printItem.tanggalKirim || '4 Februari 2025'}</strong>. Pembayaran akan dilakukan setelah barang diterima dalam keadaan baik dan sesuai pemesanan.
          </p>

          <p className="mb-6 text-[13px] text-justify leading-relaxed text-black font-normal">
            Demikian surat pemesanan barang ini kami buat. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.
          </p>

          {/* Signatures on the right side - Kepala Sekolah only */}
          <div className="mt-12 flex justify-end text-[13px] text-black font-normal">
            <div className="w-80 space-y-16 text-left">
              <div>
                <p>{printItem.kabupatenCetak || 'Nagan Raya'}, {printItem.tanggalSurat || '3 Februari 2025'}</p>
                <p>Hormat kami,</p>
                <p>Kepala {user?.sekolah || 'SD Negeri 2 Laot Tadu'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-bold underline">{printItem.kepsek || 'Budiyanto, S.Pd'}</p>
                {printItem.nipKepsek && printItem.nipKepsek.trim() !== '' && (
                  <p>NIP. {printItem.nipKepsek}</p>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
