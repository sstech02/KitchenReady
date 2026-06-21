import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import RecipeCard from "./components/RecipeCard";
import ShiftHandoverForm from "./components/ShiftHandoverForm";
import HandoverHistory from "./components/HandoverHistory";
import AdminPrepPanel from "./components/AdminPrepPanel";
import DashboardMembersPanel from "./components/DashboardMembersPanel";
import type { DashboardSummary } from "./models/Dashboard";
import type { Recipe } from "./models/Recipe";
import { hasRoleAtLeast, type Role } from "./models/Role";
import { auth, isFirebaseConfigured } from "./services/firebase";
import {
  getSessionHeaders,
  getStoredDashboardId,
  setStoredDashboardId,
  setStoredUserEmail,
} from "./services/sessionHeaders";
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
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [selectedDashboardId, setSelectedDashboardIdState] = useState(getStoredDashboardId() ?? "");
  const [businessName, setBusinessName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  const selectedDashboard = dashboards.find((dashboard) => dashboard.id === selectedDashboardId) ?? null;
  const currentRole: Role | null = selectedDashboard?.role ?? null;
  const canOperate = hasRoleAtLeast(currentRole, "operator");
  const canLead = hasRoleAtLeast(currentRole, "lead");
  const isAdmin = hasRoleAtLeast(currentRole, "admin");

  const setSelectedDashboard = (dashboardId: string) => {
    setSelectedDashboardIdState(dashboardId);
    setStoredDashboardId(dashboardId || null);
  };

  const fetchDashboards = useCallback(async (userEmail: string, preferredDashboardId?: string) => {
    const res = await fetch("http://localhost:4000/api/dashboards", {
      headers: {
        "x-user-email": userEmail,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch dashboards");
    }

    const dashboardItems = (await res.json()) as DashboardSummary[];
    setDashboards(dashboardItems);

    const rememberedDashboardId = getStoredDashboardId();
    const nextDashboardId =
      dashboardItems.find((dashboard) => dashboard.id === preferredDashboardId)?.id ??
      dashboardItems.find((dashboard) => dashboard.id === rememberedDashboardId)?.id ??
      dashboardItems[0]?.id ??
      "";

    setSelectedDashboard(nextDashboardId);
  }, []);

  const fetchRecipes = useCallback(async () => {
    if (!selectedDashboardId) {
      return [] as Recipe[];
    }

    const res = await fetch("http://localhost:4000/api/recipes", {
      headers: { ...getSessionHeaders() },
    });
    if (!res.ok) {
      throw new Error("Failed to fetch recipes");
    }

    const recipeItems = (await res.json()) as Recipe[];
    return recipeItems;
  }, [selectedDashboardId]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthError("");
      setDashboardError("");
      setDashboardMessage("");

      if (currentUser?.email) {
        setStoredUserEmail(currentUser.email);
        setAdminEmail(currentUser.email);
      } else {
        setStoredUserEmail(null);
        setStoredDashboardId(null);
        setSelectedDashboardIdState("");
        setDashboards([]);
        setRecipes([]);
      }

      if (currentUser?.email) {
        fetchDashboards(currentUser.email).catch((err) => {
          console.error("Failed loading dashboards:", err);
          setDashboardError(err instanceof Error ? err.message : "Failed loading dashboards.");
        });
      }
    });

    return unsubscribe;
  }, [fetchDashboards]);

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchItems().catch((err) => {
      console.error("Failed loading prep items:", err);
    });

    fetchRecipes()
      .then((recipeItems) => {
        setRecipes(recipeItems);
      })
      .catch((err) => {
        console.error("Failed loading recipes:", err);
      });
  }, [fetchItems, fetchRecipes, user]);

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

    setShowAdminPanel(false);
    setShowMembersPanel(false);
    setShowHistory(false);
    setShowHandover(false);
    setStoredDashboardId(null);
    setStoredUserEmail(null);
    await signOut(auth);
  };

  const handleCreateDashboard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.email) {
      return;
    }

    const trimmedBusinessName = businessName.trim();
    const trimmedAdminEmail = adminEmail.trim().toLowerCase();

    if (!trimmedBusinessName) {
      setDashboardError("Business name is required.");
      return;
    }

    if (!trimmedAdminEmail) {
      setDashboardError("At least one admin email is required.");
      return;
    }

    setDashboardLoading(true);
    setDashboardError("");
    setDashboardMessage("");

    try {
      const res = await fetch("http://localhost:4000/api/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user.email,
        },
        body: JSON.stringify({
          businessName: trimmedBusinessName,
          adminEmail: trimmedAdminEmail,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : "Failed to create dashboard.";
        throw new Error(message);
      }

      const created = (await res.json()) as DashboardSummary;
      await fetchDashboards(user.email, created.id);
      setDashboardMessage(`Dashboard created for ${trimmedBusinessName}.`);
      setBusinessName("");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Failed to create dashboard.");
    } finally {
      setDashboardLoading(false);
    }
  };

  const completedCount = prepItems.filter((item) => item.status === "done").length;
  const totalCount = prepItems.length;
  const progressPercent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const handleMembershipChanged = async () => {
    if (!user?.email) {
      return;
    }

    await fetchDashboards(user.email, selectedDashboardId);
  };

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
                <h1 className="dashboard-title">{selectedDashboard?.businessName || "Prep List Dashboard"}</h1>
                <p className="dashboard-subtitle">
                  {selectedDashboard
                    ? `Shift progress for today's prep workload. Role: ${currentRole ?? "viewer"}.`
                    : "Create or join a dashboard to begin."}
                </p>

                <div className="dashboard-switcher-wrap">
                  <label className="dashboard-switcher-label">
                    <span>Dashboard</span>
                    <select
                      value={selectedDashboardId}
                      onChange={(event) => {
                        setSelectedDashboard(event.target.value);
                        setDashboardMessage("");
                        setDashboardError("");
                      }}
                    >
                      {dashboards.length === 0 && <option value="">No dashboards available</option>}
                      {dashboards.map((dashboard) => (
                        <option key={dashboard.id} value={dashboard.id}>
                          {dashboard.businessName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="dashboard-role-pill">{currentRole ? currentRole.toUpperCase() : "NO ROLE"}</span>
                </div>
              </div>

              <div className="dashboard-userbar">
                <span className="dashboard-user">{user.email || "Signed in"}</span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="admin-trigger-btn"
                        onClick={() => setShowMembersPanel(true)}
                        disabled={!selectedDashboardId}
                      >
                        Manage Team
                      </button>
                      <button
                        type="button"
                        className="admin-trigger-btn"
                        onClick={() => setShowAdminPanel(true)}
                        disabled={!selectedDashboardId}
                      >
                        Admin Panel
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="hist-trigger-btn"
                    onClick={() => setShowHistory(true)}
                    disabled={!selectedDashboardId}
                  >
                    View Handovers
                  </button>
                  {canLead && (
                    <button
                      type="button"
                      className="handover-trigger-btn"
                      onClick={() => setShowHandover(true)}
                      disabled={!selectedDashboardId}
                    >
                      Start Handover
                    </button>
                  )}
                  <button
                    type="button"
                    className="dashboard-signout"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </button>
                </div>
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

            {!isAdmin && selectedDashboardId && (
              <p className="dashboard-access-note" role="note">
                You have {currentRole ?? "viewer"} access in this dashboard. Higher roles unlock handover and admin actions.
              </p>
            )}
          </header>

          <section className="dashboard-setup" aria-label="Dashboard setup">
            <h2 className="dashboard-setup-title">Create New Dashboard</h2>
            <p className="dashboard-setup-copy">
              Each dashboard must define a business name and one initial admin account.
            </p>

            <form className="dashboard-setup-form" onSubmit={handleCreateDashboard}>
              <label className="dashboard-setup-field">
                <span>Business name</span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="KitchenReady Main"
                  required
                />
              </label>

              <label className="dashboard-setup-field">
                <span>Initial admin email</span>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="admin@restaurant.com"
                  required
                />
              </label>

              <button type="submit" className="dashboard-setup-submit" disabled={dashboardLoading || !user.email}>
                {dashboardLoading ? "Creating..." : "Create Dashboard"}
              </button>
            </form>

            {dashboardMessage && <p className="dashboard-setup-success">{dashboardMessage}</p>}
            {dashboardError && <p className="dashboard-setup-error">{dashboardError}</p>}
          </section>

          {selectedDashboardId ? (
            <>
              <section className="prep-grid-layout" aria-label="Prep item cards">
                {prepItems.map((item) => (
                  <PrepItem key={item.id} item={item} canEdit={canOperate} />
                ))}
              </section>

              <section className="recipes-panel" aria-label="Recipe scaling">
                <div className="section-heading">
                  <div>
                    <h2 className="section-title">Recipe Scaling</h2>
                    <p className="section-copy">
                      Adjust ingredient quantities for common batch sizes.
                    </p>
                  </div>
                </div>

                <div className="recipe-grid-layout">
                  {recipes.map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <p className="dashboard-empty-state">
              No dashboard selected yet. Create one above or ask an admin to add you as a member.
            </p>
          )}
        </section>
      )}

      {showHandover && user && canLead && selectedDashboardId && (
        <ShiftHandoverForm
          currentUser={user}
          prepItems={prepItems}
          onClose={() => setShowHandover(false)}
        />
      )}

      {showHistory && selectedDashboardId && (
        <HandoverHistory onClose={() => setShowHistory(false)} />
      )}

      {showAdminPanel && user && isAdmin && selectedDashboardId && (
        <AdminPrepPanel
          adminEmail={user.email ?? user.uid}
          items={prepItems}
          onClose={() => setShowAdminPanel(false)}
          onItemsChanged={fetchItems}
        />
      )}

      {showMembersPanel && user && selectedDashboardId && (
        <DashboardMembersPanel
          dashboardId={selectedDashboardId}
          currentUserEmail={user.email ?? user.uid}
          onClose={() => setShowMembersPanel(false)}
          onMembershipChanged={handleMembershipChanged}
        />
      )}
    </main>
  );
}

export default App;
