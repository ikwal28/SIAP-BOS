/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataSekolah from './pages/DataSekolah';
import TambahSekolah from './pages/TambahSekolah';
import EditSekolah from './pages/EditSekolah';
import Settings from './pages/Settings';
import Rkas from './pages/Rkas';
import Bku from './pages/Bku';
import Kwitansi from './pages/Kwitansi';
import Cetak from './pages/Cetak';
import SuratPemesanan from './pages/SuratPemesanan';
import Nota from './pages/Nota';
import BeritaAcara from './pages/BeritaAcara';
import PerjalananDinas from './pages/PerjalananDinas';
import Honorarium from './pages/Honorarium';
import NotFound from './pages/NotFound';
import AppLayout from './layouts/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const isPrinting = new URLSearchParams(window.location.search).get('autoPrint') === 'true';
  const isViewAll = new URLSearchParams(window.location.search).get('viewAll') === 'true';
  const localUser = localStorage.getItem('user');

  if (user || ((isPrinting || isViewAll) && localUser)) {
    return children;
  }
  return <Navigate to="/" />;
};

export default function App() {
  return (
    <AuthProvider>
      <Toaster richColors position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sekolah" element={<DataSekolah />} />
            <Route path="/sekolah/tambah" element={<TambahSekolah />} />
            <Route path="/sekolah/edit" element={<EditSekolah />} />
            <Route path="/rkas" element={<Rkas />} />
            <Route path="/bku" element={<Bku />} />
            <Route path="/kwitansi" element={<Kwitansi />} />
            <Route path="/cetak" element={<Cetak />} />
            <Route path="/sp" element={<SuratPemesanan />} />
            <Route path="/nota" element={<Nota />} />
            <Route path="/bast" element={<BeritaAcara />} />
            <Route path="/spd" element={<PerjalananDinas />} />
            <Route path="/honor" element={<Honorarium />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
