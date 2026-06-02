import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export default function LoadingOverlay({ isLoading, message = "Sedang memproses, mohon tunggu..." }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-4 text-center pointer-events-auto"
          >
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {message}
            </h3>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
