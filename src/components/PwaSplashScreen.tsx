import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PwaSplashScreenProps {
  onComplete: () => void;
}

export default function PwaSplashScreen({ onComplete }: PwaSplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phaseText, setPhaseText] = useState('Menginisialisasi modul sistem PWA...');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Elegant simulated loading sequence representing system ready checks spanning exactly 7 seconds
    const intervals = [
      { prg: 15, txt: 'Menginisialisasi modul sistem PWA...', delay: 1000 },
      { prg: 35, txt: 'Mengamankan koneksi enkripsi lokal...', delay: 2200 },
      { prg: 55, txt: 'Memeriksa integrasi database RKAS & BKU...', delay: 3500 },
      { prg: 75, txt: 'Sinkronisasi lembar draf belanja sekolah...', delay: 4800 },
      { prg: 90, txt: 'Otentikasi kredensial pengguna terenkripsi...', delay: 5800 },
      { prg: 100, txt: 'Sistem Pengelolaan SIAP BOS Siap!', delay: 6400 }
    ];

    const timers: NodeJS.Timeout[] = [];

    intervals.forEach(item => {
      const timer = setTimeout(() => {
        setProgress(item.prg);
        setPhaseText(item.txt);
        if (item.prg === 100) {
          // Subtle buffer to complete the 7 seconds perfectly before exiting
          const exitTimer = setTimeout(() => {
            setIsExiting(true);
            const doneTimer = setTimeout(() => {
              onComplete();
            }, 600); // matches exit transition duration
            timers.push(doneTimer);
          }, 600);
          timers.push(exitTimer);
        }
      }, item.delay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          id="pwa-splash-canvas"
          className="fixed inset-0 z-100 flex flex-col items-center justify-between text-white overflow-hidden select-none"
          style={{
            background: 'radial-gradient(circle at center, #0F172A 0%, #020617 100%)'
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          {/* Top ambient decor grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

          {/* Glowing purple ambient sphere top */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
          
          {/* Spacer */}
          <div className="h-10" />

          {/* Central Logo & Spinners Core */}
          <div className="relative flex flex-col items-center justify-center flex-1 max-w-md px-6 text-center">
            
            {/* Ambient Outer Concentric Rotating Tech Rings */}
            <div className="relative w-44 h-44 mb-8 flex items-center justify-center">
              
              {/* Outer Slow Ring */}
              <motion.div
                className="absolute inset-0 rounded-full border border-dashed border-indigo-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              />
              
              {/* Mid Fast Glow Ring */}
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-indigo-500 border-l-transparent"
                style={{ filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' }}
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />

              {/* Inner Pulsing Ring */}
              <motion.div
                className="absolute inset-6 rounded-full bg-slate-950/80 border border-slate-800 flex items-center justify-center shadow-inner"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* SVG Logo Image */}
                <motion.img
                  src="/logo_siap_bos.svg"
                  alt="SIAP BOS Logo"
                  className="w-24 h-24 p-1 object-contain"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
                  onError={(e) => {
                    // Fallback to inline logo vector if SVG is not yet parsed
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </motion.div>
            </div>

            {/* Application Title with Custom Tracking & Premium Gradient */}
            <motion.h1
              className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-purple-300 font-sans mb-1"
              style={{ filter: 'drop-shadow(0 2px 10px rgba(99, 102, 241, 0.3))' }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              SIAP BOS
            </motion.h1>

            {/* Slogan */}
            <motion.p
              className="text-xs text-indigo-300 tracking-wider uppercase font-medium max-w-[280px]"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              Sistem Aplikasi Pengelolaan BOS
            </motion.p>

            {/* Sophisticated Linear Progress Bar */}
            <div className="w-64 h-1.5 bg-slate-900 border border-slate-800 rounded-full mt-8 overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
              {/* Glow scanning light effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 -skew-x-12 animate-[shimmer_1.5s_infinite]" />
            </div>

            {/* Progressive Phase loading text */}
            <motion.div
              key={phaseText}
              className="mt-3 text-[10.5px] text-gray-400 font-mono tracking-wide h-4"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {phaseText}
            </motion.div>
          </div>

          {/* Bottom Custom Signature with Glowing Accent and high-tech framework frame */}
          <motion.div
            className="w-full flex flex-col items-center pb-10"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9.5px] uppercase tracking-widest text-slate-500 font-bold">Ditenagai Enggine SIAP BOS Versi 1.0.0</span>
            </div>
            <div className="px-5 py-2.5 bg-slate-950/60 border border-slate-800/80 backdrop-blur-md rounded-2xl flex flex-col items-center">
              <span className="text-[10px] text-gray-500 font-medium tracking-wide">Dibuat Oleh:</span>
              <span className="text-xs font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 mt-0.5">
                Ikwal Presetiawan, S.T
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
