// Who is signed in. Today: Google accounts through Firebase Auth.
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'

import { getFirebase } from '@/firebase'

export type Account = {
  /** Stable id; the user's data is kept under it. */
  uid: string
  name: string | null
  email: string | null
}

/** Calls `onChange` with the signed-in account (or null) now and whenever it changes. */
export function watchAccount(onChange: (account: Account | null) => void): () => void {
  return onAuthStateChanged(getFirebase().auth, (user) =>
    onChange(user && { uid: user.uid, name: user.displayName, email: user.email }),
  )
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(getFirebase().auth, new GoogleAuthProvider())
}

export async function signOutOfAccount(): Promise<void> {
  await signOut(getFirebase().auth)
}
