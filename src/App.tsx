import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import "./App.css";
import PrepItem from "./components/PrepItem";
import RecipeDetailView from "./components/RecipeDetailView";
import RecipeListView from "./components/RecipeListView";
import ShiftHandoverForm from "./components/ShiftHandoverForm";
import HandoverHistory from "./components/HandoverHistory";
import AdminPrepPanel from "./components/AdminPrepPanel";
import AdminRecipePanel from "./components/AdminRecipePanel";
import DashboardMembersPanel from "./components/DashboardMembersPanel";
import type { DashboardSummary } from "./models/Dashboard";
import type { PrepItem as PrepItemModel } from "./models/PrepItem";
import type { Recipe } from "./models/Recipe";
import { hasRoleAtLeast, type Role } from "./models/Role";
import { auth, isFirebaseConfigured } from "./services/firebase";
import {
  getApiBaseUrl,
  getSessionHeaders,
  getStoredDashboardId,
  setStoredDashboardId,
  setStoredUserEmail,
} from "./services/sessionHeaders";
import { usePrepStore } from "./store/usePrepStore";

const reorderRecipeIds = (recipeIds: string[], sourceId: string, targetId: string) => {
  if (sourceId === targetId) {
    return recipeIds;
  }

  const next = recipeIds.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);

  if (targetIndex === -1) {
    return [...next, sourceId];
  }

  next.splice(targetIndex, 0, sourceId);
  return next;
};

const reorderPrepIds = (prepIds: string[], sourceId: string, targetId: string) => {
  if (sourceId === targetId) {
    return prepIds;
  }

  const next = prepIds.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);

  if (targetIndex === -1) {
    return [...next, sourceId];
  }

  next.splice(targetIndex, 0, sourceId);
  return next;
};

type DragPayload = {
  kind: "recipe" | "prep";
  id: string;
};

const normalizeLookupValue = (value: string) => value.trim().toLowerCase();

