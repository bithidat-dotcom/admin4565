import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, onSnapshot, collection, query, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, getDocFromServer, Timestamp, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Browser not supported');
    }
});

export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  code?: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const isQuotaError = error?.code === 'resource-exhausted' || 
                       error?.message?.includes('Quota limit exceeded') ||
                       (typeof error === 'string' && error.includes('Quota limit exceeded')) ||
                       error?.code === '8' || // Some environments report it this way
                       error?.message?.includes('exhausted');

  if (isQuotaError) {
    localStorage.setItem('firestore_quota_exceeded_date', new Date().toDateString());
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    code: error?.code,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaError) {
    console.warn('Firestore Quota Exceeded for path:', path, '. Graceful degradation active.');
    
    // Safely dispatch event
    try {
      const event = new CustomEvent('firestore-quota-exceeded', { detail: { path, operationType } });
      window.dispatchEvent(event);
    } catch (e) {
      // Fallback for environments where CustomEvent constructor is problematic
      const event = document.createEvent('CustomEvent');
      event.initCustomEvent('firestore-quota-exceeded', true, true, { path, operationType });
      window.dispatchEvent(event);
    }
    
    // For reads, we fail silently (allowing cache to take over)
    if (operationType === OperationType.LIST || operationType === OperationType.GET) {
      return errInfo;
    }
    
    // For writes, we want to inform the user that their change wasn't saved
    throw new Error("QUOTA_EXCEEDED: Daily database limit reached. Your changes could not be saved. Please try again tomorrow.");
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isQuotaExceeded() {
  const savedDate = localStorage.getItem('firestore_quota_exceeded_date');
  if (!savedDate) return false;
  return savedDate === new Date().toDateString();
}

// Validation connection as per skill instructions
async function testConnection() {
  if (isQuotaExceeded()) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
