import { useEffect, useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import "./App.css";
import PrepItem from "./components/PrepItem";
import { auth, isFirebaseConfigured } from "./services/firebase";
import { usePrepStore } from "./store/usePrepStore";

function App() {
  const prepItems = usePrepStore((state) => state.items);
  const fetchItems = usePrepStore((state) => state.fetchItems);
  const [user, setUser] = useState<User | null>(null);
  const [modalView, setModalView] = useState<"login" | "create" | "reset">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthError("");

      if (currentUser) {
        fetchItems().catch((err) => {
          console.error("Failed loading prep items:", err);
        });
      }
    });

    return unsubscribe;
  }, [fetchItems]);

  useEffect(() => {
    if (modalView === "login") {
      setAuthMessage("");
    }
  }, [modalView]);

  const goToLogin = () => {
    setModalView("login");
    setAuthError("");
    setAuthMessage("");
  };

  const goToCreateAccount = () => {
    setModalView("create");
    setAuthError("");
    setAuthMessage("");
  };

  const goToResetPassword = () => {
    setModalView("reset");
    setAuthError("");
    setAuthMessage("");
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setAuthError("Firebase is not configured. Add the VITE_FIREBASE_* values to your .env.local file.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      setAuthError("Firebase is not configured. Add the VITE_FIREBASE_* values to your .env.local file.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Email login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      setAuthError("Firebase is not configured. Add the VITE_FIREBASE_* values to your .env.local file.");
      return;
    }

    if (createPassword !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      await createUserWithEmailAndPassword(auth, createEmail, createPassword);
      setAuthMessage("Account created. You are now signed in.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Account creation failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      setAuthError("Firebase is not configured. Add the VITE_FIREBASE_* values to your .env.local file.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setAuthMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) {
      return;
    }

    await signOut(auth);
  };

  const completedCount = prepItems.filter((item) => item.status === "done").length;
  const totalCount = prepItems.length;
  const progressPercent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <main className="app-shell">
      {!user && (
        <section className="login-modal" aria-label="Login modal">
          <div className="login-card">
            <p className="login-eyebrow">KitchenReady access</p>
            {modalView === "login" && (
              <>
                <h1 className="login-title">Sign in to continue</h1>
                <p className="login-copy">
                  Use your Firebase account to open the prep dashboard and keep work tied to a signed-in user.
                </p>

                {!isFirebaseConfigured && (
                  <p className="login-error login-error-soft">
                    Firebase is not configured yet. Add the VITE_FIREBASE_* values to .env.local, then restart the dev server.
                  </p>
                )}

                <button
                  type="button"
                  className="login-google-button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading || !auth}
                >
                  Continue with Google
                </button>

                <div className="login-divider" aria-hidden="true">
                  <span>or</span>
                </div>

                <form className="login-form" onSubmit={handleEmailSignIn}>
                  <label className="login-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="you@restaurant.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="login-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      minLength={6}
                    />
                  </label>

                  <button type="submit" className="login-submit" disabled={authLoading || !auth}>
                    {authLoading ? "Signing in..." : "Sign in"}
                  </button>
                </form>

                <div className="login-links">
                  <button type="button" className="login-link-button" onClick={goToCreateAccount}>
                    Create account
                  </button>
                  <button type="button" className="login-link-button" onClick={goToResetPassword}>
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {modalView === "create" && (
              <>
                <button type="button" className="login-back-button" onClick={goToLogin}>
                  Back to sign in
                </button>
                <h1 className="login-title">Create your account</h1>
                <p className="login-copy">
                  Register a new Firebase account to use KitchenReady on this device.
                </p>

                <form className="login-form" onSubmit={handleCreateAccount}>
                  <label className="login-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={(event) => setCreateEmail(event.target.value)}
                      placeholder="you@restaurant.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="login-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                  </label>

                  <label className="login-field">
                    <span>Confirm password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                  </label>

                  <button type="submit" className="login-submit" disabled={authLoading || !auth}>
                    {authLoading ? "Creating account..." : "Create account"}
                  </button>
                </form>
              </>
            )}

            {modalView === "reset" && (
              <>
                <button type="button" className="login-back-button" onClick={goToLogin}>
                  Back to sign in
                </button>
                <h1 className="login-title">Reset your password</h1>
                <p className="login-copy">
                  We will send a password reset link to the email address you enter below.
                </p>

                <form className="login-form" onSubmit={handleResetPassword}>
                  <label className="login-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="you@restaurant.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <button type="submit" className="login-submit" disabled={authLoading || !auth}>
                    {authLoading ? "Sending reset email..." : "Send reset email"}
                  </button>
                </form>
              </>
            )}

            {authMessage && <p className="login-success">{authMessage}</p>}
            {authError && <p className="login-error">{authError}</p>}
          </div>
        </section>
      )}

      {user && (
        <section className="dashboard" aria-label="Prep list dashboard">
          <header className="dashboard-header">
            <div className="dashboard-topbar">
              <div>
                <h1 className="dashboard-title">Prep List Dashboard</h1>
                <p className="dashboard-subtitle">
                  Shift progress for today's prep workload.
                </p>
              </div>

              <div className="dashboard-userbar">
                <span className="dashboard-user">{user.email || "Signed in"}</span>
                <button
                  type="button"
                  className="dashboard-signout"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="progress-wrap" aria-label="Prep progress">
              <div className="progress-meta">
                <span className="progress-label">Completed</span>
                <span className="progress-value">
                  {completedCount}/{totalCount} ({progressPercent}%)
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-label="Completed prep items"
              >
                <span className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </header>

          <section className="prep-grid-layout" aria-label="Prep item cards">
            {prepItems.map((item) => (
              <PrepItem key={item.id} item={item} />
            ))}
          </section>
        </section>
      )}
    </main>
  );
}

export default App;
