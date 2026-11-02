import { useState, type FormEvent } from "react";
import { Alert } from "@tracht-digital-solutions/tds-shared/alert";
import { LOCALE, type Lang } from "./shared";
import { DEFAULT_RATE_EUR, ORIGIN, findPlace, findRoute, travelCost, type Place, type Route } from "./travelCost";

const COPY = {
  de: {
    address: "Zieladresse",
    placeholder: "Straße Hausnummer, PLZ Ort",
    rate: "Preis pro Kilometer (€)",
    roundTrip: "Hin- und Rückfahrt",
    submit: "Anfahrt berechnen",
    busy: "Wird berechnet …",
    notFound: "Diese Adresse wurde nicht gefunden. Mit Postleitzahl klappt es meist.",
    failed: "Der Adressdienst antwortet gerade nicht. Bitte später erneut versuchen.",
    from: "Start",
    to: "Ziel",
    distance: "Strecke einfach",
    charged: "Berechnete Strecke",
    time: "Fahrzeit einfach",
    cost: "Anfahrtskosten",
    minutes: "Min.",
    estimate: "Der Routendienst war nicht erreichbar. Strecke geschätzt aus Luftlinie mal 1,3.",
    privacy: "Beim Berechnen geht die Adresse an OpenStreetMap Nominatim, die Koordinaten gehen an den OSRM-Routendienst.",
    credit: "Kartendaten © OpenStreetMap-Mitwirkende",
  },
  en: {
    address: "Destination address",
    placeholder: "Street number, postcode town",
    rate: "Price per kilometre (€)",
    roundTrip: "Return trip",
    submit: "Calculate travel cost",
    busy: "Calculating …",
    notFound: "This address was not found. Adding the postcode usually helps.",
    failed: "The address service is not responding. Please try again later.",
    from: "From",
    to: "To",
    distance: "Distance one way",
    charged: "Charged distance",
    time: "Driving time one way",
    cost: "Travel cost",
    minutes: "min",
    estimate: "The route service was unavailable. Distance estimated from the straight line times 1.3.",
    privacy: "When calculating, the address goes to OpenStreetMap Nominatim and the coordinates go to the OSRM route service.",
    credit: "Map data © OpenStreetMap contributors",
  },
} as const;

export default function TravelCost({ lang = "de" }: { lang?: Lang }) {
  const t = COPY[lang];
  const [address, setAddress] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_RATE_EUR));
  const [roundTrip, setRoundTrip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ place: Place; route: Route } | null>(null);

  const ratePerKm = Math.max(0, Number(rate.replace(",", ".")) || 0);
  const number = (value: number, digits = 1) =>
    value.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const money = (value: number) => value.toLocaleString(LOCALE[lang], { style: "currency", currency: "EUR" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!address.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const place = await findPlace(address.trim(), lang);
      if (!place) setError(t.notFound);
      else setResult({ place, route: await findRoute(place) });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const total = result ? travelCost(result.route.km, ratePerKm, roundTrip) : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block">{t.address}</span>
        <input
          className="field-boxed"
          type="text"
          autoComplete="street-address"
          required
          value={address}
          placeholder={t.placeholder}
          onChange={(event) => setAddress(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">{t.rate}</span>
        <input className="field-boxed" type="text" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={roundTrip} onChange={(event) => setRoundTrip(event.target.checked)} />
        <span>{t.roundTrip}</span>
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? t.busy : t.submit}
      </button>
      <p className="text-sm opacity-80">{t.privacy}</p>

      {error ? <Alert>{error}</Alert> : null}

      {result && total ? (
        <output className="block space-y-2" aria-live="polite">
          <dl className="space-y-1">
            <div><dt className="inline font-semibold">{t.from}: </dt><dd className="inline">{ORIGIN.name}</dd></div>
            <div><dt className="inline font-semibold">{t.to}: </dt><dd className="inline">{result.place.label}</dd></div>
            <div><dt className="inline font-semibold">{t.distance}: </dt><dd className="inline">{number(result.route.km)} km</dd></div>
            <div><dt className="inline font-semibold">{t.time}: </dt><dd className="inline">{number(result.route.minutes, 0)} {t.minutes}</dd></div>
            <div><dt className="inline font-semibold">{t.charged}: </dt><dd className="inline">{number(total.chargedKm)} km</dd></div>
            <div className="text-xl"><dt className="inline font-semibold">{t.cost}: </dt><dd className="inline font-semibold">{money(total.cost)}</dd></div>
          </dl>
          {result.route.estimated ? <Alert tone="neutral">{t.estimate}</Alert> : null}
          <p className="text-sm opacity-80">{t.credit}</p>
        </output>
      ) : null}
    </form>
  );
}
