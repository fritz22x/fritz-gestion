"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const SESSION_TYPES = ["trabajo_profundo", "operativo", "revision"] as const;
const RESULTING_STATUSES = [
  "pendiente",
  "en_proceso",
  "hecho",
  "pausado",
  "bloqueado",
] as const;

type SessionType = (typeof SESSION_TYPES)[number];
type ResultingStatus = (typeof RESULTING_STATUSES)[number];

type ModuleItem = {
  id: string;
  name: string;
};

type ItemOption = {
  id: string;
  module_id: string | null;
  title: string;
};

type WorkLogRecord = {
  id: string;
  module_id: string | null;
  item_id: string | null;
  log_date: string;
  session_type: SessionType;
  progress_today: string;
  where_i_stopped: string | null;
  next_step: string | null;
  time_spent_minutes: number | null;
  resulting_status: ResultingStatus;
  created_at: string;
};

type LogFormState = {
  logDate: string;
  moduleId: string;
  itemId: string;
  sessionType: SessionType;
  progressToday: string;
  whereIStopped: string;
  nextStep: string;
  timeSpentMinutes: string;
  resultingStatus: ResultingStatus;
};

const initialFormState: LogFormState = {
  logDate: new Date().toISOString().slice(0, 10),
  moduleId: "",
  itemId: "",
  sessionType: "trabajo_profundo",
  progressToday: "",
  whereIStopped: "",
  nextStep: "",
  timeSpentMinutes: "",
  resultingStatus: "en_proceso",
};

