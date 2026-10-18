import { DISPUTE_WINDOW_DAYS } from "@/lib/constants";
import { OPERATOR } from "@/lib/legal";

/**
 * Legal pages, as data. Drafts: they describe how the product behaves, and
 * must be reviewed by a lawyer before launch (see src/lib/legal.ts).
 */

export type Block = string | { list: string[] };

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: Block[] }[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "termeni",
    title: "Termeni și condiții",
    summary: "Relația dintre client, restaurant și Tenuto, și regulile pe care le acceptă fiecare.",
    sections: [
      {
        heading: "1. Cine suntem",
        body: [
          `Platforma Tenuto este operată de ${OPERATOR.legalName}, CUI ${OPERATOR.taxId}, Nr. Reg. Com. ${OPERATOR.tradeRegisterNo}, cu sediul în ${OPERATOR.address} („Tenuto”, „noi”). Ne puteți scrie la ${OPERATOR.email}.`,
        ],
      },
      {
        heading: "2. Ce face Tenuto",
        body: [
          "Tenuto este un instrument tehnic prin care restaurantele primesc rezervări și se protejează de neprezentări. Contractul pentru serviciile de restaurant se încheie direct între client și restaurant. Tenuto nu vinde mâncare, nu stabilește prețuri și nu garantează calitatea serviciilor restaurantului.",
          "Restaurantele listate își completează singure profilul și datele firmei și răspund de corectitudinea lor.",
        ],
      },
      {
        heading: "3. Rezervarea",
        body: [
          "Nu aveți nevoie de cont sau parolă. Numărul de telefon este identificatorul dumneavoastră. Vă rugăm să folosiți datele dumneavoastră reale: pe baza lor restaurantul vă recunoaște ca client.",
          "Rezervarea este confirmată imediat. Primiți un SMS pe numărul de telefon indicat, cu adresa, ora și linkul spre pagina rezervării, unde se află și codul QR pentru sosire.",
        ],
      },
      {
        heading: "4. Garanția prin card",
        body: [
          "În funcție de regulile restaurantului, vi se poate cere un card ca garanție. Cardul este doar salvat la furnizorul de plăți: nu se blochează și nu se reține nicio sumă la rezervare.",
          "Condițiile — suma, perioada de toleranță, termenul de anulare gratuită — vă sunt afișate integral, în limbaj clar, înainte de a introduce cardul, și trebuie acceptate explicit. Textul exact afișat se salvează împreună cu rezervarea, cu data, ora, adresa IP și browserul folosit, și nu mai poate fi modificat de nimeni.",
          "Detaliile despre când se poate percepe taxa sunt în Politica de neprezentare, parte integrantă din acești termeni.",
        ],
      },
      {
        heading: "5. Confirmarea sosirii",
        body: [
          "La sosire, arătați codul QR de pe pagina rezervării; personalul îl scanează și confirmă sosirea. Puteți spune și numele pe care ați rezervat. Confirmarea anulează definitiv orice taxă de neprezentare pentru acea rezervare.",
          "Fiecare confirmare este înregistrată cu ora și cu cine a făcut-o. Dacă ați fost prezent, dar sosirea nu a fost confirmată și ați fost taxat, contestați taxa din pagina rezervării: banii rămân blocați până la rezolvare.",
        ],
      },
      {
        heading: "6. Obligațiile restaurantelor",
        body: [
          "Restaurantele se obligă să afișeze condiții reale, să onoreze rezervările confirmate și să nu perceapă taxe în afara regulilor acceptate de client. Platforma impune tehnic următoarele:",
          {
            list: [
              "un restaurant nu poate taxa un client printr-o simplă declarație — neprezentarea pornește un termen, nu o plată;",
              "nicio rezervare nu poate fi marcată ca neprezentare înainte de finalul perioadei de toleranță;",
              "o sosire confirmată nu poate fi anulată;",
              "condițiile acceptate de client nu pot fi modificate ulterior.",
            ],
          },
          "Tenuto monitorizează ratele de neprezentare per restaurant și poate investiga sau suspenda conturile cu valori anormale.",
        ],
      },
      {
        heading: "7. Contestații",
        body: [
          `O taxă încasată stă blocată ${DISPUTE_WINDOW_DAYS} zile înainte să ajungă la restaurant. În acest interval o puteți contesta dintr-o singură atingere, din pagina rezervării. Cât timp contestația e deschisă, banii nu ajung la restaurant. Restaurantul poate rambursa oricând; în caz contrar, Tenuto verifică istoricul rezervării și decide. Detalii în Politica de neprezentare.`,
          "Vă păstrați în orice moment dreptul de a contesta tranzacția la banca emitentă.",
        ],
      },
      {
        heading: "8. Răspundere",
        body: [
          "Tenuto depune toate eforturile rezonabile pentru funcționarea continuă a platformei, dar nu răspunde pentru neonorarea rezervării de către restaurant sau pentru calitatea serviciilor acestuia.",
        ],
      },
      {
        heading: "9. Legea aplicabilă și soluționarea litigiilor",
        body: [
          "Acești termeni sunt guvernați de legea română. Consumatorii se pot adresa Autorității Naționale pentru Protecția Consumatorilor (anpc.ro) sau pot folosi platforma europeană de soluționare online a litigiilor (ec.europa.eu/consumers/odr).",
        ],
      },
    ],
  },
  {
    slug: "politica-neprezentare",
    title: "Politica de neprezentare",
    summary: "Exact când, de ce și cât se poate percepe — și cum o eviți.",
    sections: [
      {
        heading: "Pe scurt",
        body: [
          "Nu plătiți nimic ca să rezervați. Dacă ajungeți, nu plătiți nimic prin Tenuto, niciodată. O taxă se poate percepe doar dacă nu vă prezentați sau anulați după termenul de anulare gratuită — și doar suma pe care ați acceptat-o la rezervare.",
        ],
      },
      {
        heading: "Cine lasă card",
        body: [
          "Fiecare restaurant își stabilește regulile. De obicei:",
          {
            list: [
              "clienții fideli (cu mai multe vizite la acel restaurant) rezervă fără card;",
              "clienții noi lasă un card ca garanție, fără să se rețină nimic;",
              "grupurile mari sau clienții care au mai lipsit pot avea o garanție mai mare.",
            ],
          },
          "Ce vi se aplică dumneavoastră vedeți înainte de a introduce orice dată de card.",
        ],
      },
      {
        heading: "Perioada de toleranță",
        body: [
          "Masa este ținută un număr de minute după ora rezervării, stabilit de restaurant și afișat la rezervare (implicit 15 minute). În acest interval rezervarea nu poate fi marcată ca neprezentare, sub nicio formă.",
        ],
      },
      {
        heading: "După toleranță",
        body: [
          "Dacă sosirea nu a fost confirmată până la finalul toleranței, sistemul înregistrează automat neprezentarea, iar masa poate fi dată altor clienți. Nu există altă întârziere acceptată decât toleranța afișată la rezervare.",
          "Taxa devine încasabilă din acel moment. Restaurantul vă poate încă marca drept sosit sau poate ierta taxa, până când o încasează.",
        ],
      },
      {
        heading: "Încasarea",
        body: [
          "Fiecare taxă se încasează cel mult o dată, și doar în suma acceptată la rezervare. Dacă banca refuză temporar plata (de exemplu, fonduri insuficiente), se mai încearcă de cel mult două ori, după 24 și 72 de ore; un refuz definitiv nu se reîncearcă.",
        ],
      },
      {
        heading: "Contestarea unei taxe",
        body: [
          `O taxă încasată nu ajunge imediat la restaurant: stă blocată ${DISPUTE_WINDOW_DAYS} zile. În acest timp o puteți contesta dintr-o singură atingere, din pagina rezervării (linkul primit la confirmare, sau căutând rezervarea după cod și telefon).`,
          {
            list: [
              "cât timp contestația e deschisă, banii rămân blocați și nu ajung la restaurant;",
              "restaurantul poate rambursa integral oricând;",
              "dacă nu o face, Tenuto verifică istoricul rezervării — fiecare pas e înregistrat cu ora și autorul — și decide rambursarea sau menținerea taxei, cu motivarea vizibilă pe pagina rezervării;",
              "restaurantele cu o rată neobișnuit de mare de contestații sunt verificate și pot fi suspendate.",
            ],
          },
          "Vă păstrați în orice moment dreptul de a contesta tranzacția direct la banca emitentă.",
        ],
      },
      {
        heading: "Anularea",
        body: [
          "Anularea înainte de termenul afișat la rezervare este gratuită. Anularea după acel termen poate fi taxată la fel ca o neprezentare. Vă rugăm să anulați întotdeauna când nu mai puteți ajunge: masa ajunge la altcineva.",
        ],
      },
    ],
  },
  {
    slug: "confidentialitate",
    title: "Politica de confidențialitate",
    summary: "Ce date folosim, pe ce temei, cât timp le păstrăm și ce drepturi aveți.",
    sections: [
      {
        heading: "Cine prelucrează datele",
        body: [
          "Pentru rezervări, restaurantul la care rezervați este operatorul datelor dumneavoastră, iar Tenuto le prelucrează în numele său, ca persoană împuternicită. Pentru conturile restaurantelor și pentru prevenirea neprezentărilor la nivelul platformei, Tenuto este operator.",
          `Contact pentru protecția datelor: ${OPERATOR.privacyEmail}.`,
        ],
      },
      {
        heading: "Ce date prelucrăm",
        body: [
          {
            list: [
              "nume, număr de telefon (folosit și pentru SMS-ul de confirmare), e-mail (opțional) și observațiile lăsate la rezervare;",
              "detaliile rezervării: restaurant, dată, oră, număr de persoane, masă;",
              "istoricul rezervărilor: vizite, anulări, neprezentări;",
              "textul condițiilor acceptate, momentul acceptării, adresa IP și tipul browserului;",
              "pentru card: tipul și ultimele patru cifre. Numărul complet al cardului nu ajunge niciodată la noi sau la restaurant; îl păstrează furnizorul de plăți.",
            ],
          },
        ],
      },
      {
        heading: "De ce și pe ce temei",
        body: [
          {
            list: [
              "gestionarea rezervării și a garanției — executarea contractului (art. 6 alin. 1 lit. b GDPR);",
              "păstrarea dovezilor în caz de contestație și prevenirea neprezentărilor, inclusiv folosirea istoricului dumneavoastră de neprezentări pe platformă pentru a stabili ce garanție vi se cere — interes legitim (art. 6 alin. 1 lit. f);",
              "evidența contabilă a taxelor încasate — obligație legală (art. 6 alin. 1 lit. c).",
            ],
          },
          "Nu folosim datele pentru publicitate și nu le vindem.",
        ],
      },
      {
        heading: "Cui le transmitem",
        body: [
          "Restaurantului la care ați rezervat; furnizorului de plăți, pentru salvarea cardului și eventuala încasare; furnizorului de SMS, pentru mesajul de confirmare; furnizorilor de găzduire, pe bază de contract.",
        ],
      },
      {
        heading: "Cât timp le păstrăm",
        body: [
          "Datele rezervării și dovezile acceptării condițiilor: pe durata în care o plată poate fi contestată, plus termenul general de prescripție. Documentele contabile: pe durata prevăzută de legea contabilității. Apoi datele sunt șterse sau anonimizate.",
        ],
      },
      {
        heading: "Drepturile dumneavoastră",
        body: [
          "Aveți dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție. Ne puteți scrie oricând la adresa de mai sus. Aveți și dreptul de a depune plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (dataprotection.ro).",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Politica de cookie-uri",
    summary: "Folosim un singur cookie, strict necesar. Fără analiză, fără publicitate.",
    sections: [
      {
        heading: "Ce folosim",
        body: [
          "Clienții care rezervă nu primesc niciun cookie de la Tenuto.",
          "Restaurantele autentificate primesc un singur cookie, „tenuto_session”, care le menține conectate la panou. Este strict necesar, valabil 30 de zile, inaccesibil scripturilor din pagină, și se șterge la deconectare.",
        ],
      },
      {
        heading: "Ce nu folosim",
        body: [
          "Nu folosim cookie-uri de analiză, de publicitate sau de urmărire între site-uri, și niciun serviciu terț care le-ar plasa. De aceea nu vă cerem consimțământul printr-un banner.",
        ],
      },
    ],
  },
];

export function findDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
