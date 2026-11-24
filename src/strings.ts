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

  /** S05 · Concert card (E05a–b) */
  concert: {
    stage: (stageNumber: number, stageName: string) => `S${stageNumber} · Scena ${stageName}`,
    time: (start: string, end: string) => `${start}–${end}`,
    checkIn: "Zamelduj się",
    checkInDone: "Zameldowano",
    tooFar: (meters: number) => `Za daleko · ${meters} m do sceny`,
    checkInPending: "Meldowanie…",
    addToPlan: "Dodaj do planu",
    inPlan: "W planie",
    removeFromPlan: "Usuń z planu",
    back: "Wróć",
    closed: "Meldowanie zamknięte",
    noLocation: "Brak lokalizacji",
    error: "Nie udało się zameldować",
    a11y: {
      card: (artist: string, stageName: string, start: string, end: string) =>
        `${artist}, Scena ${stageName}, ${start} do ${end}`,
      checkInHint: "Wymaga obecności w promieniu 50 metrów od sceny",
      tooFarAnnounce: (meters: number) => `Za daleko od sceny, ${meters} metrów`,
    },
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

  /** S10 · Accessibility settings */
  settings: {
    back: "Ustawienia",
    title: "Dostępność",
    preview: "Podgląd na żywo",
    contrast: {
      section: "Kontrast",
      title: "Wysoki kontrast",
      description: "Czysta czerń i biel, grubsze ramki, bez szarych opisów.",
    },
    colors: {
      section: "Kolory",
      title: "Wzory zamiast koloru",
      description: "Statusy dostają wzór, ramkę i dłuższy opis. Pomaga przy zaburzeniach widzenia barw.",
    },
    textSize: {
      section: "Rozmiar tekstu",
      group: "Rozmiar tekstu",
      /** E11: „A” in three sizes with the percentage under it (joined SegmentedControl). */
      letter: "A",
      standard: "100%",
      large: "150%",
      xlarge: "200%",
      a11y: {
        standard: "100 procent",
        large: "150 procent",
        xlarge: "200 procent",
      },
      description: "Działa razem z rozmiarem czcionki w systemie. Układ przechodzi w jedną kolumnę, nic nie przewija się w bok.",
    },
    motion: {
      section: "Ruch",
      title: "Ogranicz animacje",
      description: "Alert nie pulsuje, tylko ma podwójną ramkę. Ekrany zmieniają się bez przejść. Na start tak jak w systemie.",
    },
    alerts: {
      section: "Alerty „Wyjdź teraz”",
      group: "Alerty „Wyjdź teraz”",
      sound: "Dźwięk i wibracja",
      vibrate: "Tylko wibracja",
      muted: "Wyciszone · widać je tylko w Planie",
    },
    snooze: {
      section: "Odłóż alert o",
      group: "Odłóż alert o",
      option: (minutes: number) => `${minutes} min`,
      a11y: (minutes: number) => `${minutes} ${minutesWord(minutes)}`,
    },
    saveFailed: "Nie zapisano zmiany",
    saveFailedA11y: "Nie zapisano zmiany ustawienia. Przywrócono poprzednią wartość.",
    loadFailed: "Nie wczytano ustawień",
    loadFailedA11y: "Nie wczytano Twoich ustawień. Działają domyślne.",
    a11y: {
      back: "Wróć do ustawień",
      preview: "Podgląd: tak wygląda plan z wybranymi ustawieniami",
    },
  },

  /** S07 · Namiot + 07b prowadzenie (C06, C08, dialog) */
  tent: {
    title: "Namiot",
    /** No-break spaces: the number never stays alone on a line (E07a wraps „Zapisane / miejsca · 3”). */
    count: (n: number) => `Zapisane miejsca · ${n}`,
    otherPlaces: "Inne miejsca",
    savePosition: "Zapisz moją pozycję",
    gpsMeta: (accuracy: string) => `GPS ${accuracy} · działa bez zasięgu`,
    accuracy: (m: number) => `±${m} m`,
    defaultTentLabel: "Namiot",
    defaultPlaceLabel: (n: number) => `Miejsce ${n}`,
    type: {
      tent: "Namiot",
      meeting_point: "Punkt zbiórki",
      parking: "Parking",
      other: "Miejsce",
    },
    /** „Pt 13:20” */
    savedDay: (weekday: string, time: string) => `${weekday} ${time}`,
    savedAt: (when: string) => `Zapisano ${when}`,
    /** C08 pass band: „Twój namiot · zapisano Pt 13:20” */
    passBand: (when: string) => `Twój namiot · zapisano ${when}`,
    guideButton: "Prowadź",
    meters: (m: number) => `${m} m`,
    kilometers: (km: string) => `${km} km`,
    walk: (minutes: number) => `${minutes} min`,
    distanceWalk: (distance: string, walk: string) => `${distance} · ${walk}`,
    noDistance: "–",
    locating: "Szukam pozycji…",
    saving: "Zapisuję…",
    menu: {
      title: (label: string) => label,
      rename: "Zmień nazwę",
      delete: "Usuń",
      cancel: "Anuluj",
      nameLabel: "Nazwa miejsca",
      save: "Zapisz",
    },
    confirm: {
      title: (label: string) => `Usunąć ${label}?`,
      body: "Bez zasięgu nie da się go odtworzyć. Kompas przestanie do niego prowadzić.",
      keep: "Zostaw",
      delete: "Usuń",
    },
    empty: {
      title: "Nie masz zapisanych miejsc",
      body: "Stań przy namiocie i naciśnij „Zapisz moją pozycję”. Kompas zaprowadzi Cię z powrotem, także bez zasięgu.",
    },
    noLocation: {
      eyebrow: "Brak sygnału GPS",
      title: "Nie widzę twojej pozycji",
      body: "Wyjdź spod dachu i spróbuj ponownie. Zapisane miejsca zostają.",
      bodyPermission: "Aplikacja nie ma dostępu do lokalizacji. Włącz go w ustawieniach telefonu.",
      retry: "Spróbuj ponownie",
      openSettings: "Otwórz ustawienia",
    },
    note: {
      saveFailed: "Nie zapisano miejsca",
      removeFailed: "Nie usunięto miejsca",
      renameFailed: "Nie zmieniono nazwy",
      invalidLabel: "Nazwa: od 1 do 40 znaków",
      loadFailed: "Nie wczytano miejsc",
      saveFailedA11y: "Nie zapisano miejsca. Spróbuj jeszcze raz.",
      removeFailedA11y: "Nie usunięto miejsca. Wróciło na listę.",
      renameFailedA11y: "Nie zmieniono nazwy miejsca. Przywrócono poprzednią.",
      invalidLabelA11y: "Nazwa miejsca musi mieć od 1 do 40 znaków.",
      loadFailedA11y: "Nie wczytano zapisanych miejsc.",
      noLocationA11y: "Nie widzę twojej pozycji. Miejsce nie zostało zapisane.",
    },
    guide: {
      back: "Miejsca",
      eyebrow: "Prowadzenie do",
      /** E07b: the tent is titled „Twój namiot”, its name goes to the line under the distance. */
      tentTitle: "Twój namiot",
      showOnMap: "Pokaż na mapie",
      holdFlat: "Trzymaj telefon płasko · kompas OK",
      notFoundEyebrow: "Prowadzenie",
      notFoundTitle: "Nie ma takiego miejsca",
      notFoundBody: "Miejsce zostało usunięte. Wróć do listy i wybierz inne.",
    },
    /** C06 · CompassArrow – texts inside and under the ring. */
    compass: {
      north: "N",
      near: (distance: string) => `Blisko · ${distance}`,
      nearBody: "Poniżej 20 m strzałka znika, rozglądaj się",
      calibrating: "Kalibracja",
      calibratingBody: "Zakreśl telefonem ósemkę w powietrzu",
      noHeading: "Brak kompasu",
      noHeadingBody: "Kierunek pokażemy na mapie",
      meta: (description: string, accuracy: string) => `${description} · ${accuracy}`,
    },
    a11y: {
      metersSpoken: (m: number) => `${m} ${plural(m, "metr", "metry", "metrów")}`,
      kilometersSpoken: (km: string) => `${km} kilometra`,
      minutesSpoken: (minutes: number) => `${minutes} ${minutesWord(minutes)}`,
      walkSpoken: (minutes: number) => `około ${minutes} ${minutesWord(minutes)} pieszo`,
      /** „Namiot, Punkt zbiórki, 240 metrów, około 3 minuty pieszo” */
      row: (label: string, type: string, distance: string | null) =>
        label + (type ? `, ${type}` : "") + (distance === null ? "" : `, ${distance}`),
      /** C08: „Twój namiot, Pole C, rząd 4. Zielony namiot… 240 metrów, 3 minuty.” (no description yet) */
      pass: (label: string, description: string, distance: string | null) =>
        `Twój namiot, ${label}.` + (description ? ` ${description}.` : "") + (distance === null ? "" : ` ${distance}.`),
      /** Row: „…, zapisuję”; pass (ends with a sentence): „… Zapisuję.” */
      withSaving: (label: string, sentence: boolean) => (sentence ? `${label} Zapisuję.` : `${label}, zapisuję`),
      rowHint: "Otwiera prowadzenie kompasem",
      more: (label: string) => `Więcej: ${label}`,
      moreHint: "Zmiana nazwy albo usunięcie",
      deleteAction: "Usuń",
      renameAction: "Zmień nazwę",
      saveHint: "Zapisuje miejsce, w którym stoisz. Działa bez zasięgu.",
      guideHint: "Otwiera prowadzenie kompasem",
      /** C06 */
      straight: "prosto",
      turn: (side: "right" | "left", degrees: number) =>
        `skręć w ${side === "right" ? "prawo" : "lewo"} o ${degrees} ${plural(degrees, "stopień", "stopnie", "stopni")}`,
      compassGuiding: (label: string, distance: string, direction: string) => `${label}: ${distance}, ${direction}`,
      compassNear: (distance: string) => `Jesteś blisko, ${distance}. Rozglądaj się.`,
      compassCalibrating: "Kalibracja kompasu. Zakreśl telefonem ósemkę.",
      compassNoHeading: (target: string | null) =>
        "Brak kompasu. Kierunek pokażemy na mapie." + (target === null ? "" : ` ${target}.`),
      compassTarget: (label: string, distance: string) => `${label}: ${distance}`,
      back: "Wróć do listy miejsc",
      mapHint: "Otwiera mapę festiwalu",
    },
  },

  /** S01 · Logowanie / Rejestracja */
  auth: {
    wordmark: "Backstage",
    pass: {
      band: "All access",
      dates: "2–4.07.2027",
      name: "Stocznia Sound 2027",
      place: "Gdańsk · Tereny Stoczni",
      serial: "Nº ———",
      a11y: "Przepustka: Stocznia Sound 2027, 2–4 lipca 2027, Gdańsk, Tereny Stoczni",
    },
    modeGroup: "Logowanie albo rejestracja",
    loginTab: "Logowanie",
    registerTab: "Rejestracja",
    loginTabA11y: "Logowanie, karta 1 z 2",
    registerTabA11y: "Rejestracja, karta 2 z 2",
    loginLabel: "Login",
    loginLabelRegister: "Login · widzi go twoja ekipa",
    passwordLabel: "Hasło",
    repeatLabel: "Powtórz hasło",
    checkMinLength: "min. 8 znaków",
    checkDigit: "cyfra",
    submitLogin: "Zaloguj",
    submitRegister: "Załóż konto",
    submitting: "Sprawdzam dane…",
    forgotPassword: "Nie pamiętasz hasła?",
    hintLogin: "Logowanie wymaga zasięgu. Potem plan, mapa i odjazdy działają bez sieci.",
    hintRegister: "Po założeniu konta pobierzesz dane wydarzenia, póki masz zasięg.",
    error: {
      loginEmpty: "Wpisz login.",
      passwordEmpty: "Wpisz hasło.",
      passwordsDiffer: "Hasła się różnią",
      invalidCredentials: "Login albo hasło się nie zgadzają. Sprawdź oba pola i spróbuj ponownie.",
      loginTaken: "Ten login jest zajęty. Wybierz inny.",
      unknown: "Nie udało się. Spróbuj ponownie.",
    },
    a11y: {
      showPassword: "Pokaż hasło",
      hidePassword: "Ukryj hasło",
      /** „Hasło, hasło ukryte” – TalkBack adds „pole edycji” itself. */
      passwordHidden: (label: string) => `${label}, hasło ukryte`,
      withError: (label: string, error: string) => `${label}. Błąd: ${error}`,
      check: (label: string, met: boolean) => `${label}: ${met ? "spełnione" : "niespełnione"}`,
      /** Password field after a failed register attempt: „Brakuje: min. 8 znaków, cyfra”. */
      missing: (labels: readonly string[]) => `Brakuje: ${labels.join(", ")}`,
      forgotHint: "Otwiera stronę resetu hasła",
    },
  },
} as const;
