import { FirebaseApp } from "firebase/app";
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  reload,
  updateProfile
} from "firebase/auth";

export const app: FirebaseApp;
export const auth: Auth;
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  reload,
  updateProfile
};
