# Ready decks flow

- Decks use one shared storage object and change status between `building` and `active`.
- A building deck can be marked ready when local Commander eligibility checks pass.
- Active decks appear in `Mes decks` and open in read-only mode.
- Card details, collection ownership, mana stats, bracket analysis and combos remain visible in ready mode.
- `Remettre en construction` switches the same deck back to `building` without copying or losing its list.
- Current automatic ready validation supports one commander. Partner/Background compatibility is intentionally not auto-certified yet.
