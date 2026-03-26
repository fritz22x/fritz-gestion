"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { signOut } from "@/lib/auth";

type ModuleItem = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export default function HomePage() {
  const supabase = createSupabaseBrowserClient();

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setModules([]);
        setUserEmail(null);
        setLoading(false);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("modules")
        .select("id, name, description, sort_order")
        .order("sort_order", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setModules(data ?? []);
      }

      setLoading(false);
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      bootstrap();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await signOut();
    setModules([]);
    setUserEmail(null);
  }

  const isLoggedIn = !!userEmail;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-400">
              Centro de control personal
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Fritz Gestion
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Sistema personal para gestionar modulos, avances, proximos pasos y
              continuidad de trabajo.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <Link
                href="/today"
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Ver hoy
              </Link>
              <Link
                href="/items"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Ver items
              </Link>
              <Link
                href="/logs"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Ver bitacora
              </Link>
            </div>
            {isLoggedIn ? (
              <>
                <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                  {userEmail}
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                >
                  Cerrar sesion
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Iniciar sesion
              </Link>
            )}
          </div>
        </header>

        {!isLoggedIn && (
          <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 text-amber-100">
            No has iniciado sesion. Entra con tu usuario para ver tus modulos.
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Cargando modulos...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-6 text-red-200">
            Error al cargar modulos: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Total de modulos</p>
                <p className="mt-2 text-3xl font-semibold">{modules.length}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Estado</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-400">
                  Base conectada
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Fase actual</p>
                <p className="mt-2 text-3xl font-semibold text-cyan-400">
                  MVP v1
                </p>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Modulos base</h2>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {modules.length} cargados
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => (
                  <article
                    key={module.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600"
                  >
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Modulo
                    </p>
                    <h3 className="text-lg font-semibold text-white">
                      {module.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {module.description || "Sin descripcion"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}


