import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface PerpanjangAksesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sekolah: any;
  onSuccess: () => void;
}

export default function PerpanjangAksesModal({ isOpen, onClose, sekolah, onSuccess }: PerpanjangAksesModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipeAkses: 'permanen',
    batasWaktu: ''
  });

  useEffect(() => {
    if (sekolah) {
      setFormData({
        tipeAkses: sekolah.tipeAkses || 'permanen',
        batasWaktu: sekolah.batasWaktu || ''
      });
    }
  }, [sekolah]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.tipeAkses === 'rentang_waktu' && !formData.batasWaktu) {
      toast.error('Harap isi batas waktu akses');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}?action=perpanjangAkses`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          namaSekolah: sekolah.nama,
          tipeAkses: formData.tipeAkses,
          batasWaktu: formData.batasWaktu
        })
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message || 'Hak akses berhasil diperbarui');
        onSuccess();
        onClose();
      } else {
        toast.error(data.message || 'Gagal memperbarui hak akses');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 p-6 z-10"
        >
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Perpanjang Akses</h3>
              <p className="text-sm text-gray-500">Ubah hak akses untuk {sekolah?.nama}</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipe Akses</label>
              <select 
                value={formData.tipeAkses}
                onChange={(e) => setFormData({...formData, tipeAkses: e.target.value})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
              >
                <option value="permanen">Permanen</option>
                <option value="rentang_waktu">Rentang Waktu</option>
                <option value="demo">Demo</option>
              </select>
            </div>

            {formData.tipeAkses === 'rentang_waktu' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Batas Waktu Akses</label>
                <input 
                  type="date"
                  value={formData.batasWaktu}
                  onChange={(e) => setFormData({...formData, batasWaktu: e.target.value})}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