const statusClasses: Record<ResultingStatus, string> = {
  pendiente: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  en_proceso: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  hecho: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  pausado: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  bloqueado: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSessionType(value: SessionType) {
  if (value === "trabajo_profundo") return "Trabajo profundo";
  return capitalize(value);
}

function formatStatusLabel(value: ResultingStatus) {
  return value === "en_proceso" ? "En proceso" : capitalize(value);
}

export default function LogsPage() {
  const supabase = createSupabaseBrowserClient();
  const [requestedModuleId, setRequestedModuleId] = useState<string | null>(null);

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [logs, setLogs] = useState<WorkLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [form, setForm] = useState<LogFormState>(initialFormState);
  const [requestedItemId, setRequestedItemId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPageData() {
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
          .select("id, module_id, title")
          .order("created_at", { ascending: false }),
        supabase
          .from("work_logs")
          .select(
            "id, module_id, item_id, log_date, session_type, progress_today, where_i_stopped, next_step, time_spent_minutes, resulting_status, created_at"
          )
          .order("log_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;

      if (modulesResult.error) {
        setError(modulesResult.error.message);
      } else {
        const moduleRows = (modulesResult.data ?? []) as ModuleItem[];
        setModules(moduleRows);
        setForm((current) => ({
          ...current,
          moduleId: current.moduleId || moduleRows[0]?.id || "",
        }));
      }

      if (itemsResult.error) {
        setError(itemsResult.error.message);
      } else {
        setItems((itemsResult.data ?? []) as ItemOption[]);
      }

      if (logsResult.error) {
        setError(logsResult.error.message);
      } else {
        setLogs((logsResult.data ?? []) as WorkLogRecord[]);
      }

      setLoading(false);
    }

    loadPageData();

    const authClient = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange(() => {
      if (mounted) {
        loadPageData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const itemsForSelectedModule = useMemo(() => {
    if (!form.moduleId) return items;
    return items.filter((item) => item.module_id === form.moduleId);
  }, [form.moduleId, items]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setRequestedModuleId(params.get("module"));
    setRequestedItemId(params.get("item"));
  }, []);

  useEffect(() => {
    if (modules.length === 0 && items.length === 0) {
      return;
    }

    setForm((current) => {
      const nextModuleId =
        requestedModuleId && modules.some((module) => module.id === requestedModuleId)
          ? requestedModuleId
          : current.moduleId;

      const nextItemId =
        requestedItemId && items.some((item) => item.id === requestedItemId)
          ? requestedItemId
          : current.itemId;

      return {
        ...current,
        moduleId: nextModuleId,
        itemId: nextItemId,
      };
    });
  }, [items, modules, requestedItemId, requestedModuleId]);

  async function refreshLogs() {
    const { data, error: reloadError } = await supabase
      .from("work_logs")
      .select(
        "id, module_id, item_id, log_date, session_type, progress_today, where_i_stopped, next_step, time_spent_minutes, resulting_status, created_at"
      )
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (reloadError) {
      throw new Error(reloadError.message);
    }

    setLogs((data ?? []) as WorkLogRecord[]);
  }

  function updateForm<K extends keyof LogFormState>(key: K, value: LogFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function getModuleName(moduleId: string | null) {
    if (!moduleId) return "Sin modulo";
    return modules.find((module) => module.id === moduleId)?.name || "Modulo no disponible";
  }

  function getItemTitle(itemId: string | null) {
    if (!itemId) return "Sin item vinculado";
    return items.find((item) => item.id === itemId)?.title || "Item no disponible";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!hasSession) {
      setFormError("Necesitas iniciar sesion para registrar una bitacora.");
      return;
    }

    if (!form.moduleId) {
      setFormError("Selecciona un modulo.");
      return;
    }

    if (!form.progressToday.trim()) {
      setFormError("El avance de hoy es obligatorio.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (authError || !user) {
        throw new Error(authError?.message || "Tu sesion no esta disponible.");
      }

      const timeSpent = form.timeSpentMinutes.trim();
      const parsedMinutes = timeSpent ? Number(timeSpent) : null;

      if (parsedMinutes !== null && (!Number.isFinite(parsedMinutes) || parsedMinutes < 0)) {
        throw new Error("El tiempo usado debe ser un numero valido de minutos.");
      }

      const payload = {
        user_id: user.id,
        module_id: form.moduleId,
        item_id: form.itemId || null,
        log_date: form.logDate,
        session_type: form.sessionType,
        progress_today: form.progressToday.trim(),
        where_i_stopped: form.whereIStopped.trim() || null,
        next_step: form.nextStep.trim() || null,
        time_spent_minutes: parsedMinutes,
        resulting_status: form.resultingStatus,
      };

      const { error: insertError } = await supabase.from("work_logs").insert(payload);

      if (insertError) {
        throw new Error(insertError.message);
      }

      await refreshLogs();
      setForm((current) => ({
        ...initialFormState,
        logDate: new Date().toISOString().slice(0, 10),
        moduleId: current.moduleId || modules[0]?.id || "",
      }));
      setSuccessMessage("Sesion registrada correctamente.");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No se pudo registrar la sesion.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-400">
              Continuidad operativa
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bitacora</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Registra sesiones reales de trabajo para retomar rapido donde te quedaste.
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
              Inicia sesion para registrar y revisar tu bitacora de trabajo.
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
            Cargando bitacora...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-950/40 p-5 text-sm text-red-200">
            Error al cargar datos: {error}
          </div>
        )}

        {!loading && !error && hasSession && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Nueva sesion
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Registrar bitacora</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Guarda contexto suficiente para retomar trabajo sin friccion, tambien desde celular.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <Field label="Fecha">
                    <input
                      type="date"
                      value={form.logDate}
                      onChange={(event) => updateForm("logDate", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                      required
                    />
                  </Field>

                  <Field label="Modulo">
                    <select
                      value={form.moduleId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          moduleId: event.target.value,
                          itemId: "",
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      <option value="">Selecciona un modulo</option>
                      {modules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Item opcional">
                    <select
                      value={form.itemId}
                      onChange={(event) => updateForm("itemId", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      <option value="">Sin item vinculado</option>
                      {itemsForSelectedModule.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Tipo de sesion">
                    <select
                      value={form.sessionType}
                      onChange={(event) =>
                        updateForm("sessionType", event.target.value as SessionType)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      {SESSION_TYPES.map((sessionType) => (
                        <option key={sessionType} value={sessionType}>
                          {formatSessionType(sessionType)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Avance de hoy">
                  <textarea
                    value={form.progressToday}
                    onChange={(event) => updateForm("progressToday", event.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    placeholder="Que lograste hoy en esta sesion"
                    required
                  />
                </Field>

                <Field label="Donde me quede">
                  <textarea
                    value={form.whereIStopped}
                    onChange={(event) => updateForm("whereIStopped", event.target.value)}
                    className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    placeholder="Deja contexto claro para retomarlo luego"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Siguiente paso">
                    <input
                      type="text"
                      value={form.nextStep}
                      onChange={(event) => updateForm("nextStep", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                      placeholder="Accion concreta al volver"
                    />
                  </Field>

                  <Field label="Tiempo usado (minutos)">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.timeSpentMinutes}
                      onChange={(event) => updateForm("timeSpentMinutes", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                      placeholder="45"
                    />
                  </Field>
                </div>

                <Field label="Estado resultante">
                  <select
                    value={form.resultingStatus}
                    onChange={(event) =>
                      updateForm("resultingStatus", event.target.value as ResultingStatus)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                  >
                    {RESULTING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </Field>

                {formError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                    {formError}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
                    {successMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Guardando sesion..." : "Registrar sesion"}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Historial reciente
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Sesiones registradas</h2>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {logs.length} registros
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
                  Aun no tienes sesiones registradas. Guarda la primera para construir continuidad.
                </div>
              ) : (
                <div className="grid gap-4">
                  {logs.map((log) => (
                    <article
                      key={log.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition hover:border-slate-700"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {log.log_date} · {getModuleName(log.module_id)}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            {formatSessionType(log.session_type)}
                          </h3>
                          <p className="mt-2 text-sm text-slate-300">{log.progress_today}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200">
                            {log.time_spent_minutes ? `${log.time_spent_minutes} min` : "Sin tiempo"}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[log.resulting_status]}`}
                          >
                            {formatStatusLabel(log.resulting_status)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
                        <InfoCard label="Item">{getItemTitle(log.item_id)}</InfoCard>
                        <InfoCard label="Siguiente paso">{log.next_step || "Sin definir"}</InfoCard>
                        <InfoCard label="Donde me quede">{log.where_i_stopped || "Sin detalle"}</InfoCard>
                        <InfoCard label="Estado resultante">
                          {formatStatusLabel(log.resulting_status)}
                        </InfoCard>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2">{children}</p>
    </div>
  );
}










