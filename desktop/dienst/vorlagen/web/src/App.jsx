import { begruessung } from "./lib/text.js";

// Startseite – wird in der Codeschmiede mit Aufträgen und dem App-Designer ausgebaut.
export default function App() {
  return (
    <main className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="px-5 py-4 bg-emerald-700 text-white">
        <h1 className="text-xl font-bold">[PROJEKTNAME]</h1>
      </header>
      <section className="flex-1 p-5 flex flex-col gap-3">
        <p className="text-lg">{begruessung(new Date().getHours())}!</p>
        <p className="text-slate-600 dark:text-slate-300">Das Grundgerüst steht. Neue Funktionen gibst du als Auftrag in der Codeschmiede.</p>
      </section>
    </main>
  );
}
