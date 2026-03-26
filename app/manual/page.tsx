import Link from "next/link";

const quickFlow = [
  {
    title: "Items",
    description:
      "Aqui vive lo que existe: tareas, metas y objetivos con estado, prioridad y siguiente paso.",
    rule: "Items = lo que existe",
    href: "/items",
    cta: "Abrir items",
  },
  {
    title: "Bitacora",
    description:
      "Aqui registras lo que hiciste en una sesion: avance, donde te quedaste y el siguiente paso.",
    rule: "Bitacora = lo que hiciste",
    href: "/logs",
    cta: "Abrir bitacora",
  },
  {
    title: "Hoy",
    description:
      "Aqui retomas trabajo con foco diario, continuidad visible y accesos rapidos al siguiente paso.",
    rule: "Hoy = lo que debes retomar",
    href: "/today",
    cta: "Abrir Hoy",
  },
];

const steps = [
  "Crea o ajusta tus Items cuando aparezca trabajo nuevo o cambie una prioridad.",
  "Registra en Bitacora cada sesion real para dejar avance, donde te quedaste y el siguiente paso.",
  "Abre Hoy para retomar rapido lo importante y no perder continuidad.",
];

export default function ManualPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-400">Ayuda interna</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Manual rapido</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Una guia corta para usar Fritz Gestion sin friccion y mantener continuidad real.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/today"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Ir a Hoy
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Volver al inicio
            </Link>
          </div>
        </header>

        <section className="mb-8 rounded-3xl border border-cyan-500/20 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Regla practica</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <RuleCard title="Items" text="Lo que existe" />
            <RuleCard title="Bitacora" text="Lo que hiciste" />
            <RuleCard title="Hoy" text="Lo que debes retomar" />
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Orden sugerido</p>
          <h2 className="mt-2 text-2xl font-semibold">Como usar el sistema</h2>
          <div className="mt-5 grid gap-3">
            {steps.map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300"
              >
                <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-cyan-300">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {quickFlow.map((entry) => (
            <article
              key={entry.title}
              className="rounded-3xl border border-slate-800 bg-slate-900 p-6"
            >
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{entry.title}</p>
              <h2 className="mt-2 text-2xl font-semibold">{entry.rule}</h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">{entry.description}</p>
              <Link
                href={entry.href}
                className="mt-5 inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-950"
              >
                {entry.cta}
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function RuleCard({
  title,
  text,
}: Readonly<{
  title: string;
  text: string;
}>) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{text}</p>
    </div>
  );
}
