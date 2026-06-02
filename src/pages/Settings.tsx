import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500">
      <SettingsIcon size={64} className="mb-4 text-gray-300 dark:text-gray-600" />
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Pengaturan</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2">Modul pengaturan sedang dalam tahap pengembangan.</p>
    </div>
  );
}
