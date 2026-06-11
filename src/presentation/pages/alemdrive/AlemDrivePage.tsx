/* eslint-disable */
// @ts-nocheck
import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { ToastProvider } from './drive-src/components/Toast'
import DashboardLayout from './drive-src/layouts/DashboardLayout'
import Drive from './drive-src/pages/Drive'
import Editor from './drive-src/pages/Editor'
import Contact from './drive-src/pages/Contact'
import Notebook from './drive-src/pages/Notebook'
import PublicShare from './drive-src/pages/PublicShare'
import Login from './drive-src/pages/Login'

export default function AlemDrivePage() {
  const location = useLocation();

  return (



    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Drive />} />
          <Route path="f/:folderId" element={<Drive />} />
          <Route path="shared" element={<Drive mode="shared" />} />
          <Route path="shared/f/:folderId" element={<Drive mode="shared" />} />
          <Route path="recent" element={<Drive mode="recent" />} />
          <Route path="recent/f/:folderId" element={<Drive mode="recent" />} />
          <Route path="notebook" element={<Notebook />} />
          <Route path="tablet" element={<Drive />} />
          <Route path="tablet/notebook" element={<Notebook />} />
          <Route path="contact" element={<Contact />} />

        </Route>
        <Route path="editor/:fileId" element={<Editor />} />
        <Route path="editor-external/:fileId" element={<Editor />} />
        <Route path="share/:id" element={<PublicShare />} />
        
        {/* Fallback to drive root if path unknown within /drive/* */}
        <Route path="*" element={<Navigate to={(location.pathname.endsWith('/tablet') || location.pathname.includes('/tablet/')) ? "/drive/tablet" : "/drive"} replace />} />
      </Routes>
    </ToastProvider>
  )
}
