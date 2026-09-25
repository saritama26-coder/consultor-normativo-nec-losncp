export interface NormativeNotification {
  id: string;
  docId: string;
  docName: string;
  category: string;
  version: string;
  type: 'new_document' | 'updated_version' | 'status_change';
  timestamp: string;
  isRead: boolean;
  isKeyNormative: boolean; // NEC, LOSNCP, RGLOSNCP
  registroOficial?: string;
  details?: string;
}

export interface NormativeCacheRecord {
  id: string;
  version: string;
  updatedAt?: string;
  uploadedAt?: string;
  fileHash?: string;
  isActive?: boolean;
}
