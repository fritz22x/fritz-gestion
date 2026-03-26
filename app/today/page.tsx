"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type ItemStatus = "pendiente" | "en_proceso" | "hecho" | "pausado" | "bloqueado";
type ItemPriority = "alta" | "media" | "baja";

type ModuleItem = {
  id: string;
  name: string;
};

type TodayItem = {
  id: string;
  module_id: string | null;
  title: string;
  status: ItemStatus;
  priority: ItemPriority;
  next_step: string | null;
  target_date: string | null;
  next_review_at: string | null;
  completed_at: string | null;
};

type TodayLog = {
  id: string;
  module_id: string | null;
  item_id: string | null;
  log_date: string;
  progress_today: string;
  next_step: string | null;
  created_at: string;
};

type LogItemRef = {
  id: string;
  title: string;
};

type RecentItemActivity = {
  itemId: string;
  moduleId: string | null;
  title: string;
  logDate: string;
  progressToday: string;
  nextStep: string | null;
};

const statusClasses: Record<ItemStatus, string> = {
  pendiente: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  en_proceso: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  hecho: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  pausado: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  bloqueado: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

const priorityClasses: Record<ItemPriority, string> = {
  alta: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  media: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  baja: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStatusLabel(value: ItemStatus) {
  return value === "en_proceso" ? "En proceso" : capitalize(value);
}

function formatReviewLabel(item: TodayItem) {
  if (item.next_review_at) {
    return item.next_review_at;
  }

  return item.target_date || "Sin fecha";
}

function getCompletedAtValue(nextStatus: ItemStatus, currentCompletedAt: string | null) {
  if (nextStatus === "hecho") {
    return currentCompletedAt || new Date().toISOString();
  }

  return null;
}

export default function TodayPage() {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [logs, setLogs] = useState<TodayLog[]>([]);
  const [logItems, setLogItems] = useState<LogItemRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  async function refreshItems() {
    const supabase = createSupabaseBrowserClient();
    const { data, error: reloadError } = await supabase
      .from("items")
      .select(
        "id, module_id, title, status, priority, next_step, target_date, next_review_at, completed_at"
      )
      .order("created_at", { ascending: false });

    if (reloadError) {
      throw new Error(reloadError.message);
    }

    const nextItems = (data ?? []) as TodayItem[];
    setItems(nextItems);
    setLogItems(nextItems.map((item) => ({ id: item.id, title: item.title })));
    return nextItems;
  }

  useEffect(() => {
    let mounted = true;

    async function loadTodayData() {
      const supabase = createSupabaseBrowserClient();
      setLoading(true);
      setError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setHasSession(false);
        setUserEmail(null);
        setModules([]);
        setItems([]);
        setLogs([]);
        setLogItems([]);
        setLoading(false);
        return;
      }

      const user = session?.user ?? null;

      if (!user) {
        setHasSession(false);
        setUserEmail(null);
        setModules([]);
        setItems([]);
        setLogs([]);
        setLogItems([]);
        setLoading(false);
        return;
      }

      setHasSession(true);
      setUserEmail(user.email ?? null);

      const [modulesResult, itemsResult, logsResult] = await Promise.all([
        supabase
          .from("modules")
          .select("id, name")
          .order("sort_order", { ascending: true }),
        supabase
          .from("items")
          .select(
            "id, module_id, title, status, priority, next_step, target_date, next_review_at, completed_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("work_logs")
          .select("id, module_id, item_id, log_date, progress_today, next_step, created_at")
          .order("log_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      if (!mounted) return;

      if (modulesResult.error) {
        setError(modulesResult.error.message);
      } else {
        setModules((modulesResult.data ?? []) as ModuleItem[]);
      }

      if (itemsResult.error) {
        setError(itemsResult.error.message);
      } else {
        const nextItems = (itemsResult.data ?? []) as TodayItem[];
        setItems(nextItems);
        setLogItems(nextItems.map((item) => ({ id: item.id, title: item.title })));
      }

      if (logsResult.error) {
        setError(logsResult.error.message);
      } else {
        setLogs((logsResult.data ?? []) as TodayLog[]);
      }

      setLoading(false);
    }

    loadTodayData();

    const authClient = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange(() => {
      if (mounted) {
        loadTodayData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const todayReference = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const nearReviewLimit = useMemo(() => {
    const date = new Date(todayReference);
    date.setDate(date.getDate() + 3);
    return date;
  }, [todayReference]);

  const inProgressItems = useMemo(
    () => items.filter((item) => item.status === "en_proceso"),
    [items]
  );

  const highPriorityItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.priority === "alta" &&
          (item.status === "pendiente" || item.status === "en_proceso")
      ),
    [items]
  );

  const blockedItems = useMemo(
    () => items.filter((item) => item.status === "bloqueado"),
    [items]
  );

  const reviewItems = useMemo(
    () =>
      items.filter((item) => {
        const sourceDate = item.next_review_at || item.target_date;
        if (!sourceDate) return false;

        const parsed = new Date(sourceDate);
        if (Number.isNaN(parsed.getTime())) return false;

        return parsed <= nearReviewLimit;
      }),
    [items, nearReviewLimit]
  );

  const linkedLogs = useMemo(() => logs.filter((log) => Boolean(log.item_id)), [logs]);

  const latestWorkedLog = linkedLogs[0] ?? null;

  const recentItemActivity = useMemo(() => {
    const seenItemIds = new Set<string>();
    const recentItems: RecentItemActivity[] = [];

    for (const log of linkedLogs) {
      if (!log.item_id || seenItemIds.has(log.item_id)) {
        continue;
      }

      seenItemIds.add(log.item_id);
      recentItems.push({
        itemId: log.item_id,
        moduleId: log.module_id,
        title: getItemTitleFromRefs(log.item_id, logItems),
        logDate: log.log_date,
        progressToday: log.progress_today,
        nextStep: log.next_step,
      });

      if (recentItems.length === 3) {
        break;
      }
    }

    return recentItems;
  }, [linkedLogs, logItems]);

  const visibleRecentLogs = useMemo(() => logs.slice(0, 6), [logs]);

  function getModuleName(moduleId: string | null) {
    if (!moduleId) return "Sin modulo";
    return modules.find((module) => module.id === moduleId)?.name || "Modulo no disponible";
  }

  function getItemTitle(itemId: string | null) {
    if (!itemId) return "Sin item vinculado";
    return getItemTitleFromRefs(itemId, logItems);
  }

  function getLogHrefFromContext(moduleId: string | null, itemId: string | null) {
    const params = new URLSearchParams();

    if (moduleId) {
      params.set("module", moduleId);
    }

    if (itemId) {
      params.set("item", itemId);
    }

    const query = params.toString();
    return query ? `/logs?${query}` : "/logs";
  }

  function getLogHref(item: TodayItem) {
    return getLogHrefFromContext(item.module_id, item.id);
  }

  async function handleQuickStatusChange(item: TodayItem, nextStatus: ItemStatus) {
    if (quickUpdatingId || item.status === nextStatus) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    setQuickUpdatingId(item.id);
    setError(null);
    setActionMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("items")
        .update({
          status: nextStatus,
          completed_at: getCompletedAtValue(nextStatus, item.completed_at),
        })
        .eq("id", item.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await refreshItems();
      setActionMessage(
        nextStatus === "hecho"
          ? "Item marcado como hecho desde Hoy."
          : "Estado actualizado correctamente desde Hoy."
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No se pudo actualizar el item.";
      setError(message);
    } finally {
      setQuickUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-400">
              Panel diario
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hoy</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Retoma trabajo sin friccion con foco en lo activo, lo urgente y la continuidad mas reciente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {userEmail && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                {userEmail}
              </div>
            )}
            <Link
              href="/items"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Ir a items
            </Link>
            <Link
              href="/logs"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Ir a bitacora
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Volver al inicio
            </Link>
          </div>
        </header>

        {!hasSession && !loading && (
          <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 text-amber-100">
            <p className="text-base font-semibold">No hay una sesion activa.</p>
            <p className="mt-2 text-sm text-amber-50/80">
              Inicia sesion para ver tu foco diario, items activos y logs recientes.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Ir a login
            </Link>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Cargando vista diaria...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-950/40 p-5 text-sm text-red-200">
            Error al cargar datos: {error}
          </div>
        )}

        {actionMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-5 text-sm text-emerald-200">
            {actionMessage}
          </div>
        )}

        {!loading && !error && hasSession && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="En proceso" value={inProgressItems.length} accent="text-cyan-400" />
              <SummaryCard label="Alta prioridad" value={highPriorityItems.length} accent="text-rose-400" />
              <SummaryCard label="Bloqueados" value={blockedItems.length} accent="text-amber-300" />
              <SummaryCard label="Revision cercana" value={reviewItems.length} accent="text-emerald-400" />
            </section>

            <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Continuidad</p>
                  <h2 className="mt-2 text-2xl font-semibold">Retomar trabajo</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-300">
                    Encuentra rapido el ultimo item trabajado y una lista corta de actividad reciente para volver al flujo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/logs"
                    className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
                  >
                    Ver bitacora
                  </Link>
                  <Link
                    href="/items"
                    className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-950"
                  >
                    Ver items
                  </Link>
                </div>
              </div>

              {latestWorkedLog?.item_id ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <article className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Ultimo item trabajado</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {latestWorkedLog.log_date} · {getModuleName(latestWorkedLog.module_id)}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {getItemTitle(latestWorkedLog.item_id)}
                    </h3>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InfoPanel label="Ultimo avance">{latestWorkedLog.progress_today}</InfoPanel>
                      <InfoPanel label="Siguiente paso">
                        {latestWorkedLog.next_step || "Sin siguiente paso definido"}
                      </InfoPanel>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/items?item=${latestWorkedLog.item_id}`}
                        className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                      >
                        Retomar
                      </Link>
                      <Link
                        href={getLogHrefFromContext(latestWorkedLog.module_id, latestWorkedLog.item_id)}
                        className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                      >
                        Crear log
                      </Link>
                    </div>
                  </article>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Actividad reciente</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Ultimos 3 items con movimiento</h3>

                    <div className="mt-4 grid gap-3">
                      {recentItemActivity.map((activity) => (
                        <article
                          key={activity.itemId}
                          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
                        >
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {activity.logDate} · {getModuleName(activity.moduleId)}
                          </p>
                          <h4 className="mt-2 text-base font-semibold text-white">{activity.title}</h4>
                          <p className="mt-2 text-sm text-slate-300">{activity.progressToday}</p>
                          <p className="mt-3 text-sm text-slate-400">
                            Siguiente paso: {activity.nextStep || "Sin siguiente paso definido"}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link
                              href={`/items?item=${activity.itemId}`}
                              className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-950"
                            >
                              Ver item
                            </Link>
                            <Link
                              href={getLogHrefFromContext(activity.moduleId, activity.itemId)}
                              className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
                            >
                              Crear log
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
                  <p className="text-base font-medium text-slate-200">Aun no hay continuidad vinculada a items.</p>
                  <p className="mt-2">
                    Crea un log asociado a un item para que Hoy pueda ayudarte a retomar trabajo mas rapido.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link
                      href="/items"
                      className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-900"
                    >
                      Ir a items
                    </Link>
                    <Link
                      href="/logs"
                      className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                    >
                      Registrar log
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionBlock
                title="Items en proceso"
                subtitle="Lo que ya esta activo y necesita continuidad hoy."
                emptyMessage="No tienes items en proceso en este momento."
                count={inProgressItems.length}
              >
                <ItemList
                  items={inProgressItems}
                  getModuleName={getModuleName}
                  quickUpdatingId={quickUpdatingId}
                  onQuickStatusChange={handleQuickStatusChange}
                  getLogHref={getLogHref}
                />
              </SectionBlock>

              <SectionBlock
                title="Prioridad alta"
                subtitle="Pendientes o en proceso que requieren atencion primero."
                emptyMessage="No tienes items de prioridad alta pendientes hoy."
                count={highPriorityItems.length}
              >
                <ItemList
                  items={highPriorityItems}
                  getModuleName={getModuleName}
                  quickUpdatingId={quickUpdatingId}
                  onQuickStatusChange={handleQuickStatusChange}
                  getLogHref={getLogHref}
                />
              </SectionBlock>

              <SectionBlock
                title="Bloqueados"
                subtitle="Lo que necesita destrabe para que el flujo vuelva a avanzar."
                emptyMessage="No hay items bloqueados ahora mismo."
                count={blockedItems.length}
              >
                <ItemList
                  items={blockedItems}
                  getModuleName={getModuleName}
                  quickUpdatingId={quickUpdatingId}
                  onQuickStatusChange={handleQuickStatusChange}
                  getLogHref={getLogHref}
                />
              </SectionBlock>

              <SectionBlock
                title="Proxima revision"
                subtitle="Base preparada para revisiones; usa next_review_at o target_date si existe."
                emptyMessage="No hay revisiones vencidas o cercanas por ahora."
                count={reviewItems.length}
              >
                <ReviewList
                  items={reviewItems}
                  getModuleName={getModuleName}
                  quickUpdatingId={quickUpdatingId}
                  onQuickStatusChange={handleQuickStatusChange}
                  getLogHref={getLogHref}
                />
              </SectionBlock>
            </div>

            <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Continuidad reciente
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Bitacora reciente</h2>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {visibleRecentLogs.length} visibles
                </span>
              </div>

              {visibleRecentLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
                  Aun no tienes logs recientes. Registra una sesion para reforzar continuidad.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {visibleRecentLogs.map((log) => (
                    <article
                      key={log.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition hover:border-slate-700"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {log.log_date} · {getModuleName(log.module_id)}
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-white">
                        {getItemTitle(log.item_id)}
                      </h3>
                      <p className="mt-3 text-sm text-slate-300">{log.progress_today}</p>
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Siguiente paso
                        </p>
                        <p className="mt-2">{log.next_step || "Sin siguiente paso definido"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function getItemTitleFromRefs(itemId: string, logItems: LogItemRef[]) {
  return logItems.find((item) => item.id === itemId)?.title || "Item no disponible";
}

function InfoPanel({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2">{children}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: Readonly<{
  label: string;
  value: number;
  accent: string;
}>) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function SectionBlock({
  title,
  subtitle,
  emptyMessage,
  count,
  children,
}: Readonly<{
  title: string;
  subtitle: string;
  emptyMessage: string;
  count: number;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Hoy</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      <div className="mt-5">
        {count > 0 ? (
          children
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-400">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function ItemList({
  items,
  getModuleName,
  quickUpdatingId,
  onQuickStatusChange,
  getLogHref,
}: Readonly<{
  items: TodayItem[];
  getModuleName: (moduleId: string | null) => string;
  quickUpdatingId: string | null;
  onQuickStatusChange: (item: TodayItem, nextStatus: ItemStatus) => Promise<void>;
  getLogHref: (item: TodayItem) => string;
}>) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-4">
      {items.map((item) => {
        const isQuickUpdating = quickUpdatingId === item.id;

        return (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition hover:border-slate-700"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {getModuleName(item.module_id)}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[item.status]}`}
                >
                  {formatStatusLabel(item.status)}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClasses[item.priority]}`}
                >
                  {capitalize(item.priority)}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Siguiente paso</p>
              <p className="mt-2">{item.next_step || "Sin siguiente paso definido"}</p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Cambio rapido de estado</span>
                  <select
                    value={item.status}
                    onChange={(event) => onQuickStatusChange(item, event.target.value as ItemStatus)}
                    disabled={isQuickUpdating}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="hecho">Hecho</option>
                    <option value="pausado">Pausado</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => onQuickStatusChange(item, "hecho")}
                  disabled={isQuickUpdating || item.status === "hecho"}
                  className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isQuickUpdating ? "Guardando..." : "Marcar hecho"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link
                  href={`/items?item=${item.id}`}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-900"
                >
                  Ver / editar item
                </Link>
                <Link
                  href={getLogHref(item)}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                >
                  Crear log
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ReviewList({
  items,
  getModuleName,
  quickUpdatingId,
  onQuickStatusChange,
  getLogHref,
}: Readonly<{
  items: TodayItem[];
  getModuleName: (moduleId: string | null) => string;
  quickUpdatingId: string | null;
  onQuickStatusChange: (item: TodayItem, nextStatus: ItemStatus) => Promise<void>;
  getLogHref: (item: TodayItem) => string;
}>) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-4">
      {items.map((item) => {
        const isQuickUpdating = quickUpdatingId === item.id;

        return (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition hover:border-slate-700"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {getModuleName(item.module_id)}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClasses[item.priority]}`}
              >
                {capitalize(item.priority)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Revision</p>
                <p className="mt-2">{formatReviewLabel(item)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Siguiente paso</p>
                <p className="mt-2">{item.next_step || "Sin siguiente paso definido"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onQuickStatusChange(item, "en_proceso")}
                disabled={isQuickUpdating && quickUpdatingId === item.id}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isQuickUpdating ? "Guardando..." : "Poner en proceso"}
              </button>
              <Link
                href={`/items?item=${item.id}`}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-900"
              >
                Ver / editar item
              </Link>
              <Link
                href={getLogHref(item)}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Crear log
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}


