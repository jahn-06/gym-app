// Sdílená logika pro práci s platností permanentek. Místo abychom věřili
// uloženému textovému stavu ("active"/"pending"), který se po nákupu už
// nikdy sám neaktualizuje, počítáme skutečnou platnost VŽDY znovu podle
// dnešního data - appka tak nikdy nemůže zobrazit zastaralý stav.

export type MembershipLabel = 'active' | 'pending' | 'expired';

export function todayIso(): string {
  return dateToIso(new Date());
}

export function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Porovnává ISO datumové řetězce ("YYYY-MM-DD") - jde to bezpečně dělat
// jako obyčejné porovnání textu, protože formát má pevnou délku a pořadí
// číslic odpovídá chronologickému pořadí.
export function getMembershipLabel(startsOn: string, endsOn: string | null): MembershipLabel {
  const today = todayIso();
  if (startsOn > today) return 'pending';
  if (endsOn && endsOn < today) return 'expired';
  return 'active';
}
