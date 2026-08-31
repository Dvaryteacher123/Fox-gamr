import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCmwASW4XXQ3O0AvsCM_r1WLlrUmGjYVxI",
  authDomain: "dvary-9a7d0.firebaseapp.com",
  projectId: "dvary-9a7d0",
  storageBucket: "dvary-9a7d0.firebasestorage.app",
  messagingSenderId: "107370806066",
  appId: "1:107370806066:web:4c2ce1e6f7b6c32909f52b",
  measurementId: "G-07361LFJEP"
};

const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
export const loginUser = signInWithEmailAndPassword;
export const registerUser = createUserWithEmailAndPassword;
export const logoutUser = signOut;
export const authState = onAuthStateChanged;

// Firestore
export const db = getFirestore(app);
export const addDocument = addDoc;
export const getDocuments = getDocs;
export const getDocument = getDoc;
export const updateDocument = updateDoc;
export const deleteDocument = deleteDoc;
export const collectionRef = collection;
export const docRef = doc;
export const queryRef = query;
export const whereRef = where;
export const orderByRef = orderBy;
export const onSnapshotRef = onSnapshot;

// Storage
export const storage = getStorage(app);
export const uploadFile = uploadBytes;
export const getFileURL = getDownloadURL;
export const deleteFile = deleteObject;
export const storageRef = ref;

export default app;
