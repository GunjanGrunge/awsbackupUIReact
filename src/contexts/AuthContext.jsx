import { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
  updateEmail,
  sendEmailVerification,
  RecaptchaVerifier
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  const setupRecaptcha = async () => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log("reCAPTCHA resolved");
          }
        });
        await window.recaptchaVerifier.render();
      }
      return window.recaptchaVerifier;
    } catch (error) {
      console.error("reCAPTCHA setup error:", error);
      throw error;
    }
  };

  async function login(email, password) {
    try {
      const verifier = await setupRecaptcha();
      await verifier.verify();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      throw new Error(error.message);
    }
  }

  async function resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const logout = () => {
    return signOut(auth);
  };

  const updateUserProfile = async (profileData) => {
    if (!currentUser) throw new Error('No user logged in');
    await updateProfile(currentUser, profileData);
    // Force refresh the user data
    setCurrentUser(auth.currentUser);
  };

  const updateUserEmail = async (newEmail) => {
    if (!currentUser) throw new Error('No user logged in');
    await updateEmail(currentUser, newEmail);
    await sendEmailVerification(currentUser);
    setCurrentUser(auth.currentUser);
  };

  const value = {
    currentUser,
    loading,
    login,
    resetPassword,
    logout,
    updateUserProfile,
    updateUserEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      <div id="recaptcha-container"></div>
    </AuthContext.Provider>
  );
}
