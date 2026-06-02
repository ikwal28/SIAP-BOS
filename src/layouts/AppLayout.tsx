import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Settings, LogOut, Menu, AlertCircle, Layers, BookOpen, Receipt, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'sonner';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    setIsLogoutModalOpen(false);
    logout();
    navigate('/');
    toast.success("Berhasil logout.");
  }, [logout, navigate]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 10 minutes = 600,000 ms
      timeoutId = setTimeout(() => {
        toast.info("Anda telah logout otomatis karena tidak ada aktivitas selama 10 menit.");
        handleLogout();
      }, 600000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [handleLogout]);

  const isLocked = () => {
    if (user?.tipeAkses === 'rentang_waktu' && user?.batasWaktu) {
      const batas = new Date(user.batasWaktu);
      // We set it to end of day to be generous or just use standard parsing
      // Taking midnight of next day
      if (batas.toString() !== 'Invalid Date') {
        batas.setHours(23, 59, 59, 999);
        if (new Date() > batas) return true;
      }
    }
    return false;
  };

  const locked = isLocked();

  if (locked) {
    return (
      <div className="flex bg-gray-50 dark:bg-gray-900 min-h-screen items-center justify-center p-4 text-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-lg border border-red-200 dark:border-red-900/50">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
             <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Akses Terkunci</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Akun Anda terkunci hak aksesnya. Harap hubungi pemilik aplikasi untuk memperpanjang hak akses penggunaan aplikasi ini.
          </p>
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-3 rounded-xl font-medium transition"
          >
            Logout
          </button>
        </div>
        <ConfirmModal
          isOpen={isLogoutModalOpen}
          title="Konfirmasi Logout"
          message="Apakah Anda yakin ingin keluar dari aplikasi?"
          onConfirm={handleLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
          confirmText="Ya, Logout"
        />
      </div>
    );
  }

  const isSchoolAdmin = user?.role === 'admin_sekolah';

  const groupUtama = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Data Sekolah', icon: Users, path: '/sekolah' },
  ];

  const groupFitur = isSchoolAdmin ? [
    { name: 'RKAS', icon: Layers, path: '/rkas' },
    { name: 'BKU', icon: BookOpen, path: '/bku' },
    { name: 'KWITANSI', icon: Receipt, path: '/kwitansi' },
    { name: 'CETAK', icon: Printer, path: '/cetak' }
  ] : [];

  const groupPengaturan = [
    { name: 'Settings', icon: Settings, path: '/settings' }
  ];

  const renderNavGroup = (title: string, items: { name: string, icon: any, path: string }[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        {!collapsed ? (
          <div className="px-3 py-2 text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase select-none">
            {title}
          </div>
        ) : (
          <div className="border-t border-gray-100 dark:border-gray-700/50 my-3 mx-2" />
        )}
        {items.map(item => (
          <NavLink 
            key={item.name} 
            to={item.path} 
            className={({isActive}) => `flex items-center ${collapsed ? 'justify-center' : 'gap-4'} p-3 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80'}`}
            title={collapsed ? item.name : undefined}
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.name}</span>}
          </NavLink>
        ))}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <motion.aside 
        className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 ${collapsed ? 'w-20' : 'w-64'} transition-all flex flex-col`}
        animate={{ width: collapsed ? 80 : 256 }}
      >
        <div className="p-6 flex items-center justify-between">
          {!collapsed && <h1 className="font-bold text-xl dark:text-white truncate">SIAP BOS</h1>}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 min-w-[32px] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"><Menu className="dark:text-white w-full" /></button>
        </div>
        <nav className="p-4 space-y-4 flex-1">
          {renderNavGroup('Utama', groupUtama)}
          {renderNavGroup('Fitur SIAP BOS', groupFitur)}
          {renderNavGroup('Pengaturan', groupPengaturan)}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-4'} p-3 rounded-xl transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30`}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span className="truncate font-medium">Logout</span>}
          </button>
        </div>
      </motion.aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Konfirmasi Logout"
        message="Apakah Anda yakin ingin keluar dari aplikasi?"
        onConfirm={handleLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        confirmText="Ya, Logout"
      />
    </div>
  );
}