const tokenizeLookupValue = (value: string) =>
  normalizeLookupValue(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

const getFirebaseErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

const formatAuthError = (error: unknown): string => {
  const code = getFirebaseErrorCode(error);

  if (code === "auth/unauthorized-domain") {
    const currentDomain = window.location.hostname;
    return `Google sign-in is blocked for this domain (${currentDomain}). Add it in Firebase Console > Authentication > Settings > Authorized domains, then retry.`;
  }

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in popup was closed before completing login.";
  }

  if (code === "auth/popup-blocked") {
    return "Popup was blocked by the browser. Retrying with redirect sign-in...";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
};

function App() {
  const prepItems = usePrepStore((state) => state.items);
  const fetchItems = usePrepStore((state) => state.fetchItems);
  const [user, setUser] = useState<User | null>(null);
  const [guestSessionEmail, setGuestSessionEmail] = useState<string | null>(null);
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
  const [showRecipePanel, setShowRecipePanel] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  // ── Theme, zoom & UI ─────────────────────────────────────────
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    (localStorage.getItem("kr-theme") as "light" | "dark") ?? "light"
  );
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem("kr-zoom")) || 100);
  const [showGuide, setShowGuide] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [prepOrder, setPrepOrder] = useState<string[]>([]);
  const [recipeOrder, setRecipeOrder] = useState<string[]>([]);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [draggedPrepId, setDraggedPrepId] = useState<string | null>(null);
  const [dragOverPrepId, setDragOverPrepId] = useState<string | null>(null);
  const [draggedRecipeId, setDraggedRecipeId] = useState<string | null>(null);
  const [dragOverRecipeId, setDragOverRecipeId] = useState<string | null>(null);
  const [isLibraryDragOver, setIsLibraryDragOver] = useState(false);
  const [libraryDropMessage, setLibraryDropMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const scrollObserverRef = useRef<IntersectionObserver | null>(null);

  const firebaseMissingMessage = import.meta.env.PROD
    ? "Firebase is not configured. Set VITE_FIREBASE_* variables in Vercel and redeploy."
    : "Firebase is not configured. Add the VITE_FIREBASE_* values to your .env.local file.";
  const guestEmail = "guest@kitchenready.app";
  const currentUserEmail = user?.email ?? guestSessionEmail;
  const currentUserIdentity = currentUserEmail ?? user?.uid ?? null;
  const isGuestSession = currentUserEmail === guestEmail;
  const hasSession = Boolean(user || guestSessionEmail);

  const selectedDashboard = dashboards.find((dashboard) => dashboard.id === selectedDashboardId) ?? null;
  const currentRole: Role | null = selectedDashboard?.role ?? null;
  const canOperate = isGuestSession || hasRoleAtLeast(currentRole, "operator");
  const canLead = isGuestSession || hasRoleAtLeast(currentRole, "lead");
  const isAdmin = isGuestSession || hasRoleAtLeast(currentRole, "admin");
  const isDeleteNameMatch = deleteConfirmName.trim() === (selectedDashboard?.businessName ?? "");

  const orderedRecipes = useMemo(() => {
    const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    const ordered = recipeOrder
      .map((recipeId) => recipeMap.get(recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe));
    const missing = recipes.filter((recipe) => !recipeOrder.includes(recipe.id));
    return [...ordered, ...missing];
  }, [recipeOrder, recipes]);

  const orderedPrepItems = useMemo(() => {
    const prepMap = new Map(prepItems.map((item) => [item.id, item]));
    const ordered = prepOrder
      .map((itemId) => prepMap.get(itemId))
      .filter((item): item is PrepItemModel => Boolean(item));
    const missing = prepItems.filter((item) => !prepOrder.includes(item.id));
    return [...ordered, ...missing];
  }, [prepItems, prepOrder]);

  const activeRecipe =
    orderedRecipes.find((recipe) => recipe.id === activeRecipeId) ?? orderedRecipes[0] ?? null;

  const setSelectedDashboard = (dashboardId: string) => {
    setSelectedDashboardIdState(dashboardId);
    setStoredDashboardId(dashboardId || null);
  };

  const fetchDashboards = useCallback(async (userEmail: string, preferredDashboardId?: string) => {
    const res = await fetch(`${getApiBaseUrl()}/api/dashboards`, {
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

    const res = await fetch(`${getApiBaseUrl()}/api/recipes`, {
      headers: { ...getSessionHeaders() },
    });
    if (!res.ok) {
      throw new Error("Failed to fetch recipes");
    }

    const recipeItems = (await res.json()) as Recipe[];
    return recipeItems;
  }, [selectedDashboardId]);

  const handlePrepItemsChanged = useCallback(async () => {
    try {
      await fetchItems();
    } catch (error) {
      console.error("Failed to refresh prep items:", error);
    }

    try {
      setRecipesLoading(true);
      const recipeItems = await fetchRecipes();
      setRecipes(recipeItems);
    } catch (error) {
      console.error("Failed to refresh recipes after prep item change:", error);
    } finally {
      setRecipesLoading(false);
    }
  }, [fetchItems, fetchRecipes]);

  // Persist & apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kr-theme", theme);
  }, [theme]);

  // Persist zoom
  useEffect(() => {
    localStorage.setItem("kr-zoom", String(zoom));
  }, [zoom]);

  // Scroll-reveal observer – re-run whenever content changes
  useEffect(() => {
    scrollObserverRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.08 }
    );
    scrollObserverRef.current = observer;
    document.querySelectorAll(".scroll-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [prepItems, recipes]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setGuestSessionEmail(null);
      }
      setAuthError("");
      setDashboardError("");
      setDashboardMessage("");

      if (currentUser?.email) {
        setStoredUserEmail(currentUser.email);
        setAdminEmail(currentUser.email);
      } else if (!guestSessionEmail) {
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
  }, [fetchDashboards, guestSessionEmail]);

  useEffect(() => {
    if (!currentUserEmail) {
      return;
    }

    setPrepLoading(true);
    fetchItems()
      .catch((err) => {
        console.error("Failed loading prep items:", err);
      })
      .finally(() => setPrepLoading(false));

    setRecipesLoading(true);
    fetchRecipes()
      .then((recipeItems) => {
        setRecipes(recipeItems);
      })
      .catch((err) => {
        console.error("Failed loading recipes:", err);
      })
      .finally(() => setRecipesLoading(false));
  }, [currentUserEmail, fetchItems, fetchRecipes]);

  useEffect(() => {
    const prepIds = prepItems.map((item) => item.id);

    setPrepOrder((current) => {
      const retained = current.filter((id) => prepIds.includes(id));
      const additions = prepIds.filter((id) => !retained.includes(id));
      const next = [...retained, ...additions];

      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }

      return next;
    });
  }, [prepItems]);

  useEffect(() => {
    const recipeIds = recipes.map((recipe) => recipe.id);

    setRecipeOrder((current) => {
      const retained = current.filter((id) => recipeIds.includes(id));
      const additions = recipeIds.filter((id) => !retained.includes(id));
      const next = [...retained, ...additions];

      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }

      return next;
    });

    setActiveRecipeId((current) => {
      if (recipeIds.length === 0) {
        return null;
      }

      if (current && recipeIds.includes(current)) {
        return current;
      }

      return recipeIds[0];
    });
  }, [recipes]);

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
      setAuthError(firebaseMissingMessage);
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = getFirebaseErrorCode(error);
      if (code === "auth/popup-blocked") {
        try {
          setAuthMessage("Popup blocked. Continuing with full-page Google sign-in...");
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirectError) {
          setAuthError(formatAuthError(redirectError));
          return;
        }
      }

      setAuthError(formatAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      setAuthError(firebaseMissingMessage);
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
      setAuthError(firebaseMissingMessage);
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
      setAuthError(firebaseMissingMessage);
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

  const handleGuestSignIn = async () => {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      setGuestSessionEmail(guestEmail);
      setStoredUserEmail(guestEmail);
      setAdminEmail(guestEmail);
      await fetchDashboards(guestEmail);
      setAuthMessage("Signed in as guest.");
    } catch (error) {
      setGuestSessionEmail(null);
      setStoredUserEmail(null);
      setAuthError(error instanceof Error ? error.message : "Guest sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setShowAdminPanel(false);
    setShowMembersPanel(false);
    setShowHistory(false);
    setShowHandover(false);
    setGuestSessionEmail(null);
    setUser(null);
    setDashboards([]);
    setRecipes([]);
    setSelectedDashboardIdState("");
    setStoredDashboardId(null);
    setStoredUserEmail(null);

    if (auth && user) {
      await signOut(auth);
    }
  };

  const handleCreateDashboard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUserEmail) {
      return;
    }

    if (isGuestSession) {
      setDashboardError("Guest mode does not save dashboard changes. Sign in to create dashboards.");
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
      const res = await fetch(`${getApiBaseUrl()}/api/dashboards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUserEmail,
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
  await fetchDashboards(currentUserEmail, created.id);
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
    if (!currentUserEmail) {
      return;
    }

    await fetchDashboards(currentUserEmail, selectedDashboardId);
  };

  const resetRecipeDragState = () => {
    setDraggedPrepId(null);
    setDragOverPrepId(null);
    setDraggedRecipeId(null);
    setDragOverRecipeId(null);
    setIsLibraryDragOver(false);
  };

  const getDraggedPayloadFromEvent = (event: DragEvent<HTMLElement>): DragPayload | null => {
    const raw = event.dataTransfer.getData("text/plain");

    if (raw.includes(":")) {
      const [kind, ...rest] = raw.split(":");
      const id = rest.join(":");

      if ((kind === "recipe" || kind === "prep") && id) {
        return { kind, id };
      }
    }

    if (draggedRecipeId) {
      return { kind: "recipe", id: draggedRecipeId };
    }

    if (draggedPrepId) {
      return { kind: "prep", id: draggedPrepId };
    }

    return null;
  };

  const resolveRecipeForPrepItem = (prepItemId: string) => {
    const prepItem = orderedPrepItems.find((item) => item.id === prepItemId);
    if (!prepItem) {
      return null;
    }

    const linkedRecipe = prepItem.recipeId
      ? orderedRecipes.find((recipe) => recipe.id === prepItem.recipeId)
      : undefined;

    if (linkedRecipe) {
      return {
        prepItem,
        recipe: linkedRecipe,
      };
    }

    const normalizedPrepName = normalizeLookupValue(prepItem.name);
    const exactMatch = orderedRecipes.find(
      (recipe) => normalizeLookupValue(recipe.name) === normalizedPrepName,
    );

    if (exactMatch) {
      return {
        prepItem,
        recipe: exactMatch,
      };
    }

    const prepTokens = tokenizeLookupValue(prepItem.name);
    const bestMatch = orderedRecipes.reduce<Recipe | null>((bestRecipe, recipe) => {
      const normalizedRecipeName = normalizeLookupValue(recipe.name);

      const containsBoost =
        normalizedRecipeName.includes(normalizedPrepName) ||
        normalizedPrepName.includes(normalizedRecipeName)
          ? 100
          : 0;

      const recipeTokens = tokenizeLookupValue(recipe.name);
      const overlapCount = prepTokens.filter((token) => recipeTokens.includes(token)).length;

      const score = containsBoost + overlapCount;
      if (score === 0) {
        return bestRecipe;
      }

      if (!bestRecipe) {
        return recipe;
      }

      const bestRecipeName = normalizeLookupValue(bestRecipe.name);
      const bestContainsBoost =
        bestRecipeName.includes(normalizedPrepName) ||
        normalizedPrepName.includes(bestRecipeName)
          ? 100
          : 0;
      const bestTokens = tokenizeLookupValue(bestRecipe.name);
      const bestOverlapCount = prepTokens.filter((token) => bestTokens.includes(token)).length;
      const bestScore = bestContainsBoost + bestOverlapCount;

      return score > bestScore ? recipe : bestRecipe;
    }, null);

    return {
      prepItem,
      recipe: bestMatch ?? null,
    };
  };

  const handleRecipeDragStart = (recipeId: string, event: DragEvent<HTMLDivElement>) => {
    setDraggedRecipeId(recipeId);
    setDraggedPrepId(null);
    setLibraryDropMessage("");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `recipe:${recipeId}`);
  };

  const handlePrepDragStart = (prepItemId: string, event: DragEvent<HTMLDivElement>) => {
    setDraggedPrepId(prepItemId);
    setDraggedRecipeId(null);
    setLibraryDropMessage("");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `prep:${prepItemId}`);
  };

  const promoteRecipeToLibraryFront = (recipeId: string) => {
    setRecipeOrder((current) => {
      const baseOrder = current.length > 0 ? current : recipes.map((recipe) => recipe.id);
      const next = baseOrder.filter((id) => id !== recipeId);
      return [recipeId, ...next];
    });
  };

  const handleRecipeDropOnCard = (targetId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const payload = getDraggedPayloadFromEvent(event);
    if (!payload || payload.kind !== "recipe") {
      resetRecipeDragState();
      return;
    }

    setRecipeOrder((current) => reorderRecipeIds(current.length > 0 ? current : recipes.map((recipe) => recipe.id), payload.id, targetId));
    setDragOverRecipeId(null);
    setDraggedRecipeId(payload.id);
  };

  const handlePrepDropOnLibrary = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const payload = getDraggedPayloadFromEvent(event);
    if (!payload || payload.kind !== "prep") {
      resetRecipeDragState();
      return;
    }

    const resolution = resolveRecipeForPrepItem(payload.id);

    if (resolution?.recipe) {
      promoteRecipeToLibraryFront(resolution.recipe.id);
      setActiveRecipeId(resolution.recipe.id);
      setLibraryDropMessage(`Loaded ${resolution.recipe.name} into the recipe library from prep item ${resolution.prepItem.name}.`);
    } else if (resolution?.prepItem) {
      setLibraryDropMessage(`No recipe is available to load for prep item ${resolution.prepItem.name}.`);
    }

    resetRecipeDragState();
  };

  const handlePrepDropOnCard = (targetId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const payload = getDraggedPayloadFromEvent(event);
    if (!payload || payload.kind !== "prep") {
      resetRecipeDragState();
      return;
    }

    setPrepOrder((current) => reorderPrepIds(current.length > 0 ? current : prepItems.map((item) => item.id), payload.id, targetId));
    setDragOverPrepId(null);
    setDraggedPrepId(payload.id);
  };

  const handleDeleteDashboard = async () => {
    if (!currentUserEmail || !selectedDashboardId) {
      return;
    }

    if (isGuestSession) {
      setDeleteError("Guest mode does not save dashboard changes. Sign in to delete dashboards.");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/dashboards/${selectedDashboardId}`, {
        method: "DELETE",
        headers: { ...getSessionHeaders() },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : "Failed to delete dashboard.";
        throw new Error(message);
      }

      setDeleteConfirm(false);
      await fetchDashboards(currentUserEmail);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete dashboard.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <main className="app-shell">
      {!hasSession && (
        <section className="login-modal" aria-label="Login modal">
          <div className="login-card">
            <div className="login-card-toolbar">
              <button
                type="button"
                className="theme-toggle"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
            <p className="login-eyebrow">KitchenReady access</p>
            {modalView === "login" && (
              <>
                <h1 className="login-title">Sign in to continue</h1>
                <p className="login-copy">
                  Use your Firebase account to open the prep dashboard and keep work tied to a signed-in user.
                </p>

                {!isFirebaseConfigured && (
                  <p className="login-error login-error-soft">
                    {import.meta.env.PROD
                      ? "Firebase is not configured yet. Set VITE_FIREBASE_* variables in Vercel and redeploy."
                      : "Firebase is not configured yet. Add the VITE_FIREBASE_* values to .env.local, then restart the dev server."}
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

                <button
                  type="button"
                  className="login-submit"
                  onClick={handleGuestSignIn}
                  disabled={authLoading}
                >
                  Continue as Guest
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

      {hasSession && (
        <section className="dashboard" style={{ zoom: `${zoom}%` }} aria-label="Prep list dashboard">
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
                  <div className="dashboard-switcher-controls">
                    <label className="dashboard-switcher-label">
                      <span>Dashboard</span>
                      <div className="dashboard-switcher-inputs">
                        <select
                          value={selectedDashboardId}
                          onChange={(event) => {
                            setSelectedDashboard(event.target.value);
                            setDashboardMessage("");
                            setDashboardError("");
                            setDeleteConfirm(false);
                            setDeleteConfirmName("");
                            setDeleteError("");
                          }}
                        >
                          {dashboards.length === 0 && <option value="">No dashboards available</option>}
                          {dashboards.map((dashboard) => (
                            <option key={dashboard.id} value={dashboard.id}>
                              {dashboard.businessName}
                            </option>
                          ))}
                        </select>

                        {isAdmin && selectedDashboardId && (
                          <button
                            type="button"
                            className="dashboard-delete-trigger"
                            onClick={() => {
                              setDeleteConfirm((current) => !current);
                              setDeleteConfirmName("");
                              setDeleteError("");
                            }}
                            disabled={deleteLoading}
                            aria-label={`Delete ${selectedDashboard?.businessName ?? "dashboard"}`}
                            title="Delete dashboard"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5v.75H20a.75.75 0 0 1 0 1.5h-1.02l-.74 11.06A2.25 2.25 0 0 1 16 20.75H8a2.25 2.25 0 0 1-2.24-2.19L5.02 7.5H4a.75.75 0 0 1 0-1.5h3.5v-.75A1.5 1.5 0 0 1 9 3.75Zm6 2.25v-.75h-6V6h6ZM6.52 7.5l.73 10.96a.75.75 0 0 0 .75.79H16a.75.75 0 0 0 .75-.79l.73-10.96H6.52Zm3.23 2.25a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </label>

                    {deleteConfirm && isAdmin && selectedDashboardId && (
                      <div className="dashboard-delete-popover" role="alert">
                        <p className="dashboard-delete-copy">
                          Type <strong>{selectedDashboard?.businessName}</strong> to confirm deletion.
                        </p>
                        <label className="dashboard-delete-field">
                          <span className="dashboard-delete-label">Dashboard name</span>
                          <input
                            type="text"
                            value={deleteConfirmName}
                            onChange={(event) => {
                              setDeleteConfirmName(event.target.value);
                              setDeleteError("");
                            }}
                            placeholder={selectedDashboard?.businessName ?? "Dashboard name"}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>
                        <div className="dashboard-delete-actions">
                          <button
                            type="button"
                            className="dashboard-delete-confirm"
                            onClick={handleDeleteDashboard}
                            disabled={deleteLoading || !isDeleteNameMatch}
                          >
                            {deleteLoading ? "Deleting..." : "Delete"}
                          </button>
                          <button
                            type="button"
                            className="dashboard-delete-cancel"
                            onClick={() => {
                              setDeleteConfirm(false);
                              setDeleteConfirmName("");
                              setDeleteError("");
                            }}
                            disabled={deleteLoading}
                          >
                            Cancel
                          </button>
                        </div>
                        {!isDeleteNameMatch && deleteConfirmName.trim().length > 0 && (
                          <p className="dashboard-delete-hint">The entered name must exactly match the selected dashboard.</p>
                        )}
                        {deleteError && <p className="dashboard-delete-error">{deleteError}</p>}
                      </div>
                    )}
                  </div>
                  <span className="dashboard-role-pill">{currentRole ? currentRole.toUpperCase() : "NO ROLE"}</span>
                </div>
              </div>

              <div className="dashboard-userbar">
                <div className="dashboard-toolbar">
                  <button
                    type="button"
                    className="theme-toggle"
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    title={theme === "dark" ? "Light mode" : "Dark mode"}
                  >
                    {theme === "dark" ? "☀️" : "🌙"}
                  </button>
                  <div className="zoom-controls" aria-label="Zoom controls">
                    <span className="zoom-value">{zoom}%</span>
                    <input
                      type="range"
                      className="zoom-slider"
                      min={75}
                      max={150}
                      step={25}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      aria-label="Zoom level"
                    />
                  </div>
                  <button
                    type="button"
                    className="guide-btn"
                    onClick={() => setShowGuide(true)}
                  >
                    ? Guide
                  </button>
                </div>
                <span className="dashboard-user">{currentUserIdentity || "Signed in"}</span>
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
                      <button
                        type="button"
                        className="admin-trigger-btn"
                        onClick={() => setShowRecipePanel(true)}
                        disabled={!selectedDashboardId}
                      >
                        Manage Recipes
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

            {isGuestSession && (
              <p className="dashboard-access-note" role="note">
                Guest mode is running with admin access for demo use. Changes are local and will not be saved until you sign in.
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

              <button type="submit" className="dashboard-setup-submit" disabled={dashboardLoading || !currentUserEmail}>
                {dashboardLoading ? "Creating..." : "Create Dashboard"}
              </button>
            </form>

            {dashboardMessage && <p className="dashboard-setup-success">{dashboardMessage}</p>}
            {dashboardError && <p className="dashboard-setup-error">{dashboardError}</p>}
          </section>

          {selectedDashboardId ? (
            <>
              <section className="prep-grid-layout" aria-label="Prep item cards">
                {prepLoading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="skeleton-card scroll-reveal">
                        <div className="skeleton-row">
                          <div className="skeleton skeleton-line" style={{ width: "62%" }} />
                          <div className="skeleton skeleton-circle" />
                        </div>
                        <div className="skeleton skeleton-line skeleton-line-sm" style={{ width: "42%" }} />
                        <div className="skeleton skeleton-line skeleton-line-sm" style={{ width: "68%" }} />
                        <div className="skeleton skeleton-line skeleton-line-sm" style={{ width: "55%" }} />
                        <div className="skeleton-row" style={{ borderTop: "1px solid var(--color-border-soft)", paddingTop: "10px" }}>
                          <div className="skeleton skeleton-line-sm" style={{ width: "30%" }} />
                          <div className="skeleton skeleton-line-sm" style={{ width: "28%" }} />
                        </div>
                      </div>
                    ))
                  : orderedPrepItems.map((item) => {
                      const linkedRecipe = resolveRecipeForPrepItem(item.id)?.recipe;

                      return (
                        <div
                          key={item.id}
                          className={`scroll-reveal prep-draggable-shell${dragOverPrepId === item.id ? " is-drop-target" : ""}${linkedRecipe ? " has-linked-recipe" : ""}`}
                          draggable
                          onDragStart={(event) => handlePrepDragStart(item.id, event)}
                          onDragEnd={resetRecipeDragState}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggedPrepId && draggedPrepId !== item.id) {
                              setDragOverPrepId(item.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverPrepId === item.id) {
                              setDragOverPrepId(null);
                            }
                          }}
                          onDrop={(event) => handlePrepDropOnCard(item.id, event)}
                        >
                          <PrepItem item={item} canEdit={canOperate} />
                        </div>
                      );
                    })}
              </section>

              <section className="recipes-panel scroll-reveal" aria-label="Recipe scaler">
                <div className="section-heading">
                  <div>
                    <h2 className="section-title">Recipe Scaler</h2>
                    <p className="section-copy">
                      Pick a recipe from the list, set a target yield, and view scaled ingredient quantities.
                    </p>
                  </div>
                </div>

                <div className="recipe-library-heading">
                  <p className="recipe-library-copy">Drag recipe cards to reorder. Drop any prep card here to load the best matching recipe into the scaler.</p>
                  {libraryDropMessage && <p className="recipe-library-status">{libraryDropMessage}</p>}
                </div>

                <div className="recipe-workspace">
                  <div
                    className={`recipe-list-pane${isLibraryDragOver ? " is-prep-drop-over" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedPrepId) {
                        setIsLibraryDragOver(true);
                      }
                    }}
                    onDragLeave={() => setIsLibraryDragOver(false)}
                    onDrop={handlePrepDropOnLibrary}
                  >
                    {recipesLoading ? (
                      Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="recipe-list-skeleton" />
                      ))
                    ) : (
                      <RecipeListView
                        recipes={orderedRecipes}
                        activeRecipeId={activeRecipe?.id ?? null}
                        dragOverRecipeId={dragOverRecipeId}
                        onSelectRecipe={setActiveRecipeId}
                        onRecipeDragStart={handleRecipeDragStart}
                        onRecipeDragEnd={resetRecipeDragState}
                        onRecipeDragOver={(recipeId, event) => {
                          event.preventDefault();
                          if (draggedRecipeId && draggedRecipeId !== recipeId) {
                            setDragOverRecipeId(recipeId);
                          }
                        }}
                        onRecipeDragLeave={(recipeId) => {
                          if (dragOverRecipeId === recipeId) {
                            setDragOverRecipeId(null);
                          }
                        }}
                        onRecipeDrop={handleRecipeDropOnCard}
                      />
                    )}
                  </div>

                  <div className="recipe-detail-pane">
                    <RecipeDetailView recipe={activeRecipe} />
                  </div>
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

      {showHandover && currentUserIdentity && canLead && selectedDashboardId && (
        <ShiftHandoverForm
          currentUserEmail={currentUserIdentity}
          isGuestMode={isGuestSession}
          prepItems={prepItems}
          onClose={() => setShowHandover(false)}
        />
      )}

      {showHistory && selectedDashboardId && (
        <HandoverHistory onClose={() => setShowHistory(false)} />
      )}

      {showAdminPanel && currentUserIdentity && isAdmin && selectedDashboardId && (
        <AdminPrepPanel
          adminEmail={currentUserIdentity}
          isGuestMode={isGuestSession}
          items={prepItems}
          onClose={() => setShowAdminPanel(false)}
          onItemsChanged={handlePrepItemsChanged}
        />
      )}

      {showRecipePanel && currentUserIdentity && isAdmin && selectedDashboardId && (
        <AdminRecipePanel
          isGuestMode={isGuestSession}
          recipes={recipes}
          onClose={() => setShowRecipePanel(false)}
          onRecipesChanged={async () => {
            setRecipesLoading(true);
            try {
              const res = await fetch(`${getApiBaseUrl()}/api/recipes`, {
                headers: { ...getSessionHeaders() },
              });
              if (res.ok) {
                const recipeItems = (await res.json()) as Recipe[];
                setRecipes(recipeItems);
              }
            } catch (error) {
              console.error("Failed to refresh recipes:", error);
            } finally {
              setRecipesLoading(false);
            }
          }}
        />
      )}

      {showMembersPanel && currentUserIdentity && selectedDashboardId && (
        <DashboardMembersPanel
          dashboardId={selectedDashboardId}
          currentUserEmail={currentUserIdentity}
          isGuestMode={isGuestSession}
          onClose={() => setShowMembersPanel(false)}
          onMembershipChanged={handleMembershipChanged}
        />
      )}

      {showGuide && (
        <div className="guide-overlay" role="dialog" aria-modal="true" aria-label="KitchenReady Guide">
          <div className="guide-panel">
            <div className="guide-header">
              <div>
                <p className="guide-eyebrow">KitchenReady</p>
                <h2 className="guide-title">How to Use This App</h2>
              </div>
              <button
                type="button"
                className="guide-close"
                onClick={() => setShowGuide(false)}
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>

            <div className="guide-body">
              {/* Video walkthrough */}
              <section className="guide-section">
                <h3 className="guide-section-title">Video Walkthrough</h3>
                <div className="guide-video-wrap">
                  <iframe
                    src="https://www.youtube.com/embed/dEDCqVHeHtg"
                    title="KitchenReady walkthrough"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="guide-section-body">
                  Watch the overview above to get up and running quickly, or follow the written steps below.
                </p>
              </section>

              <div className="guide-divider" />

              {/* Getting started */}
              <section className="guide-section">
                <h3 className="guide-section-title">Getting Started</h3>
                <ol className="guide-steps">
                  <li className="guide-step">
                    <span><strong>Sign in</strong> with your Google account or create an email/password account from the login screen.</span>
                  </li>
                  <li className="guide-step">
                    <span><strong>Create a dashboard</strong> by entering your business name and the initial admin email in the "Create New Dashboard" form, then click <em>Create Dashboard</em>.</span>
                  </li>
                  <li className="guide-step">
                    <span><strong>Add team members</strong> using the <em>Manage Team</em> button (admin only). Assign each member a role: operator, lead, or admin.</span>
                  </li>
                  <li className="guide-step">
                    <span><strong>Switch dashboards</strong> using the dropdown in the header if you belong to multiple kitchens.</span>
                  </li>
                </ol>
              </section>

              <div className="guide-divider" />

              {/* Prep list */}
              <section className="guide-section">
                <h3 className="guide-section-title">Managing the Prep List</h3>
                <ol className="guide-steps">
                  <li className="guide-step">
                    <span>Each <strong>prep card</strong> shows item name, station, priority, on-hand quantity, par level, and target quantity.</span>
                  </li>
                  <li className="guide-step">
                    <span>Click the <strong>status pill</strong> (To do → In progress → Done) to cycle the status of a prep task.</span>
                  </li>
                  <li className="guide-step">
                    <span>Use the <strong>+/−</strong> buttons to adjust on-hand quantity, par level, target quantity, and priority in real time.</span>
                  </li>
                  <li className="guide-step">
                    <span>The <strong>progress bar</strong> at the top shows how many items have been completed out of the total for the shift.</span>
                  </li>
                  <li className="guide-step">
                    <span>Admins can <strong>add, edit, or remove prep items</strong> via the <em>Admin Panel</em> button in the header.</span>
                  </li>
                </ol>
              </section>

              <div className="guide-divider" />

              {/* Recipe scaler */}
              <section className="guide-section">
                <h3 className="guide-section-title">Recipe Scaler</h3>
                <ol className="guide-steps">
                  <li className="guide-step">
                    <span>Open the <strong>Recipe Scaler</strong> panel and pick a recipe from the list view.</span>
                  </li>
                  <li className="guide-step">
                    <span>Enter the target yield amount in the detail view to recalculate ingredient quantities.</span>
                  </li>
                  <li className="guide-step">
                    <span>Use drag and drop to reorder recipes, and drop any prep card to load a matching recipe automatically.</span>
                  </li>
                </ol>
              </section>

              <div className="guide-divider" />

              {/* Shift handover */}
              <section className="guide-section">
                <h3 className="guide-section-title">Shift Handover</h3>
                <ol className="guide-steps">
                  <li className="guide-step">
                    <span>Click <strong>Start Handover</strong> (lead or admin role required) to open the handover form.</span>
                  </li>
                  <li className="guide-step">
                    <span>Fill in the <strong>business date, shift type, from/to users, shift summary</strong>, flag any low-stock items, and list issues or blockers.</span>
                  </li>
                  <li className="guide-step">
                    <span>Check the <strong>sign-off checkbox</strong> to confirm the handover, then submit. The prep snapshot is saved automatically.</span>
                  </li>
                  <li className="guide-step">
                    <span>Click <strong>View Handovers</strong> to browse past handover records and filter by shift type.</span>
                  </li>
                </ol>
              </section>

              <div className="guide-divider" />

              {/* UI controls */}
              <section className="guide-section">
                <h3 className="guide-section-title">UI Controls</h3>
                <p className="guide-section-body">
                  Use the toolbar in the top-right corner of the dashboard to customise your experience:
                </p>
                <ol className="guide-steps">
                  <li className="guide-step">
                    <span><strong>🌙 / ☀️ Toggle</strong> — switch between dark and light mode. Your preference is saved automatically.</span>
                  </li>
                  <li className="guide-step">
                    <span><strong>Zoom controls (−/+)</strong> — scale the dashboard content between 75 % and 150 % to suit your screen or preference.</span>
                  </li>
                  <li className="guide-step">
                    <span><strong>? Guide</strong> — opens this help panel at any time.</span>
                  </li>
                </ol>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
