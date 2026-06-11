import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Search, 
  Folder, 
  FileText, 
  ChevronRight, 
  ArrowLeft, 
  Loader2, 
  File,
  Image as ImageIcon,
  Film,
  FileCode,
  Archive
} from 'lucide-react'
// @ts-expect-error: drive-src uses internal legacy logic
import { listFiles, listOwnItems, listSharedItems, listRecentFiles } from '../../pages/alemdrive/drive-src/api/files'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'

interface DriveFile {
  id: string
  name: string
  type: 'file' | 'dir'
  mime_type?: string
  download_url?: string
  size?: number
  updated_at?: string
  created_at?: string
  owner_id?: number
}

interface DriveFilePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: DriveFile) => void
}

type DriveMode = 'my-drive' | 'shared' | 'recent'

export default function DriveFilePickerModal({ isOpen, onClose, onSelect }: DriveFilePickerModalProps) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFolderId, setCurrentFolderId] = useState('root')
  const [folderHistory, setFolderHistory] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [mode, setMode] = useState<DriveMode>('my-drive')
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'Мой диск' }])

  const loadFiles = useCallback(async (folderId: string) => {
    try {
      setLoading(true)
      let data: DriveFile[] = []
      
      if (folderId === 'root') {
        if (mode === 'shared') {
          data = await listSharedItems()
        } else if (mode === 'recent') {
          data = await listRecentFiles(20, 0)
        } else {
          data = await listOwnItems()
        }
      } else {
        data = await listFiles(folderId)
      }
      
      setFiles(data)
    } catch (err) {
      console.error('Failed to load drive files', err)
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    if (isOpen) {
      setFolderHistory([])
      setPath([{ id: 'root', name: 'Мой диск' }])
      setMode('my-drive')
      setCurrentFolderId('root')
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      void loadFiles(currentFolderId)
    }
  }, [currentFolderId, mode, isOpen, loadFiles])

  const handleFolderClick = (folder: DriveFile) => {
    setFolderHistory((prev) => [...prev, currentFolderId])
    setCurrentFolderId(folder.id)
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }])
  }

  const handleGoBack = () => {
    if (folderHistory.length > 0) {
      const prevId = folderHistory[folderHistory.length - 1]
      setFolderHistory((prev) => prev.slice(0, -1))
      setCurrentFolderId(prevId)
      setPath((prev) => prev.slice(0, -1))
    }
  }

  const handlePathClick = (index: number) => {
    if (index === path.length - 1) return
    const newPath = path.slice(0, index + 1)
    const newHistory = folderHistory.slice(0, index)
    setPath(newPath)
    setFolderHistory(newHistory)
    setCurrentFolderId(newPath[newPath.length - 1].id)
  }

  const filteredFiles = files.filter((f) => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (file: DriveFile) => {
    if (file.type === 'dir') return <Folder className="w-5 h-5 text-blue-500 fill-blue-500/20" />
    
    const mime = file.mime_type || ''
    const name = file.name.toLowerCase()
    
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) {
      return <ImageIcon className="w-5 h-5 text-purple-500" />
    }
    if (mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(name)) {
      return <Film className="w-5 h-5 text-red-500" />
    }
    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-orange-500" />
    }
    if (mime.includes('zip') || mime.includes('rar') || /\.(zip|rar|7z)$/i.test(name)) {
      return <Archive className="w-5 h-5 text-amber-600" />
    }
    if (/\.(js|ts|tsx|jsx|html|css|py|go|json)$/i.test(name)) {
      return <FileCode className="w-5 h-5 text-emerald-500" />
    }
    
    return <File className="w-5 h-5 text-gray-400" />
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
          style={{ fontFamily: '"Inter", "Roboto", sans-serif' }}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                <MS name="cloud" size={24} color={C.blue} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Выбрать из Alem Drive</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  {path.map((p, i) => (
                    <React.Fragment key={p.id}>
                      <button 
                        onClick={() => handlePathClick(i)}
                        className={`hover:text-blue-600 transition-colors ${i === path.length - 1 ? 'font-semibold text-gray-700' : ''}`}
                      >
                        {p.name}
                      </button>
                      {i < path.length - 1 && <ChevronRight className="w-3 h-3" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search and Tabs */}
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Поиск файлов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              {[
                { id: 'my-drive', label: 'Мой диск', icon: 'folder' },
                { id: 'shared', label: 'Доступные', icon: 'group' },
                { id: 'recent', label: 'Недавние', icon: 'history' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setMode(t.id as DriveMode)
                    setCurrentFolderId('root')
                    setPath([{ id: 'root', name: t.label }])
                    setFolderHistory([])
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    mode === t.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'
                  }`}
                >
                  <MS name={t.icon} size={18} color="currentColor" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Загрузка файлов...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                  <MS name="search_off" size={32} />
                </div>
                <span className="text-sm">Файлы не найдены</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {currentFolderId !== 'root' && searchQuery === '' && (
                  <button
                    onClick={handleGoBack}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-blue-50/50 text-left transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Назад</span>
                  </button>
                )}
                
                {filteredFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => file.type === 'dir' ? handleFolderClick(file) : onSelect(file)}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-blue-50/50 text-left transition-all group border border-transparent hover:border-blue-100"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-white shadow-sm transition-all">
                      {getFileIcon(file)}
                    </div>
                    <div className="flex-1 min-width-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{file.name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                        {file.type === 'dir' ? 'Папка' : formatSize(file.size)}
                        {file.updated_at && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span>{new Date(file.updated_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {file.type === 'dir' && (
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              Выберите файл для отправки в текущий чат. Файл будет доступен всем участникам.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
