/**
 * Polish UI strings and TalkBack labels (boards C01, C03, C04, C05, C09, C11).
 * Normal casing only – uppercase is done with textTransform (textStyle tokens),
 * so TalkBack reads words, not letters.
 */

/** Polish plural form: 1 → one, 2–4 (not 12–14) → few, everything else → many. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

const minutesWord = (n: number) => plural(n, "minuta", "minuty", "minut");
const messagesWord = (n: number) => plural(n, "wiadomość", "wiadomości", "wiadomości");

export const strings = {
  common: {
    separator: " · ",
    you: "Ty",
  },

  /** StatusTag (C11) – in pattern mode the label starts with a prefix. */
  statusTag: {
    warningPrefix: "Uwaga:",
    errorPrefix: "Błąd:",
  },

  /** Short status words shared by several components. */
  status: {
    queued: "W kolejce",
    sending: "Wysyłanie…",
    sent: "Wysłana",
    stale: "Nieaktualna",
    failed: "Nie wysłano",
    inPlan: "W planie",
    conflict: "Kolizja",
    played: "Zagrane",
    leaveNow: "Wyjdź teraz",
    missed: "Nie zdążysz",
    offline: "Offline",
    online: "Online",
    now: "Teraz",
  },

  /** C01 · PerformanceCard + NowPass */
  plan: {
    stageCode: (stageNumber: number) => `S${stageNumber}`,
    timeRange: (start: string, end: string) => `${start}–${end}`,
    conflictLine: (stageNumber: number, time: string) => `Kolizja · S${stageNumber} od ${time}`,
    addToPlan: "Dodaj do planu",
    inPlan: "W planie",
    played: "Zagrane",
    pass: {
      eyebrow: (stageNumber: number, stageName: string) => `S${stageNumber} · Scena ${stageName} · teraz`,
      remaining: (minutes: number) => `Zostało ${minutes} min`,
      serial: (serial: string) => `Nº ${serial}`,
      alsoNow: (artist: string) => `Też teraz: ${artist}`,
    },
    a11y: {
      /** „Wilga i Fale, Scena 1 Główna, 20:15 do 21:30, w planie” */
      card: (p: {
        artist: string;
        stageNumber: number;
        stageName: string;
        start: string;
        end: string;
        inPlan: boolean;
      }) =>
        `${p.artist}, Scena ${p.stageNumber} ${p.stageName}, ${p.start} do ${p.end}` +
        (p.inPlan ? ", w planie" : ""),
      played: "zagrane",
      cardHint: "Otwiera kartę koncertu",
      add: (artist: string, stageNumber: number, start: string) =>
        `Dodaj do planu: ${artist}, Scena ${stageNumber}, ${start}`,
      addHint: "Dodaje koncert do Twojego planu. Działa bez zasięgu.",
      remove: (artist: string) => `Usuń z planu: ${artist}`,
      removeHint: "Usuwa z planu. Można cofnąć.",
      /** „Teraz gra Bursztyn Trio, Scena Doki. Zostało 37 minut.” */
      nowPass: (artist: string, stageName: string, minutes: number) =>
        `Teraz gra ${artist}, Scena ${stageName}. Zostało ${minutes} ${minutesWord(minutes)}.`,
      nowPassInPlan: "W planie.",
      progress: (percent: number) => `${percent} % koncertu`,
    },
  },

  /** C03 · ConnectionBar */
  connection: {
    online: "Online",
    offline: "Offline",
    dataFrom: (time: string) => `Dane z ${time}`,
    syncedAt: (time: string) => `Zsynchr. ${time}`,
    noData: "Brak pobranych danych",
    queued: (n: number) => `${n} w kolejce`,
    sending: (n: number) => `Wysyłanie ${n} ${messagesWord(n)}`,
    progress: (done: number, total: number) => `${done}/${total}`,
    refreshSelf: "Odświeżę sam",
    a11y: {
      /** „1 wiadomość czeka na wysłanie.” / „3 wiadomości czekają na wysłanie.” */
      queued: (n: number) =>
        `${n} ${messagesWord(n)} ${plural(n, "czeka", "czekają", "czeka")} na wysłanie.`,
      /** „Wysyłanie wiadomości: 1 z 3.” */
      syncing: (done: number, total: number) => `Wysyłanie wiadomości: ${done} z ${total}.`,
    },
  },

  /** C04 · MessageBubble */
  message: {
    status: {
      queued: (time: string) => `W kolejce · ${time}`,
      sending: "Wysyłanie…",
      sent: (time: string) => `Wysłana ${time}`,
      stale: (minutesQueued: number) => `Nieaktualna · ${minutesQueued} min w kolejce`,
      failed: "Nie wysłano",
    },
    cancelSending: "Anuluj wysyłanie",
    sendAnyway: "Wyślij mimo to",
    retry: "Spróbuj ponownie",
    delete: "Usuń",
    a11y: {
      /** „Kuba, 21:02: Jesteśmy pod Doki…” */
      crew: (sender: string, time: string, text: string) => `${sender}, ${time}: ${text}`,
      /** „Ty: Ok, za chwilę będę.” */
      own: (text: string) => `Ty: ${text}`,
      queued: "W kolejce, wyśle się sama.",
      sending: "Wysyłanie.",
      sent: (time: string) => `Wysłana o ${time}.`,
      /** statusLabel already holds „Nieaktualna · 40 min w kolejce”. */
      stale: (statusLabel: string) => `${statusLabel}, nie wyśle się sama.`,
      failed: "Nie wysłano.",
      cancelHint: "Usuwa wiadomość z kolejki. Można cofnąć.",
      sendAnywayHint: "Wysyła wiadomość, mimo że jest stara",
      retryHint: "Wysyła wiadomość jeszcze raz",
      deleteHint: "Usuwa wiadomość",
      announceSent: "Wiadomość wysłana",
      announceFailed: "Nie wysłano wiadomości",
      newMessage: (sender: string) => `Nowa wiadomość od ${sender}`,
    },
  },

  /** C05 · StopCard + DepartureRow */
  transit: {
    byTimetable: "Wg rozkładu",
    leaveNow: "Wyjdź teraz",
    missed: "Nie zdążysz",
    leaveAt: (time: string) => `Wyjdź o ${time}`,
    minutes: (n: number) => `${n} min`,
    approxMinutes: (n: number) => `ok. ${n} min`,
    delay: (n: number) => `Opóźnienie · +${n} min`,
    detour: "Objazd",
    meta: (distanceM: number, walkMin: number) => `${distanceM} m · ${walkMin} min`,
    kind: {
      tram: "Tramwaj",
      bus: "Autobus",
      night: "Nocny",
      skm: "SKM",
    },
    a11y: {
      kind: {
        tram: "Tramwaj",
        bus: "Autobus",
        night: "Autobus nocny",
        skm: "SKM",
      },
      /** First SKM row on a card spells the name out. */
      skmFull: "SKM, Szybka Kolej Miejska",
      /** „Tramwaj 2 w stronę Oliwa, odjazd 21:49” */
      row: (kind: string, line: string, direction: string, time: string) =>
        `${kind} ${line} w stronę ${direction}, odjazd ${time}`,
      leaveNow: "wyjdź teraz",
      missed: "nie zdążysz dojść",
      stale: "według rozkładu, bez danych na żywo",
      /** „Przystanek Plac Solidarności, 300 metrów, 4 minuty pieszo” */
      header: (name: string, meta: string) => `Przystanek ${name}, ${meta}`,
      meta: (distanceM: number, walkMin: number) =>
        `${distanceM} ${plural(distanceM, "metr", "metry", "metrów")}, ${walkMin} ${minutesWord(walkMin)} pieszo`,
      guideHint: "Prowadzi do przystanku",
    },
  },
} as const;
