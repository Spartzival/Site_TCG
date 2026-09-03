"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  loadCloudState,
  saveCollectionToCloud,
  saveDecksToCloud,
} from "@/lib/mtg/cloud-storage";
import {
  clearCollectionCache,
  loadCollection,
  writeCollectionCache,
} from "@/lib/mtg/collection-storage";
import {
  clearDeckProjectsCache,
  loadDeckProjects,
  writeDeckProjectsCache,
} from "@/lib/mtg/deck-storage";
import {
  clearStorageMode,
  getStorageMode,
  setStorageMode,
  type MtgStorageMode,
} from "@/lib/mtg/storage-mode";
import { fetchJson } from "@/lib/http/fetch-json";

type Props = {
  children: ReactNode;
};

type GateState = "loading" | "signed-out" | "ready";

type DeleteAccountResponse = {
  ok?: boolean;
  error?: string;
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

async function hydrateCloudIntoLocalCache() {
  const localCollection = loadCollection();
  const localDecks = loadDeckProjects();
  const cloud = await loadCloudState();

  if (cloud.collection !== null) {
    writeCollectionCache(cloud.collection);
  } else {
    await saveCollectionToCloud(localCollection);
  }

  if (cloud.decks !== null) {
    writeDeckProjectsCache(cloud.decks);
  } else {
    await saveDecksToCloud(localDecks);
  }
}

export default function MtgAuthGate({ children }: Props) {
  const configured = isSupabaseConfigured();
  const [state, setState] = useState<GateState>(configured ? "loading" : "ready");
  const [storageMode, setCurrentStorageMode] = useState<MtgStorageMode | null>(
    configured ? null : "guest",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    if (!configured) {
      setCurrentStorageMode("guest");
      setState("ready");
      return;
    }

    const savedMode = getStorageMode();
    if (savedMode === "guest") {
      setCurrentStorageMode("guest");
      setState("ready");
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session?.user) {
          setCurrentStorageMode(null);
          setState("signed-out");
          return;
        }

        setAccountEmail(session.user.email ?? null);

        try {
          await hydrateCloudIntoLocalCache();

          if (cancelled) return;

          setStorageMode("cloud");
          setCurrentStorageMode("cloud");
          setMessage(null);
          setState("ready");
        } catch (cloudError) {
          if (cancelled) return;

          const detail = errorMessage(
            cloudError,
            "Impossible de lire ou d'écrire les tables Supabase.",
          );

          console.warn(`Sauvegarde cloud indisponible : ${detail}`);

          // On conserve l'accès à l'application et aux données locales.
          setStorageMode("guest");
          setCurrentStorageMode("guest");
          setMessage(`Cloud indisponible : ${detail}`);
          setState("ready");
        }
      } catch (authError) {
        if (cancelled) return;

        const detail = errorMessage(authError, "Impossible de vérifier la session Supabase.");
        console.warn(`Session Supabase indisponible : ${detail}`);
        setMessage(detail);
        setCurrentStorageMode(null);
        setState("signed-out");
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [configured]);

  const enterGuestMode = () => {
    setStorageMode("guest");
    setCurrentStorageMode("guest");
    setAccountEmail(null);
    setMessage(null);
    setState("ready");
  };

  const retryCloud = async () => {
    setBusy(true);
    setMessage(null);

    try {
      await hydrateCloudIntoLocalCache();
      setStorageMode("cloud");
      setCurrentStorageMode("cloud");
      setState("ready");
    } catch (error) {
      const detail = errorMessage(error, "Impossible de synchroniser avec Supabase.");
      console.warn(`Synchronisation Supabase impossible : ${detail}`);
      setStorageMode("guest");
      setCurrentStorageMode("guest");
      setMessage(`Cloud indisponible : ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const openCloudLogin = async () => {
    clearStorageMode();
    setMessage(null);

    // Si une session existe déjà (par exemple après un échec DB), on la réessaie
    // sans demander à nouveau le mot de passe.
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setAccountEmail(session.user.email ?? null);
        await retryCloud();
        return;
      }
    } catch {
      // On affiche simplement le formulaire de connexion.
    }

    setCurrentStorageMode(null);
    setState("signed-out");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const supabase = createClient();
      let signedInEmail = email.trim();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/mtg`,
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Compte créé. Vérifie ton e-mail si la confirmation est activée, puis connecte-toi.",
          );
          setMode("signin");
          return;
        }

        signedInEmail = data.user?.email ?? email.trim();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        signedInEmail = data.user.email ?? email.trim();
      }

      setAccountEmail(signedInEmail);

      try {
        await hydrateCloudIntoLocalCache();
        setStorageMode("cloud");
        setCurrentStorageMode("cloud");
        setMessage(null);
        setState("ready");
      } catch (cloudError) {
        const detail = errorMessage(
          cloudError,
          "Connexion réussie, mais la base Supabase n'est pas accessible.",
        );

        console.warn(`Connexion OK mais synchronisation cloud impossible : ${detail}`);
        setStorageMode("guest");
        setCurrentStorageMode("guest");
        setMessage(`Connecté, mais cloud indisponible : ${detail}`);
        setState("ready");
      }
    } catch (error) {
      setMessage(errorMessage(error, "Connexion impossible."));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      clearCollectionCache();
      clearDeckProjectsCache();
      clearStorageMode();
      setCurrentStorageMode(null);
      setAccountEmail(null);
      setState("signed-out");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== "SUPPRIMER") return;

    setBusy(true);
    setMessage(null);

    try {
      const payload = await fetchJson<DeleteAccountResponse>("/api/account/delete", {
        method: "DELETE",
      });

      if (!payload.ok) {
        throw new Error(payload.error ?? "Suppression impossible.");
      }

      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // Le compte est déjà supprimé côté serveur.
      }

      clearCollectionCache();
      clearDeckProjectsCache();
      clearStorageMode();
      setCurrentStorageMode(null);
      setAccountEmail(null);
      setDeleteOpen(false);
      setDeleteConfirmation("");
      setState("signed-out");
      setMessage("Compte supprimé définitivement.");
    } catch (error) {
      setMessage(errorMessage(error, "Suppression impossible."));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <>
        <div className="mtg-cloud-account is-guest">
          <span>Mode invité</span>
          <small>Stockage local uniquement</small>
        </div>
        {children}
      </>
    );
  }

  if (state === "loading") {
    return (
      <main className="mtg-auth-screen">
        <div className="mtg-auth-card">
          <span>MAGIC LIBRARY</span>
          <h1>Chargement de ta bibliothèque…</h1>
          <p>Synchronisation de la collection et des decks.</p>
        </div>
      </main>
    );
  }

  if (state === "signed-out") {
    return (
      <main className="mtg-auth-screen">
        <form className="mtg-auth-card" onSubmit={submit}>
          <span>MAGIC LIBRARY</span>
          <h1>{mode === "signin" ? "Connexion" : "Créer un compte"}</h1>
          <p>
            Connecte-toi pour sauvegarder ta collection et tes decks dans le cloud,
            ou continue en invité pour les garder uniquement sur cet appareil.
          </p>

          <label>
            <span>E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            <span>Mot de passe</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {message && <div className="mtg-auth-message">{message}</div>}

          <button className="mtg-primary-button" type="submit" disabled={busy}>
            {busy
              ? "Connexion…"
              : mode === "signin"
                ? "Se connecter"
                : "Créer le compte"}
          </button>

          <button
            className="mtg-auth-switch"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode((current) => (current === "signin" ? "signup" : "signin"));
              setMessage(null);
            }}
          >
            {mode === "signin"
              ? "Pas encore de compte ? Créer un compte"
              : "Déjà un compte ? Se connecter"}
          </button>

          <div className="mtg-auth-divider">
            <span>OU</span>
          </div>

          <button
            type="button"
            className="mtg-guest-button"
            disabled={busy}
            onClick={enterGuestMode}
          >
            <strong>Continuer en invité</strong>
            <span>Données stockées uniquement sur cet appareil</span>
          </button>

          <Link href="/" className="mtg-auth-back-home">
            ← Retour au menu des projets
          </Link>
        </form>
      </main>
    );
  }

  if (storageMode === "guest") {
    return (
      <>
        <div className="mtg-cloud-account is-guest">
          <span>Mode invité</span>
          <small>Stockage local uniquement</small>
          {message && <small className="mtg-cloud-warning">{message}</small>}
          <button type="button" disabled={busy} onClick={() => void openCloudLogin()}>
            {busy
              ? "Connexion…"
              : accountEmail
                ? "Réessayer le cloud"
                : "Se connecter / sauvegarder"}
          </button>
        </div>
        {children}
      </>
    );
  }

  return (
    <>
      <div className="mtg-cloud-account">
        <span>Cloud actif</span>
        {accountEmail && <small>{accountEmail}</small>}
        <button type="button" disabled={busy} onClick={() => void signOut()}>
          Déconnexion
        </button>
        <button
          type="button"
          className="is-danger"
          disabled={busy}
          onClick={() => {
            setDeleteOpen(true);
            setDeleteConfirmation("");
            setMessage(null);
          }}
        >
          Supprimer le compte
        </button>
      </div>

      {deleteOpen && (
        <div
          className="mtg-account-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setDeleteOpen(false);
            }
          }}
        >
          <section
            className="mtg-account-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mtg-delete-account-title"
          >
            <span>ZONE DANGEREUSE</span>
            <h2 id="mtg-delete-account-title">Supprimer mon compte</h2>
            <p>
              Cette action supprime définitivement ton compte, ta collection MTG et
              tes decks sauvegardés dans le cloud.
            </p>

            <label>
              <span>Écris SUPPRIMER pour confirmer</span>
              <input
                type="text"
                value={deleteConfirmation}
                disabled={busy}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>

            {message && <div className="mtg-auth-message">{message}</div>}

            <div className="mtg-account-delete-actions">
              <button
                type="button"
                className="mtg-secondary-button"
                disabled={busy}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                  setMessage(null);
                }}
              >
                Annuler
              </button>

              <button
                type="button"
                className="mtg-danger-button"
                disabled={busy || deleteConfirmation !== "SUPPRIMER"}
                onClick={() => void deleteAccount()}
              >
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </section>
        </div>
      )}

      {children}
    </>
  );
}
