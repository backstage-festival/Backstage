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

  /** TEMP: labels used only by placeholder screens until the screen tasks. */
  placeholder: {
    prepare: "Przygotuj się",
    downloadMap: "Pobierz mapę",
    downloadMapDisabled: "Brak zasięgu – pobierzesz, gdy wróci sieć.",
    variant200: "Tekst 200 %",
    variantPatterns: "Wzory zamiast koloru",
    variantHighContrast: "Wysoki kontrast",
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

  /** X-Stan · shared loading state */
  screen: {
    loading: "Wczytuję dane z telefonu…",
  },

  /** S04 · Plan screen */
  planScreen: {
    title: "Plan",
    /** Mon–Sun short names, index = Date.getUTCDay(). */
    weekdays: ["Nd", "Pn", "Wt", "Śr", "Czw", "Pt", "Sob"],
    /** „Pt 2.07” */
    day: (weekday: string, day: number, month: string) => `${weekday} ${day}.${month}`,
    /** „Pt 2.07 · 20:03” */
    eyebrow: (day: string, time: string) => `${day} · ${time}`,
    now: (time: string) => `Teraz · ${time}`,
    next: "Dalej",
    played: (n: number) => `Zagrane · ${n}`,
    alsoNow: (artist: string, stageNumber: number) => `${artist} · S${stageNumber}`,
    dayGroup: "Dzień festiwalu",
    scopeGroup: "Zakres",
    scopeAll: "Wszystko",
    scopeMine: "Mój plan",
    stageGroup: "Sceny",
    noStageConcerts: "Nic nie gra na tej scenie tego dnia",
    prepare: "Przygotuj się",
    badges: "Odznaki",
    accessibility: "Dostępność",
    login: "Logowanie",
    empty: {
      noPlanEyebrow: (day: string) => `Mój plan · ${day}`,
      noPlanTitle: "Twój plan jest pusty",
      noPlanBody: "Dodaj koncerty przyciskiem obok nazwy. Gdy coś będzie w planie, powiemy Ci, kiedy wyjść spod innej sceny.",
      showAll: (n: number) => `Pokaż wszystkie koncerty · ${n}`,
      noLineupEyebrow: "Brak danych",
      noLineupTitle: "Brak line-upu w telefonie",
      noLineupBody: "Line-up dla tego festiwalu nie został pobrany. Pobierz go, póki masz zasięg.",
    },
    note: {
      /** TalkBack for the short card line „Kolizja · S2 od 02:00”. */
      conflictA11y: (artist: string, stageNumber: number, stageName: string, time: string) =>
        `Kolizja z ${artist}, scena ${stageNumber}${stageName ? ` ${stageName}` : ""}, od ${time}`,
      addAnyway: "Dodaj mimo to",
      /** Short tag texts – one line at 100 % even on a 320 dp screen. */
      saveFailed: "Nie zapisano zmiany",
      removeFailed: "Nie usunięto z planu",
      concertNotFound: "Brak koncertu w line-upie",
      loadFailed: "Nie wczytano planu",
      saveFailedA11y: "Nie zapisano zmiany w planie. Spróbuj jeszcze raz.",
      removeFailedA11y: "Nie usunięto koncertu z planu. Spróbuj jeszcze raz.",
      concertNotFoundA11y: "Nie ma tego koncertu w line-upie.",
      loadFailedA11y: "Nie wczytano Twojego planu.",
      dismiss: "Zamknij komunikat",
    },
    a11y: {
      stage: (stageNumber: number, stageName: string) => `Scena ${stageNumber}, ${stageName}`,
      playedHint: "Pokazuje zagrane koncerty",
      playedHideHint: "Chowa zagrane koncerty",
      addAnywayHint: "Dodaje koncert mimo kolizji z innym z planu",
    },
  },

  /** C02 · LeaveNowAlert */
  leaveNow: {
    /** „Za 12 min · Scena Główna” */
    eyebrow: (minutes: number, stageName: string) => `Za ${minutes} min · Scena ${stageName}`,
    title: "Wyjdź teraz",
    /** „Wilga i Fale · 20:15 · 450 m” */
    meta: (artist: string, time: string, distanceM: number) => `${artist} · ${time} · ${distanceM} m`,
    guide: "Prowadź",
    snooze: (minutes: number) => `Za ${minutes} min`,
    snoozeLong: (minutes: number) => `Przypomnij za ${minutes} min`,
    mute: "Wycisz",
    vibrationOnly: "Tylko wibracja",
    muted: "Alerty wyciszone · widać je w planie",
    a11y: {
      /** „Wyjdź teraz. Wilga i Fale na scenie Główna za 12 minut. 450 metrów stąd.” */
      announce: (artist: string, stageName: string, minutes: number, distanceM: number) =>
        `Wyjdź teraz. ${artist} na scenie ${stageName} za ${minutes} ${minutesWord(minutes)}. ` +
        `${distanceM} ${plural(distanceM, "metr", "metry", "metrów")} stąd.`,
      guideHint: "Otwiera prowadzenie do sceny",
      snooze: (minutes: number) => `Przypomnij za ${minutes} ${minutesWord(minutes)}`,
      snoozeHint: "Alert wróci później, jeśli zdążysz",
      snoozeDisabled: "Za mało czasu, żeby odłożyć alert",
      mute: "Wycisz alerty wyjścia",
      muteHint: "Alerty będą widoczne tylko w planie, bez dźwięku i wibracji",
    },
  },

  /** S06 · Crew screen */
  crewScreen: {
    title: "Ekipa",
    codeLabel: "Kod ekipy",
    /** „STK7Q4M” → „STK·7Q4M” */
    code: (code: string) => `${code.slice(0, 3)}·${code.slice(3)}`,
    members: (names: readonly string[]) => [...names, "Ty"].join(" · "),
    onlyYou: "Na razie tylko Ty",
    /** TEMP: no display name yet (#71 Q10) */
    fallbackName: "Ekipa",
    queueTitle: (n: number) => `${n} ${plural(n, "czeka", "czekają", "czeka")} na wysyłkę`,
    queueBody: (n: number) => (n === 1 ? "Wyśle się sama przy zasięgu" : "Wyślą się same przy zasięgu"),
    placeholder: "Napisz do ekipy…",
    empty: {
      title: "Brak wiadomości",
      body: (code: string) =>
        `Wyślij znajomym kod ${code}. Kto go wpisze, dołączy do czatu. Wiadomości napisane bez zasięgu poczekają w kolejce i wyślą się same.`,
      share: "Udostępnij kod",
      errorEyebrow: "Nie wczytano wiadomości",
      errorTitle: "Nie udało się otworzyć czatu",
      errorBody: "Wiadomości nie zostały wczytane z telefonu. Spróbuj jeszcze raz.",
      retry: "Spróbuj ponownie",
    },
    a11y: {
      /** „Kod ekipy: S T K 7 Q 4 M” */
      code: (code: string) => `Kod ekipy: ${code.split("").join(" ")}`,
      share: "Udostępnij kod ekipy",
      queue: (n: number) =>
        `${n} ${plural(n, "czeka", "czekają", "czeka")} na wysyłkę. ${n === 1 ? "Wyśle się sama" : "Wyślą się same"} przy zasięgu.`,
      input: "Wiadomość do ekipy",
      send: "Wyślij",
      sendHint: "Bez zasięgu wiadomość trafi do kolejki",
      sendDisabled: "Napisz wiadomość, żeby ją wysłać",
    },
  },

  /** S08 · Return screen */
  returnScreen: {
    title: "Powrót",
    dataFrom: (time: string) => `Dane z ${time}`,
    dataStale: "Dane nieaktualne",
    alertTitle: (title: string) => `Utrudnienia · ${title}`,
    /** „Ostatnie dane z 21:40 · 2 h 10 min temu” */
    staleTitle: (time: string, age: string) => `Ostatnie dane z ${time} · ${age} temu`,
    staleBody: (time: string) => `Pokazujemy rozkład, nie odjazdy na żywo. Opóźnień i zmian po ${time} nie widać.`,
    age: (hours: number, minutes: number) => (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`),
    empty: {
      noDataEyebrow: "Odjazdy",
      noDataTitle: "Brak rozkładu w telefonie",
      noDataBody: "Odjazdy nie zostały pobrane. Pobierz je w „Przygotuj się”, póki masz zasięg.",
      prepare: "Przygotuj się",
      nothingTitle: "Dziś już nic nie odjeżdża",
      nothingBody: "Pierwsze odjazdy rano. Najbliższy postój taksówek: Brama 1.",
      showGate: "Pokaż bramę 1",
      locationEyebrow: "Brak lokalizacji",
      locationTitle: "Nie wiem, gdzie jesteś",
      locationBody: "Włącz lokalizację, żeby znaleźć najbliższe przystanki.",
      errorEyebrow: "Nie wczytano odjazdów",
      errorTitle: "Nie udało się wczytać odjazdów",
      errorBody: "Spróbuj jeszcze raz. Rozkład pobierzesz też w „Przygotuj się”.",
      retry: "Spróbuj ponownie",
    },
  },
} as const;
