/* ============================================================
   tothdavid.eu / benford / i18n.js
   English and Hungarian copy for the Benford page.
   ============================================================ */

(() => {
  "use strict";

  const plural = (n, one, many) => (n === 1 ? one : many);

  const en = {
    docTitle: "Benford check · Dávid Tóth",
    home: "Dávid Tóth",
    title: "Benford check",
    lede: "In most real-world data, about 30% of numbers start with a&nbsp;1 and fewer than 5% start with a&nbsp;9. Invented numbers usually don't. Give this some data and it'll tell you how well it fits.",

    inputH: "Your numbers",
    inputMethod: "Input method",
    tabPaste: "Type / paste",
    tabFile: "Upload file",
    numbersLabel: "Numbers",
    placeholder: "Paste anything with numbers in it: a column from a spreadsheet, a list, a bank statement, a CSV…\n\n1,204.50\n38710\n2,114,093\n0.0071\n…",
    sampleBefore: "Or try a sample of",
    sampleAfter: "numbers:",
    sampleSize: "Sample size",
    sInvoices: "Invoice amounts",
    sFib: "Fibonacci",
    sMessy: "Messy real data",
    sInvented: "Invented numbers",
    sLimit: "Just under a limit",
    sClass: "Our class (made-up numbers)",
    classFail: "Couldn't load the class numbers. Try again in a little while.",
    sClear: "Clear",
    dropBig: "Drop a file here",
    dropSmall: "or click to choose · CSV, TSV, TXT, JSON, XLSX, ODS",
    dropNote: "Read in your browser. Nothing is uploaded anywhere.",
    colsLegend: "Columns to include",
    colsNote: "IDs, dates, years and codes aren't Benford data, so they start switched off.",
    column: ({ l }) => `Column ${l}`,
    optsLegend: "Reading and filters",
    fmtLabel: "Number format",
    fmtAuto: "Detect automatically",
    fmtDot: "1,234.56 (decimal point)",
    fmtComma: "1 234,56 or 1.234,56 (decimal comma)",
    minLabel: "Minimum value",
    minNone: "none",
    signLabel: "Include",
    signAll: "All numbers",
    signPos: "Positive only",
    signNeg: "Negative only",
    uniqueLabel: "Count each distinct value once",

    parsedRead: ({ n, count, fmt }) => `${n} ${plural(count, "number", "numbers")} read as ${fmt}`,
    parsedNoCols: "No columns selected",
    parsedZeros: ({ n, count }) => `${n} ${plural(count, "zero", "zeros")} skipped`,
    parsedSmall: ({ n, min }) => `${n} under ${min} left out`,
    parsedNeg: ({ n }) => `${n} negative left out`,
    parsedPos: ({ n }) => `${n} positive left out`,
    parsedDups: ({ n, count }) => `${n} ${plural(count, "repeat", "repeats")} merged`,

    fileReading: ({ name }) => `Reading ${name}…`,
    fileTooBig: ({ name, mb }) => `${name} is ${mb} MB. The limit is 50 MB.`,
    fileNone: ({ name }) => `Couldn't find any numbers in ${name}.`,
    fileCols: ({ name, n, c }) => `${name}: ${n} values in ${c} numeric ${plural(c, "column", "columns")}.`,
    fileFree: ({ name, n }) => `${name}: ${n} values.`,
    fileXlsx: "Couldn't load the spreadsheet reader. Check your connection, or export as CSV.",
    fileFail: "Couldn't read that file.",

    resultsH: "How they fit",
    emptyMain: "Waiting for numbers.",
    emptySub: "Pick a sample on the left to see what a good fit and a clear deviation look like.",
    testsH: "Four tests. Pick one to see its details.",

    t_first: "First digit",
    t_second: "Second digit",
    t_firstTwo: "First two digits",
    t_lastTwo: "Last two digits",
    note_first: "The classic test: how often each number starts with 1, 2, 3 and so on.",
    note_second: "Flatter than the first digit (12% zeros down to 8.5% nines). Useful for spotting amounts nudged up or down.",
    note_firstTwo: "10 to 99. Much finer, so it shows specific amounts that come up unusually often, like values just under an approval limit.",
    note_lastTwo: "Not Benford: endings should be close to even. Spikes at 00 or 50 usually mean rounding or estimates.",
    tip_first: ({ l }) => `Starts with ${l}`,
    tip_second: ({ l }) => `Second digit ${l}`,
    tip_firstTwo: ({ l }) => `Starts with ${l}`,
    tip_lastTwo: ({ l }) => `Ends in ${l}`,
    model_benford: "Benford's law",
    model_even: "Even spread",

    fit_few: "Not enough data for a reliable assessment",
    fit_few_short: "Not enough data",
    fit_good: "Good fit",
    fit_marginal: "Marginal fit",
    fit_deviation: "Significant deviation",
    fit_unclear: "No clear deviation",
    conf_close: "close conformity",
    conf_acceptable: "acceptable conformity",
    conf_marginal: "marginal conformity",
    conf_non: "nonconformity",
    zClose: "close",
    zAcceptable: "acceptable",
    zMarginal: "marginal",
    zNon: "nonconforming",
    caveat: "A deviation means the numbers may be worth a closer look. It doesn't prove fraud or manipulation, and a good fit doesn't prove the data is genuine.",

    // "The first digits differ from Benford's law by 0.39 percentage points per digit on average"
    describe: ({ test, gap, mad, conf, even }) => {
      const subject = { first: "The first digits", second: "The second digits", firstTwo: "The first two digits", lastTwo: "The last two digits" }[test];
      const unit = { first: "digit", second: "digit", firstTwo: "pair", lastTwo: "ending" }[test];
      return `${subject} differ from ${even ? "an even spread" : "Benford's law"} by ${gap} percentage points per ${unit} on average (MAD ${mad}, ${conf} by Nigrini's scale).`;
    },
    chanceBeyond: ({ p }) => ` That gap is larger than chance alone would produce (chi-square p ${p}).`,
    chanceWithin: ({ p }) => ` A gap that size could come from chance alone (chi-square p ${p}).`,
    fewSub: ({ test, min, n }) => {
      const title = { first: "first digit", second: "second digit", firstTwo: "first two digits", lastTwo: "last two digits" }[test];
      const unit = { first: "digit", second: "digit", firstTwo: "pair", lastTwo: "ending" }[test];
      return `The ${title} test needs at least ${min} numbers, so that every ${unit} is expected at least 5 times. You have ${n}. Below are just the plain counts, with no comparison.`;
    },
    tooShort: "None of these numbers have enough digits for this test.",
    tileNeed: ({ n, min }) => `${n} of ${min} needed`,

    warnSkipped: ({ n, one }) => `<b>${n} ${one ? "number had" : "numbers had"} too few digits</b> for this test and ${one ? "was" : "were"} left out.`,
    warnSpikes: ({ list, more, one }) =>
      `<b>Unusual ${one ? "spike" : "spikes"}:</b> ${list}${more ? ` and ${more} more` : ""}. ` +
      `${one ? "This comes" : "These come"} up far more often than chance would explain, even if the overall fit looks fine. ` +
      "Worth checking for a common amount, a price point or a value limit just above.",
    spikeItem: ({ l, got, exp }) => `${l} (${got} vs ${exp} expected)`,
    warnSmall: ({ n }) => `<b>Small sample.</b> With ${n} numbers only large deviations can be told apart from chance.`,
    warnSpan1: "<b>Your values sit within one order of magnitude.</b> Benford's law doesn't apply to data like this (think ages, heights, prices in a narrow range), so a deviation is expected even if the numbers are real.",
    warnSpan2: "<b>Your values span less than two orders of magnitude.</b> Benford fits best when numbers range across several (10s to 10,000s), so read this result loosely.",

    keyObs: "Your data",
    keyBand: "Normal range for this many numbers",
    chartPlain: ({ title }) => `${title} counts in your data`,
    chartCompare: ({ title, model }) => `${title} distribution of your data compared to ${model}`,
    tipYours: "Yours",
    tipBenford: "Benford",
    tipExpected: "Expected",
    tipRange: "Normal range",
    tipDiff: "Difference",
    tipTo: "to",
    pts: "pts",

    stN: "Numbers",
    stR: "Correlation",
    stMad: "Mean abs. deviation",
    stP: "Chi-square p",
    rSame: "near-identical shape",
    rSimilar: "similar shape",
    rLoose: "loosely similar",
    rDiff: "different shape",
    rFlat: "expected curve is flat",
    pWithin: "within chance",
    pBeyond: "beyond chance",

    tableCaption: "Digit counts for the selected test",
    thDigit: "Digit",
    thDigits: "Digits",
    thCount: "Count",
    thYours: "Yours",
    thBenford: "Benford",
    thExpected: "Expected",
    thDiff: "Diff (pts)",
    noteTop: ({ k }) => `The 12 biggest deviations, largest first. Download the CSV for all ${k}.`,
    noteCommon: "The most common values in your data.",

    dlPng: "Download chart (PNG)",
    pngSource: "Data",
    pngPasted: "pasted numbers",
    pngFail: "Couldn't create the image",
    dlCsv: "Download CSV",
    copySum: "Copy summary",
    copied: "Copied",
    copyFail: "Couldn't reach the clipboard",
    sumHead: ({ n }) => `Benford check (tothdavid.eu/benford), ${n} numbers`,
    sumFew: ({ title, n, min }) => `${title}: not enough data for a reliable assessment (${n} of ${min} needed).`,
    sumFoot: "A deviation is a reason to look closer, not proof of fraud. A good fit doesn't prove the data is genuine.",

    imported: ({ n }) => `Loaded ${n} numbers from the collection page.`,

    aboutSummary: "How this works",
    aboutBody: `
      <p>
        Every non-zero number's first significant digit is counted (0.0071 counts as a 7). Benford's law says digit
        <i>d</i> should lead with probability log<sub>10</sub>(1 + 1/<i>d</i>).
      </p>
      <p>
        The <b>second digit</b> and <b>first two digits</b> tests follow from the same law and are the next steps in a forensic audit:
        the first-two test in particular picks out single amounts that were used too often.
        The <b>last two digits</b> test isn't Benford at all. For numbers with three or more digits the endings should be spread evenly,
        so a pile-up on 00, 50 or 99 usually means rounding, estimates or invention.
      </p>
      <p>
        <b>The result</b> combines two checks. <b>MAD</b> (mean absolute deviation) is the average gap per digit, judged on
        Nigrini's scale (for the first digit: under 0.006 close, 0.012 acceptable, 0.015 marginal, above that nonconforming).
        <b>Chi-square</b> asks whether the gaps are bigger than chance alone would produce. A <b>significant deviation</b> needs both:
        a gap beyond chance (p &lt; 0.05) that is also large on Nigrini's scale. With thousands of rows the chi-square test flags even harmless
        wobbles, and with a few hundred MAD is noisy, so each check covers the other's weak spot. <b>Correlation</b> is Pearson's r between
        your digit shares and the expected ones, for a quick sense of shape.
      </p>
      <p>
        <b>Minimum sample.</b> A test only gives a result once every digit is expected at least 5 times, the usual requirement for the chi-square test:
        110 numbers for the first digit, 59 for the second, 1,146 for the first two and 500 for the last two. Below that the page shows plain counts only.
      </p>
      <p>
        <b>What it can't tell you.</b> A deviation from Benford's law doesn't prove fraud or corruption. It shows that a set of numbers may be worth
        a closer look. Real data deviates for innocent reasons: price points, fee schedules, value limits, rounding, or a mix of different kinds of spending.
        Benford only applies to data that spans several orders of magnitude and isn't capped or assigned: invoice totals, populations, river lengths.
        Ages, phone numbers and lottery draws won't fit and aren't meant to. A good fit doesn't prove the data is genuine either.
      </p>`,
    foot: "© 2026 · runs entirely in your browser",
  };

  const hu = {
    docTitle: "Benford-ellenőrző · Tóth Dávid",
    home: "Tóth Dávid",
    title: "Benford-ellenőrző",
    lede: "A legtöbb valós adatsorban a számok nagyjából 30%-a 1-essel kezdődik, és 5%-nál kevesebb 9-essel. A kitalált számok általában nem így viselkednek. Adj meg néhány adatot, és az oldal megmutatja, mennyire illeszkednek.",

    inputH: "A számaid",
    inputMethod: "Bevitel módja",
    tabPaste: "Beírás / beillesztés",
    tabFile: "Fájl feltöltése",
    numbersLabel: "Számok",
    placeholder: "Illessz be bármit, amiben számok vannak: egy táblázatoszlopot, listát, bankszámlakivonatot, CSV-t…\n\n1 204,50\n38710\n2 114 093\n0,0071\n…",
    sampleBefore: "Vagy próbálj ki egy",
    sampleAfter: "számból álló mintát:",
    sampleSize: "Minta mérete",
    sInvoices: "Számlaösszegek",
    sFib: "Fibonacci",
    sMessy: "Vegyes valós adatok",
    sInvented: "Kitalált számok",
    sLimit: "Épp egy határ alatt",
    sClass: "Az osztályunk (kitalált számok)",
    classFail: "Nem sikerült betölteni az osztály számait. Próbáld újra egy kicsit később.",
    sClear: "Törlés",
    dropBig: "Húzz ide egy fájlt",
    dropSmall: "vagy kattints a kiválasztáshoz · CSV, TSV, TXT, JSON, XLSX, ODS",
    dropNote: "A böngésződ olvassa be, semmi nem kerül feltöltésre.",
    colsLegend: "Figyelembe vett oszlopok",
    colsNote: "Az azonosítók, dátumok, évszámok és kódok nem Benford-adatok, ezért alapból ki vannak kapcsolva.",
    column: ({ l }) => `${l} oszlop`,
    optsLegend: "Beolvasás és szűrés",
    fmtLabel: "Számformátum",
    fmtAuto: "Automatikus felismerés",
    fmtDot: "1,234.56 (tizedespont)",
    fmtComma: "1 234,56 vagy 1.234,56 (tizedesvessző)",
    minLabel: "Legkisebb érték",
    minNone: "nincs",
    signLabel: "Előjel",
    signAll: "Minden szám",
    signPos: "Csak pozitív",
    signNeg: "Csak negatív",
    uniqueLabel: "Az ismétlődő értékek csak egyszer számítanak",

    parsedRead: ({ n, fmt }) => `${n} szám beolvasva (${fmt} formátum)`,
    parsedNoCols: "Nincs kiválasztott oszlop",
    parsedZeros: ({ n }) => `${n} nulla kihagyva`,
    parsedSmall: ({ n, min }) => `${n} db ${min} alatti érték kihagyva`,
    parsedNeg: ({ n }) => `${n} negatív kihagyva`,
    parsedPos: ({ n }) => `${n} pozitív kihagyva`,
    parsedDups: ({ n }) => `${n} ismétlődés összevonva`,

    fileReading: ({ name }) => `${name} beolvasása…`,
    fileTooBig: ({ name, mb }) => `${name} mérete ${mb} MB. A határ 50 MB.`,
    fileNone: ({ name }) => `Nem találtunk számokat ebben: ${name}.`,
    fileCols: ({ name, n, c }) => `${name}: ${n} érték, ${c} számoszlopban.`,
    fileFree: ({ name, n }) => `${name}: ${n} érték.`,
    fileXlsx: "Nem sikerült betölteni a táblázatolvasót. Ellenőrizd a kapcsolatot, vagy mentsd a fájlt CSV-be.",
    fileFail: "Nem sikerült beolvasni a fájlt.",

    resultsH: "Illeszkedés",
    emptyMain: "Várom a számokat.",
    emptySub: "Válassz egy mintát a bal oldalon, hogy lásd, milyen a jó illeszkedés és a jelentős eltérés.",
    testsH: "Négy teszt. Válassz egyet a részletekért.",

    t_first: "Első számjegy",
    t_second: "Második számjegy",
    t_firstTwo: "Első két számjegy",
    t_lastTwo: "Utolsó két számjegy",
    note_first: "A klasszikus teszt: milyen gyakran kezdődnek a számok 1-essel, 2-essel, 3-assal és így tovább.",
    note_second: "Laposabb, mint az első számjegyé (12% nulla, 8,5% kilences). Jól jelzi a felfelé vagy lefelé igazított összegeket.",
    note_firstTwo: "10-től 99-ig. Sokkal finomabb, ezért megmutatja a szokatlanul gyakori összegeket, például egy jóváhagyási határ alatti értékeket.",
    note_lastTwo: "Ez nem Benford-teszt: a végződéseknek nagyjából egyenletesen kell eloszlaniuk. A 00-ra vagy 50-re végződők túlsúlya általában kerekítésre vagy becslésre utal.",
    tip_first: ({ l }) => `Kezdet: ${l}`,
    tip_second: ({ l }) => `Második számjegy: ${l}`,
    tip_firstTwo: ({ l }) => `Kezdet: ${l}`,
    tip_lastTwo: ({ l }) => `Végződés: ${l}`,
    model_benford: "Benford-törvény",
    model_even: "Egyenletes eloszlás",

    fit_few: "Nincs elegendő adat a megbízható értékeléshez",
    fit_few_short: "Kevés adat",
    fit_good: "Jó illeszkedés",
    fit_marginal: "Határeset",
    fit_deviation: "Jelentős eltérés",
    fit_unclear: "Nincs egyértelmű eltérés",
    conf_close: "szoros illeszkedés",
    conf_acceptable: "elfogadható illeszkedés",
    conf_marginal: "határeset",
    conf_non: "nem illeszkedik",
    zClose: "szoros",
    zAcceptable: "elfogadható",
    zMarginal: "határeset",
    zNon: "nem illeszkedik",
    caveat: "Az eltérés azt jelenti, hogy a számokat érdemes lehet alaposabban megvizsgálni. Nem bizonyít csalást vagy manipulációt, és a jó illeszkedés sem bizonyítja, hogy az adatok valódiak.",

    // "Az első számjegyek számjegyenként átlagosan 0,39 százalékponttal térnek el a Benford-törvénytől"
    describe: ({ test, gap, mad, conf, even }) => {
      const subject = { first: "Az első számjegyek", second: "A második számjegyek", firstTwo: "Az első két számjegyből álló párok", lastTwo: "A végződések (utolsó két számjegy)" }[test];
      const unit = { first: "számjegyenként", second: "számjegyenként", firstTwo: "páronként", lastTwo: "végződésenként" }[test];
      return `${subject} ${unit} átlagosan ${gap} százalékponttal térnek el ${even ? "az egyenletes eloszlástól" : "a Benford-törvénytől"} (MAD ${mad}, Nigrini skáláján ${conf}).`;
    },
    chanceBeyond: ({ p }) => ` Ez az eltérés nagyobb, mint ami pusztán a véletlenből adódna (khi-négyzet p ${p}).`,
    chanceWithin: ({ p }) => ` Ekkora eltérés pusztán a véletlenből is adódhat (khi-négyzet p ${p}).`,
    fewSub: ({ test, min, n }) => {
      const title = { first: "Az első számjegy", second: "A második számjegy", firstTwo: "Az első két számjegy", lastTwo: "Az utolsó két számjegy" }[test];
      const unit = { first: "számjegy", second: "számjegy", firstTwo: "pár", lastTwo: "végződés" }[test];
      return `${title} tesztjéhez legalább ${min} szám kell, hogy minden ${unit} várhatóan legalább ötször előforduljon. Neked ${n} van. Lent csak az egyszerű gyakoriságok láthatók, összehasonlítás nélkül.`;
    },
    tooShort: "Egyik számban sincs elég számjegy ehhez a teszthez.",
    tileNeed: ({ n, min }) => `${n} / ${min} szükséges`,

    warnSkipped: ({ n }) => `<b>${n} számban túl kevés a számjegy</b> ehhez a teszthez, ezeket kihagytuk.`,
    warnSpikes: ({ list, more, one }) =>
      `<b>${one ? "Szokatlan kiugrás" : "Szokatlan kiugrások"}:</b> ${list}${more ? ` és még ${more}` : ""}. ` +
      `${one ? "Ez sokkal gyakrabban fordul" : "Ezek sokkal gyakrabban fordulnak"} elő, mint ami a véletlenből adódna, még ha az összkép jónak tűnik is. ` +
      "Érdemes megnézni, nincs-e mögötte egy gyakori összeg, árpont, vagy közvetlenül fölötte egy értékhatár.",
    spikeItem: ({ l, got, exp }) => `${l} (${got} a várt ${exp} helyett)`,
    warnSmall: ({ n }) => `<b>Kis minta.</b> ${n} számnál csak a nagy eltérések különíthetők el a véletlentől.`,
    warnSpan1: "<b>Az értékeid egyetlen nagyságrenden belül vannak.</b> Az ilyen adatokra (például életkor, testmagasság, szűk sávban mozgó árak) a Benford-törvény nem érvényes, így eltérés akkor is várható, ha a számok valódiak.",
    warnSpan2: "<b>Az értékeid kevesebb mint két nagyságrendet fognak át.</b> A Benford-törvény akkor illik legjobban, ha a számok több nagyságrendet fognak át (tízesektől tízezresekig), ezért ezt az eredményt óvatosan értelmezd.",

    keyObs: "A te adataid",
    keyBand: "Normál sáv ennyi számnál",
    chartPlain: ({ title }) => `${title}: gyakoriságok az adataidban`,
    chartCompare: ({ title, model }) => `${title}: az adataid eloszlása összevetve ezzel: ${model}`,
    tipYours: "Tiéd",
    tipBenford: "Benford",
    tipExpected: "Várt",
    tipRange: "Normál sáv",
    tipDiff: "Eltérés",
    tipTo: "–",
    pts: "%-pont",

    stN: "Számok",
    stR: "Korreláció",
    stMad: "Átlagos abszolút eltérés",
    stP: "Khi-négyzet p",
    rSame: "szinte azonos alak",
    rSimilar: "hasonló alak",
    rLoose: "lazán hasonló",
    rDiff: "eltérő alak",
    rFlat: "a várt görbe egyenletes",
    pWithin: "a véletlen határain belül",
    pBeyond: "a véletlennél nagyobb",

    tableCaption: "A kiválasztott teszt számjegy-gyakoriságai",
    thDigit: "Számjegy",
    thDigits: "Számjegyek",
    thCount: "Darab",
    thYours: "Tiéd",
    thBenford: "Benford",
    thExpected: "Várt",
    thDiff: "Eltérés (%-pont)",
    noteTop: ({ k }) => `A 12 legnagyobb eltérés, csökkenő sorrendben. Mind a ${k} értékhez töltsd le a CSV-t.`,
    noteCommon: "A leggyakoribb értékek az adataidban.",

    dlPng: "Grafikon letöltése (PNG)",
    pngSource: "Adatok",
    pngPasted: "beillesztett számok",
    pngFail: "Nem sikerült elkészíteni a képet",
    dlCsv: "CSV letöltése",
    copySum: "Összefoglaló másolása",
    copied: "Kimásolva",
    copyFail: "Nem sikerült a vágólapra másolni",
    sumHead: ({ n }) => `Benford-ellenőrzés (tothdavid.eu/benford), ${n} szám`,
    sumFew: ({ title, n, min }) => `${title}: nincs elegendő adat a megbízható értékeléshez (${n} / ${min} szükséges).`,
    sumFoot: "Az eltérés ok a további vizsgálatra, nem bizonyíték a csalásra. A jó illeszkedés sem bizonyítja, hogy az adatok valódiak.",

    imported: ({ n }) => `${n} szám betöltve a gyűjtőoldalról.`,

    aboutSummary: "Hogyan működik?",
    aboutBody: `
      <p>
        Minden nem nulla szám első értékes számjegyét számoljuk (a 0,0071 7-esnek számít). A Benford-törvény szerint a
        <i>d</i> számjeggyel kezdődő számok aránya log<sub>10</sub>(1 + 1/<i>d</i>).
      </p>
      <p>
        A <b>második számjegy</b> és az <b>első két számjegy</b> tesztje ugyanebből a törvényből következik, és a könyvvizsgálati elemzés következő lépései:
        különösen az első két számjegy tesztje mutatja meg a túl gyakran használt összegeket.
        Az <b>utolsó két számjegy</b> tesztje egyáltalán nem Benford-teszt. Legalább háromjegyű számoknál a végződéseknek egyenletesen kell eloszlaniuk,
        így a 00-ra, 50-re vagy 99-re végződők túlsúlya általában kerekítésre, becslésre vagy kitalált számokra utal.
      </p>
      <p>
        <b>Az eredmény</b> két ellenőrzést kombinál. A <b>MAD</b> (átlagos abszolút eltérés) a számjegyenkénti átlagos különbség, Nigrini skáláján értékelve
        (az első számjegynél: 0,006 alatt szoros, 0,012-ig elfogadható, 0,015-ig határeset, afölött nem illeszkedik).
        A <b>khi-négyzet próba</b> azt vizsgálja, hogy az eltérések nagyobbak-e, mint ami pusztán a véletlenből adódna. <b>Jelentős eltérés</b> csak akkor van, ha mindkettő teljesül:
        az eltérés meghaladja a véletlent (p &lt; 0,05), és Nigrini skáláján is nagy. Több ezer sornál a khi-négyzet próba az ártalmatlan ingadozást is jelzi,
        néhány száz sornál viszont a MAD bizonytalan, így a két ellenőrzés kiegészíti egymást. A <b>korreláció</b> a számjegyarányaid és a várt arányok Pearson-féle r értéke,
        az alak gyors összevetéséhez.
      </p>
      <p>
        <b>Legkisebb minta.</b> Egy teszt csak akkor ad eredményt, ha minden számjegy várhatóan legalább ötször előfordul; ez a khi-négyzet próba szokásos feltétele:
        az első számjegyhez 110, a másodikhoz 59, az első kettőhöz 1146, az utolsó kettőhöz 500 szám kell. Ez alatt az oldal csak az egyszerű gyakoriságokat mutatja.
      </p>
      <p>
        <b>Mit nem mondhat meg?</b> A Benford-törvénytől való eltérés nem bizonyít számlahamisítást vagy korrupciót. Azt mutatja meg, hogy egy számsort érdemes lehet
        tovább vizsgálni. A valós adatok ártatlan okokból is eltérhetnek: árpontok, díjtételek, értékhatárok, kerekítés, vagy különféle kiadások keveredése miatt.
        A Benford-törvény csak olyan adatokra érvényes, amelyek több nagyságrendet fognak át, és nincsenek felülről korlátozva vagy kiosztva: számlaösszegek,
        népességszámok, folyók hossza. Életkorok, telefonszámok vagy lottószámok nem illeszkednek, és nem is kell illeszkedniük. A jó illeszkedés sem bizonyítja,
        hogy az adatok valódiak.
      </p>`,
    foot: "© 2026 · teljes egészében a böngésződben fut",
  };

  window.I18N.define({ en, hu });
})();
