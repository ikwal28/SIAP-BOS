import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Receipt, Plus, Trash2, Edit2, Printer, Search, Calendar, User, MapPin, Store, HelpCircle, Save, X, ArrowLeft, FileText
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

interface BkuTransaction {
  bukti: string;
  tanggal: string;
  bulan: string;
  penerima: string;
  items: {
    keterangan: string;
    kredit: number;
    kodeKegiatan: string;
    kodeRekening: string;
    namaBarang: string;
    volume: number;
    satuan: string;
    hargaSatuan: number;
    jumlah: number;
  }[];
  totalKredit: number;
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

  // BKU Manual Nota states
  const [bkuTransactions, setBkuTransactions] = useState<BkuTransaction[]>([]);
  const [loadingBku, setLoadingBku] = useState(false);
  const [selectedBkuIds, setSelectedBkuIds] = useState<string[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualToko, setManualToko] = useState('');
  const [autoFillValues, setAutoFillValues] = useState(true);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [printManualList, setPrintManualList] = useState<BkuTransaction[]>([]);

  const loadBkuTransactions = async (year: string) => {
    if (!user?.sekolah || !year) return;
    setLoadingBku(true);
    try {
      // 1. Fetch saved Kwitansis to map partners/penerima
      const kwResponse = await fetch(`${import.meta.env.VITE_API_URL}?action=getKwitansis`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user.sekolah, tahun: year })
      });
      const kwData = await kwResponse.json();
      const kwMap: { [key: string]: string } = {};
      if (kwData.success && kwData.data) {
        kwData.data.forEach((kw: any) => {
          if (kw.noKwitansi) {
            kwMap[kw.noKwitansi] = kw.penerima || '';
          }
        });
      }

      // 2. Fetch RKAS Phased rows for detailed mapping
      const rkasPhasedCacheKey = `siap_bos_cache_${user.sekolah}_rkas_phased_${year}`;
      let fetchedRkasPhasedRows: any[] = [];
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
              tahun: year,
              tipe: 'RKAS_PHASED'
            })
          });
          const rkasPhasedData = await rkasPhasedResp.json();
          if (rkasPhasedData.success && rkasPhasedData.rows) {
            fetchedRkasPhasedRows = rkasPhasedData.rows;
            sessionStorage.setItem(rkasPhasedCacheKey, JSON.stringify(fetchedRkasPhasedRows));
          }
        } catch (e) {
          console.error("Error fetching RKAS Phased in manual notes:", e);
        }
      }

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
          const rowKeg = cleanCode(row.kodeKegiatan || row.keg || row.kodekegiatan || '');
          const rowRek = cleanCode(row.kodeRekening || row.rek || row.koderekening || '');
          return (
            (rowKeg === targetKeg || rowKeg.includes(targetKeg) || targetKeg.includes(rowKeg)) &&
            (rowRek === targetRek || rowRek.includes(targetRek) || targetRek.includes(rowRek))
          );
        });

        if (candidatesByCode.length === 0) {
          const candidatesByRek = phasedRows.filter(row => {
            const rowRek = cleanCode(row.kodeRekening || row.rek || row.koderekening || '');
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
          const rowUraian = cleanVal(row.uraian || row.rincian || row.keterangan || '');
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
            const rowUraian = cleanVal(row.uraian || row.rincian || row.keterangan || '');
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

        return bestMatch || finalCandidates[0] || null;
      };

      // 3. Fetch BKU Months status
      const monthsResponse = await fetch(`${import.meta.env.VITE_API_URL}?action=checkBkuMonths`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sekolah: user.sekolah, tahun: year })
      });
      const monthsData = await monthsResponse.json();
      const activeMonths = monthsData.success && monthsData.months ? monthsData.months : [];

      if (activeMonths.length === 0) {
        setBkuTransactions([]);
        setSelectedBkuIds([]);
        setLoadingBku(false);
        return;
      }

      // 4. Fetch parallel BKU month data
      const fetchPromises = activeMonths.map(async (m: string) => {
        const cacheKey = `siap_bos_cache_${user.sekolah}_bku_${year}_${m}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            return { month: m, rows: JSON.parse(cached) };
          } catch (e) {}
        }
        try {
          const resp = await fetch(`${import.meta.env.VITE_API_URL}?action=getImportedData`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ sekolah: user.sekolah, tahun: year, tipe: m })
          });
          const res = await resp.json();
          if (res.success && res.rows) {
            sessionStorage.setItem(cacheKey, JSON.stringify(res.rows));
            return { month: m, rows: res.rows };
          }
        } catch (err) {}
        return { month: m, rows: [] };
      });

      const results = await Promise.all(fetchPromises);
      const bkuMap: { [key: string]: BkuTransaction } = {};

      results.forEach((resObj: any) => {
        if (resObj && resObj.rows) {
          resObj.rows.forEach((row: any) => {
            const bukti = String(row.bukti || '').trim();
            const kreditVal = parseFloat(row.kredit) || 0;
            if (bukti && bukti !== '-' && kreditVal > 0) {
              if (!bkuMap[bukti]) {
                const localRecipientFromStorage = 
                  localStorage.getItem(`siap_bos_penerima_${user.sekolah}_${bukti}`) || 
                  localStorage.getItem(`siap_bos_penerima_${bukti}`) ||
                  kwMap[bukti] || '';

                bkuMap[bukti] = {
                  bukti,
                  tanggal: formatValueIfDate(row.tanggal, false),
                  bulan: resObj.month,
                  penerima: localRecipientFromStorage,
                  items: [],
                  totalKredit: 0,
                };
              }

              const rawKeterangan = String(row.keterangan || '').trim();
              const rawKegiatan = String(row.kodeKegiatan || '').trim();
              const rawRekening = String(row.kodeRekening || '').trim();

              const rkasMatch = findRkasPhasedMatch(
                rawKegiatan,
                rawRekening,
                rawKeterangan,
                fetchedRkasPhasedRows
              );

              let hargaSatuanObj = kreditVal;
              let satuanObj = 'Pcs';
              let volumeObj = 1;
              let namaBarangObj = rawKeterangan;

              if (rkasMatch) {
                const matchedTarif = parseFloat(String(rkasMatch.tarifHarga || rkasMatch.tarif || '').replace(/[^0-9.-]+/g, '')) || 0;
                if (matchedTarif > 0) {
                  hargaSatuanObj = matchedTarif;
                  volumeObj = Math.round(kreditVal / matchedTarif) || 1;
                }
                if (rkasMatch.satuan) {
                  satuanObj = rkasMatch.satuan;
                }
                const resolvedRincian = rkasMatch.uraian || rkasMatch.rincian || rkasMatch.namaBarang;
                if (resolvedRincian) {
                  namaBarangObj = resolvedRincian;
                }
              }

              bkuMap[bukti].items.push({
                keterangan: rawKeterangan,
                kredit: kreditVal,
                kodeKegiatan: rawKegiatan,
                kodeRekening: rawRekening,
                namaBarang: namaBarangObj,
                volume: volumeObj,
                satuan: satuanObj,
                hargaSatuan: hargaSatuanObj,
                jumlah: kreditVal,
              });
              bkuMap[bukti].totalKredit += kreditVal;
            }
          });
        }
      });

      const transactions = Object.values(bkuMap);
      transactions.sort((a, b) => a.bukti.localeCompare(b.bukti));
      setBkuTransactions(transactions);
      
      // Auto-select all by default
      setSelectedBkuIds(transactions.map(t => t.bukti));
    } catch (error) {
      console.error("Error loading BKU for manual notes:", error);
    } finally {
      setLoadingBku(false);
    }
  };

  useEffect(() => {
    loadBkuTransactions(activeYear);
  }, [user?.sekolah, activeYear]);

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
    setPrintManualList([]);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintManualNotes = () => {
    const toPrint = bkuTransactions.filter(tx => selectedBkuIds.includes(tx.bukti));
    if (toPrint.length === 0) {
      toast.warning("Silakan pilih minimal satu No. Bukti untuk dicetak!");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela cetak. Pastikan izin popup browser diaktifkan.');
      return;
    }

    setShowManualModal(false);

    let tableRowsMarkup = '';

    toPrint.forEach((tx) => {
      const itemsCount = tx.items.length;
      const rowspanValue = itemsCount + 1; // items + 1 for JUMLAH total row

      tx.items.forEach((item, itemIdx) => {
        const matchedName = item.namaBarang || item.keterangan || '';
        const rawVol = item.volume || 1;
        const matchedSat = item.satuan || 'Pcs';
        const matchedHarga = item.hargaSatuan || item.kredit || 0;
        const matchedJumlah = item.jumlah || item.kredit || 0;

        // Vol (Volume) = Jumlah dibagi / Harga Satuan
        let displayVol = rawVol;
        if (matchedHarga > 0) {
          const computedVol = Math.round(matchedJumlah / matchedHarga);
          if (computedVol > 0) {
            displayVol = computedVol;
          }
        }

        tableRowsMarkup += `
          <tr class="border-b border-black text-black">
            ${itemIdx === 0 ? `
              <td rowspan="${rowspanValue}" class="border border-black p-1 bg-white text-center font-sans" style="vertical-align: middle; width: 14%; word-break: break-all;">
                <div class="font-black text-[9.5px] tracking-wide text-black mb-0.5">${tx.bukti}</div>
                <div class="text-[8.5px] text-gray-800 font-sans mb-1">${tx.tanggal}</div>
                <div class="font-extrabold text-[8.5px] text-black leading-tight uppercase mt-1 px-0.5 block border-t border-dashed border-gray-400 pt-1">
                  ${(tx.penerima || manualToko || 'TOKO SEJAHTERA (MANDIRI)').trim()}
                </div>
              </td>
            ` : ''}
            <td class="border border-black py-1 px-2 font-bold text-justify leading-snug text-black text-[10px]">${matchedName}</td>
            <td class="border border-black py-1 text-center text-black font-extrabold text-[10px]">
              ${displayVol}
            </td>
            <td class="border border-black py-1 text-center text-black text-[10px]">
              ${matchedSat}
            </td>
            <td class="border border-black py-1 px-1.5 text-right font-mono text-black text-[10px]">
              ${matchedHarga ? matchedHarga.toLocaleString('id-ID') : ''}
            </td>
            <td class="border border-black py-1 px-2 text-right font-bold font-mono text-black text-[10.5px]">
              ${matchedJumlah.toLocaleString('id-ID')}
            </td>
          </tr>
        `;
      });

      // JUMLAH row for this transaction
      tableRowsMarkup += `
        <tr class="bg-gray-50 border-b border-black text-black">
          <td colspan="4" class="border border-black py-1 px-2 font-extrabold text-center uppercase tracking-wider text-black bg-gray-50 text-[10px]">
            JUMLAH
          </td>
          <td class="border border-black py-1 px-2 font-black text-right text-[10.5px] bg-gray-50 font-mono text-black underline">
            ${tx.totalKredit.toLocaleString('id-ID')}
          </td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rincian Data Nota Manual - SIAP BOS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
          body {
            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 15px;
          }
          @media print {
            @page {
              size: A4 landscape;
              margin: 7mm;
            }
            body {
              background-color: white !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
            }
            table, th, td {
              border: 1px solid black !important;
              border-color: black !important;
            }
          }
          .print-container {
            background: white;
            margin: 15px auto;
            padding: 8mm;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
            max-width: 285mm;
            box-sizing: border-box;
          }
          table, th, td {
            border: 1px solid black;
          }
        </style>
      </head>
      <body>
        <div class="no-print max-w-[285mm] mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <div class="text-sm font-bold text-gray-800">Pratinjau Cetak Rincian Nota Belanja Buku Manual Tulis (Landscape)</div>
            <div class="text-xs text-gray-500">Ketinggian baris dioptimalkan agar rapat & hemat kertas untuk ditulis manual pada buku belanja Anda.</div>
          </div>
          <button onclick="window.print()" class="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition">
            Cetak Sekarang
          </button>
        </div>

        <div class="print-container bg-white text-black">
          <div class="text-center font-black text-sm uppercase tracking-wider text-black mb-4">
            RINCIAN DATA NOTA MANUAL
          </div>

          <table class="w-full border-collapse text-[10px] text-black bg-white">
            <thead>
              <tr class="bg-gray-100 font-bold border-b border-black text-center text-black">
                <th class="border border-black py-1 px-1 w-[14%] text-black text-center text-[9px] font-black uppercase tracking-wider">No.Bukti</th>
                <th class="border border-black py-1 px-3 text-left text-black text-[9px] font-black uppercase tracking-wider">Nama Barang</th>
                <th class="border border-black py-1 px-1 w-[7%] text-black text-center text-[9px] font-black uppercase tracking-wider">Vol</th>
                <th class="border border-black py-1 px-1 w-[9%] text-black text-center text-[9px] font-black uppercase tracking-wider">Satuan</th>
                <th class="border border-black py-1 px-2 w-[12%] text-right text-black text-[9px] font-black uppercase tracking-wider">Harga Satuan</th>
                <th class="border border-black py-1 px-3 w-[14%] text-right text-black text-[9px] font-black uppercase tracking-wider">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsMarkup}
            </tbody>
          </table>
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
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileText size={18} />
            Nota Manual Tulis
          </button>
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

        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs print:hidden overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4 mb-5">
                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="text-amber-500" />
                  Cetak Nota Manual Tulis
                </h2>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl text-xs text-amber-805 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50">
                  <p className="font-semibold mb-1">Membantu Menulis Nota Secara Fisik / Manual:</p>
                  Sistem menarik seluruh rincian belanja dan Nomor Bukti dari BKU agar Anda dapat mencetaknya langsung sebagai draft atau panduan fisik. Pilih <strong>No. Bukti</strong> yang ingin dicetak, coret atau hilangkan tanda centang pada <strong>No. Bukti</strong> yang tidak memerlukan nota belanja.
                </div>

                {/* Configuration Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama Toko (Default)</label>
                    <input
                      type="text"
                      value={manualToko}
                      onChange={(e) => setManualToko(e.target.value)}
                      placeholder="e.g. Toko Hafifi 2 / Tulis tangan jika kosong"
                      className="w-full px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden focus:border-amber-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Metode Hubungan Nilai</span>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={autoFillValues}
                        onChange={(e) => setAutoFillValues(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-700 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Isi otomatis Volume, Harga & Tgl (Cetak Penuh)</span>
                    </label>
                  </div>
                </div>

                {/* Checklist Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-400 uppercase">Pilih No. Bukti ({selectedBkuIds.length} terpilih)</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBkuIds(bkuTransactions.map(t => t.bukti))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-gray-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedBkuIds([])}
                        className="text-[11px] font-bold text-red-600 hover:underline"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  {/* Search inside Bukti */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      placeholder="Cari nomor bukti atau item..."
                      className="w-full pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-hidden focus:border-amber-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Scrollable list of checkboxes */}
                  <div className="border border-gray-150 dark:border-gray-800 rounded-2xl max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 text-xs bg-white dark:bg-gray-900">
                    {loadingBku ? (
                      <div className="p-4 text-center text-gray-500">Memuat rincian BKU...</div>
                    ) : bkuTransactions.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">Tidak ada pengeluaran kredit di BKU tahun {activeYear}.</div>
                    ) : (() => {
                      const filtered = bkuTransactions.filter(t => {
                        const q = manualSearchQuery.toLowerCase();
                        return (
                          t.bukti.toLowerCase().includes(q) ||
                          t.tanggal.toLowerCase().includes(q) ||
                          t.bulan.toLowerCase().includes(q) ||
                          t.items.some(it => it.keterangan.toLowerCase().includes(q))
                        );
                      });

                      if (filtered.length === 0) {
                        return <div className="p-4 text-center text-gray-500">Tidak ada hasil pencarian.</div>;
                      }

                      return filtered.map(t => {
                        const isChecked = selectedBkuIds.includes(t.bukti);
                        return (
                          <label
                            key={t.bukti}
                            className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-950/40 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBkuIds([...selectedBkuIds, t.bukti]);
                                } else {
                                  setSelectedBkuIds(selectedBkuIds.filter(id => id !== t.bukti));
                                }
                              }}
                              className="rounded border-gray-300 dark:border-gray-700 text-amber-600 focus:ring-amber-500 w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-gray-900 dark:text-white">{t.bukti}</span>
                                <span className="font-bold text-amber-600">Rp {t.totalKredit.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between text-[11px] text-gray-500">
                                <span>Tgl: {t.tanggal} ({t.bulan})</span>
                                <span className="italic truncate max-w-[250px]" title={t.items.map(it => it.namaBarang || it.keterangan).join(', ')}>
                                  {t.items[0]?.namaBarang || t.items[0]?.keterangan} {t.items.length > 1 ? `(+${t.items.length - 1} item)` : ''}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-150 dark:border-gray-800 pt-4 mt-5">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition animate-fade-in"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handlePrintManualNotes}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-5 rounded-xl transition shadow-sm text-xs cursor-pointer"
                >
                  <Printer size={14} />
                  Cetak Nota Manual Tulis
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

      {/* PRINT BATCH MANUAL CANVAS (Visible only on browser printer trigger for manual writing) */}
      {printManualList.length > 0 && !printItem && (
        <div id="siap-print-manual-batch" className="hidden print:block bg-white text-black min-h-screen">
          {printManualList.map((tx, idx) => {
            const totalRowsToShow = Math.max(8, tx.items.length);
            const tableRows = [];
            for (let rIdx = 0; rIdx < totalRowsToShow; rIdx++) {
              if (rIdx < tx.items.length) {
                tableRows.push({ empty: false, ...tx.items[rIdx] });
              } else {
                tableRows.push({ empty: true });
              }
            }
            
            return (
              <div 
                key={tx.bukti} 
                className="nota-page bg-white text-black p-8 max-w-2xl mx-auto font-sans leading-relaxed text-xs border-b border-dashed border-gray-350"
                style={{ 
                  pageBreakAfter: idx === printManualList.length - 1 ? 'avoid' : 'always',
                  minHeight: '270mm'
                }}
              >
                {/* Traditional Nota Penjualan Header Layout */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-black mb-4">
                  <div>
                    <h2 className="text-base font-black tracking-tight uppercase text-black">
                      {manualToko.trim() ? manualToko : '........................................................'}
                    </h2>
                    <p className="text-[10px] leading-tight text-gray-800 italic">
                      {manualToko.trim() ? 'Rekanan Penyedia / Toko SIAP BOS' : '........................................................'}
                    </p>
                    <p className="text-[10px] leading-tight text-gray-700">Telp: ............................</p>
                  </div>
                  <div className="text-right space-y-1">
                    <h1 className="text-lg font-black tracking-wide underline leading-none uppercase text-black">Nota Penjualan</h1>
                    <p className="font-mono text-[10px] font-bold text-black">No Nota/Bukti : {tx.bukti}</p>
                    <p className="text-[10px] text-black">Tgl Transaksi: <strong className="font-semibold text-black">{tx.tanggal}</strong></p>
                  </div>
                </div>

                <div className="mb-4 text-[11px] text-black">
                  <p className="leading-relaxed">Telah diserahterimakan rupa-rupa belanja dari toko kami untuk kebutuhan operasional sekolah:</p>
                  <strong className="font-black uppercase text-black">{user?.sekolah || 'Nama Sekolah'}</strong>
                </div>

                {/* Table of Purchases */}
                <table className="w-full border-collapse border border-black text-[10.5px] mb-4 text-black bg-white">
                  <thead>
                    <tr className="bg-gray-100 font-bold border-b border-black text-center text-black">
                      <th className="border border-black py-2 px-1 w-8 text-black">No</th>
                      <th className="border border-black py-2 px-2 text-left text-black">Nama Barang / Spesifikasi Belanja</th>
                      <th className="border border-black py-2 px-1.5 w-16 text-black">Banyaknya</th>
                      <th className="border border-black py-2 px-1.5 w-14 text-black">Satuan</th>
                      <th className="border border-black py-2 px-2 text-right text-black">Harga Satuan (Rp)</th>
                      <th className="border border-black py-2 px-2 text-right w-28 text-black">Jumlah (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, rIdx) => {
                      if (!row.empty) {
                        return (
                          <tr key={rIdx} className="border-b border-black text-black">
                            <td className="border border-black py-2 text-center text-black">{rIdx + 1}</td>
                            <td className="border border-black py-2 px-2 font-bold text-justify leading-snug text-black">{row.keterangan}</td>
                            <td className="border border-black py-2 text-center text-black font-extrabold">
                              {autoFillValues ? "1" : "................"}
                            </td>
                            <td className="border border-black py-2 text-center text-black">
                              {autoFillValues ? "Pcs" : "................"}
                            </td>
                            <td className="border border-black py-2 px-2 text-right font-mono text-black">
                              {autoFillValues ? row.kredit.toLocaleString('id-ID') : "........................"}
                            </td>
                            <td className="border border-black py-2 px-2 text-right font-black font-mono text-black">
                              {autoFillValues ? row.kredit.toLocaleString('id-ID') : "........................"}
                            </td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={rIdx} className="border-b border-black h-8 text-black">
                            <td className="border border-black py-2 text-center text-gray-500">{rIdx + 1}</td>
                            <td className="border border-black py-2 px-2 italic text-gray-400">...............................................................................</td>
                            <td className="border border-black py-2 text-center text-gray-400">................</td>
                            <td className="border border-black py-2 text-center text-gray-400">................</td>
                            <td className="border border-black py-2 px-2 text-right text-gray-450">........................</td>
                            <td className="border border-black py-2 px-2 text-right text-gray-450">........................</td>
                          </tr>
                        );
                      }
                    })}
                    <tr className="bg-gray-150 text-black">
                      <td colSpan={5} className="border border-black py-2 px-2 font-black uppercase text-right text-black">
                        JUMLAH TOTAL BAYAR:
                      </td>
                      <td className="border border-black py-2 px-2 font-black text-right text-xs underline bg-gray-50 font-serif text-black">
                        Rp {autoFillValues ? tx.totalKredit.toLocaleString('id-ID') : "........................"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Terbilang block style */}
                <div className="border border-black p-2.5 mb-6 bg-gray-50 text-black">
                  <span className="font-bold underline text-[9px] block text-black">TERBILANG :</span>
                  <span className="font-extrabold text-[10.5px] uppercase italic text-black font-serif leading-tight block mt-0.5">
                    " {autoFillValues ? getTerbilangString(tx.totalKredit) : "............................................................................................................"} "
                  </span>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 text-center mt-8 text-xs text-black">
                  {/* Seller */}
                  <div className="space-y-12">
                    <div>
                      <p>Tanda Terima Kasih,</p>
                      <p className="font-bold text-black">Hormat Kami / Toko</p>
                    </div>
                    <div>
                      <p className="font-bold underline uppercase text-black">
                        {manualToko.trim() ? manualToko : '...........................................'}
                      </p>
                      <p className="text-[10px] text-gray-500">Stempel & Tanda Tangan Toko</p>
                    </div>
                  </div>

                  {/* Buyer */}
                  <div className="space-y-12 animate-fade-in">
                    <div>
                      <p className="font-mono text-[10px] text-black">Kecamatan, {user?.kecamatan || 'Pendidikan'}</p>
                      <p className="font-bold text-black">Barang Diterima Oleh Sekolah</p>
                    </div>
                    <div>
                      <p className="font-bold underline text-black">...........................................</p>
                      <p className="text-[10px] text-gray-550">Bendahara / Penerima Barang</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
