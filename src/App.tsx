import React, { useState, useEffect } from 'react';
import {
  getConsultationHistory,
  addConsultationHistoryItem,
  deleteConsultationHistoryItem,
  updateConsultationHistoryItem,
  clearConsultationHistory,
} from './services/db';
import {
  NormativeDocument,
  ConsultationHistoryItem,
} from './types/normative';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { Footer } from './components/Footer';
import { ConsultationView } from './components/ConsultationView';
import { DocumentList } from './components/DocumentList';
import { HistoryView } from './components/HistoryView';
import { UploadModal } from './components/UploadModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { useNormativeNotifications } from './hooks/useNormativeNotifications';
import { NotificationToast } from './components/NotificationToast';
import { NotificationCenterModal } from './components/NotificationCenterModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'consultar' | 'documentos' | 'historial'>('consultar');
  const [documents, setDocuments] = useState<NormativeDocument[]>([]);
  const [history, setHistory] = useState<ConsultationHistoryItem[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReadingMode, setIsReadingMode] = useState(false);

  const {
    notifications,
    unreadCount,
    activeToast,
    checkDocumentUpdates,
    markAsRead,
    markAllAsRead,
    dismissToast,
    simulateUpdate,
  } = useNormativeNotifications();

  // Exit reading mode with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isReadingMode) {
        setIsReadingMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadingMode]);

  // Turn off reading mode if user switches tab
  useEffect(() => {
    if (activeTab !== 'consultar' && isReadingMode) {
      setIsReadingMode(false);
    }
  }, [activeTab, isReadingMode]);

  // Authentication & Admin status
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('consultor_admin_token');
  });
  const [isAdminConfigured, setIsAdminConfigured] = useState(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Fetch auth status from server
  const checkAuthStatus = async (token?: string | null) => {
    try {
      const activeToken = token !== undefined ? token : adminToken;
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/auth/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setIsAdminConfigured(Boolean(data.isAdminConfigured));
        setIsAdminLoggedIn(Boolean(data.isAdminLoggedIn));
        if (!data.isAdminLoggedIn && activeToken) {
          sessionStorage.removeItem('consultor_admin_token');
          setAdminToken(null);
        }
      }
    } catch (err) {
      console.error('Error verificando estado de autenticación:', err);
    }
  };

  // Fetch documents from server and check for normative updates
  const fetchServerDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const docs: NormativeDocument[] = await res.json();
        setDocuments(docs);
        checkDocumentUpdates(docs);
      }
    } catch (err) {
      console.error('Error fetching documents from server:', err);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        await checkAuthStatus();
        await fetchServerDocuments();
        const storedHistory = await getConsultationHistory();
        setHistory(storedHistory);
      } catch (err) {
        console.error('Error initializing app data:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    loadData();
  }, []);

  // Periodic background check and window focus listener for new normative documents
  useEffect(() => {
    const interval = setInterval(() => {
      fetchServerDocuments();
    }, 30000); // 30 seconds

    const handleFocus = () => {
      fetchServerDocuments();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Navigate directly to a document when user clicks "Ver en Biblioteca" from a notification
  const handleViewDocFromNotification = (docId: string) => {
    setActiveTab('documentos');
    setHighlightedDocId(docId);
    setTimeout(() => {
      const el = document.getElementById(`doc-${docId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  // When switching to 'documentos' tab, refresh documents from server to guarantee sync
  useEffect(() => {
    if (activeTab === 'documentos') {
      fetchServerDocuments();
      checkAuthStatus();
    }
  }, [activeTab]);

  const handleAdminLoginSuccess = (token: string) => {
    sessionStorage.setItem('consultor_admin_token', token);
    setAdminToken(token);
    setIsAdminLoggedIn(true);
    checkAuthStatus(token);
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {}
    }
    sessionStorage.removeItem('consultor_admin_token');
    setAdminToken(null);
    setIsAdminLoggedIn(false);
    setIsAdminModalOpen(false);
  };

  // Handlers for server-stored documents
  const handleDocumentAdded = (newDoc: NormativeDocument) => {
    const updated = [newDoc, ...documents.filter((d) => d.id !== newDoc.id)];
    setDocuments(updated);
    checkDocumentUpdates(updated);
  };

  const handleToggleActiveDoc = async (id: string) => {
    if (!isAdminLoggedIn) {
      setIsAdminModalOpen(true);
      return;
    }

    // Optimistic UI update
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isActive: !d.isActive } : d))
    );

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      const res = await fetch('/api/documents/toggle', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setIsAdminModalOpen(true);
        }
        throw new Error(data.error || 'Error al cambiar estado.');
      }
    } catch (err) {
      console.error('Error toggling document active status:', err);
      fetchServerDocuments();
    }
  };

  const handleUpdateDocument = async (id: string, updates: Partial<NormativeDocument>) => {
    if (!isAdminLoggedIn) {
      setIsAdminModalOpen(true);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar documento.');
      }

      const data = await res.json();
      if (data.doc) {
        setDocuments((prev) => prev.map((d) => (d.id === id ? data.doc : d)));
      }
    } catch (err) {
      console.error('Error updating document metadata:', err);
      throw err;
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!isAdminLoggedIn) {
      setIsAdminModalOpen(true);
      return;
    }

    setDocuments((prev) => prev.filter((d) => d.id !== id));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        throw new Error('Error al eliminar documento.');
      }
    } catch (err) {
      console.error('Error deleting document from server:', err);
      fetchServerDocuments();
    }
  };

  // Handlers for consultation history (IndexedDB)
  const handleConsultationCompleted = async (item: ConsultationHistoryItem) => {
    await addConsultationHistoryItem(item);
    setHistory((prev) => [item, ...prev.slice(0, 49)]);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    await deleteConsultationHistoryItem(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleUpdateHistoryItem = async (id: string, updates: Partial<ConsultationHistoryItem>) => {
    await updateConsultationHistoryItem(id, updates);
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, ...updates } : h)));
  };

  const handleClearHistory = async () => {
    await clearConsultationHistory();
    setHistory([]);
  };

  const handleSelectHistoryQuestion = (q: string) => {
    setPendingQuestion(q);
    setActiveTab('consultar');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-stone-500 font-medium">Conectando al File Search Store del servidor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-stone-200">
      {/* App Header (hidden in Reading Mode to maximize viewing area and eliminate navigation distractions) */}
      <OfflineBanner />
      {!isReadingMode && (
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          documents={documents}
          historyCount={history.length}
          isAdminLoggedIn={isAdminLoggedIn}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
          unreadNotificationsCount={unreadCount}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 transition-all ${
        isReadingMode ? 'max-w-4xl lg:max-w-5xl py-4' : 'max-w-7xl py-6'
      }`}>
        {activeTab === 'consultar' && (
          <ConsultationView
            documents={documents}
            onToggleActiveDoc={handleToggleActiveDoc}
            onConsultationCompleted={handleConsultationCompleted}
            onNavigateToDocs={() => setActiveTab('documentos')}
            initialQuestion={pendingQuestion}
            isReadingMode={isReadingMode}
            onToggleReadingMode={() => setIsReadingMode((prev) => !prev)}
            history={history}
          />
        )}

        {activeTab === 'documentos' && (
          <DocumentList
            documents={documents}
            onToggleActive={handleToggleActiveDoc}
            onDeleteDocument={handleDeleteDocument}
            onUpdateDocument={handleUpdateDocument}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            isAdminLoggedIn={isAdminLoggedIn}
            isAdminConfigured={isAdminConfigured}
            onOpenAdminLogin={() => setIsAdminModalOpen(true)}
            highlightedDocId={highlightedDocId}
          />
        )}

        {activeTab === 'historial' && (
          <HistoryView
            history={history}
            onSelectQuestion={handleSelectHistoryQuestion}
            onDeleteItem={handleDeleteHistoryItem}
            onUpdateItem={handleUpdateHistoryItem}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Floating Notification Toast for new/updated normatives */}
      <NotificationToast
        notification={activeToast}
        onDismiss={dismissToast}
        onViewDocument={handleViewDocFromNotification}
      />

      {/* Notification Center Modal / Drawer */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onViewDocument={handleViewDocFromNotification}
        onSimulateUpdate={simulateUpdate}
      />

      {/* Upload PDF Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDocumentAdded={handleDocumentAdded}
        adminToken={adminToken}
        onRequireAdminLogin={() => {
          setIsUploadModalOpen(false);
          setIsAdminModalOpen(true);
        }}
      />

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        isAdminLoggedIn={isAdminLoggedIn}
        isAdminConfigured={isAdminConfigured}
        onLoginSuccess={handleAdminLoginSuccess}
        onLogout={handleAdminLogout}
      />

      {/* Mandatory Fixed Footer Disclaimer (hidden in reading mode for distraction-free reading) */}
      {!isReadingMode && <Footer />}
    </div>
  );
}
