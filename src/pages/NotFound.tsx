import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <h1 className="text-6xl font-bold text-gray-800 dark:text-gray-100">404</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-4 mb-6">Halaman tidak ditemukan</p>
      <button 
        onClick={() => navigate('/')} 
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        Kembali ke Beranda
      </button>
    </div>
  );
}
