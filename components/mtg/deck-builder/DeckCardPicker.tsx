"use client";

import { useEffect, useState } from "react";
import type { MtgCard } from "@/types/mtg";
import { autocompleteCards, getNamedCard } from "@/lib/mtg/api-client";

type Props = {
  label: string;
  placeholder?: string;
  buttonLabel?: string;
  onSelect: (card: MtgCard) => void;
  validate?: (card: MtgCard) => string | null;
};

export default function DeckCardPicker({
  label,
  placeholder = "Sol Ring, Beast Whisperer…",
  buttonLabel = "Ajouter",
  onSelect,
  validate,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const names = await autocompleteCards(query.trim(), controller.signal);
        setSuggestions(names);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Recherche impossible.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const choose = async (name: string) => {
    setSelecting(true);
    setSuggestions([]);
    setError(null);

    try {
      const card = await getNamedCard(name);
      const validationError = validate?.(card) ?? null;

      if (validationError) {
        setError(validationError);
        setQuery(card.name);
        return;
      }

      onSelect(card);
      setQuery("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Carte introuvable.");
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="mtg-deck-picker">
      <label>
        <span>{label}</span>
        <input
          value={query}
          type="search"
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
          }}
        />
      </label>

      {(loading || selecting) && (
        <p className="mtg-deck-picker__status">Recherche…</p>
      )}

      {error && <p className="mtg-deck-picker__error">{error}</p>}

      {!loading && suggestions.length > 0 && (
        <div className="mtg-deck-picker__suggestions">
          {suggestions.map((name) => (
            <button key={name} type="button" onClick={() => void choose(name)}>
              <span>{name}</span>
              <small>{buttonLabel} →</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
