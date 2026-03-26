"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const ITEM_TYPES = ["tarea", "meta", "objetivo"] as const;
const ITEM_STATUSES = [
  "pendiente",
  "en_proceso",
  "hecho",
  "pausado",
  "bloqueado",
] as const;
const ITEM_PRIORITIES = ["alta", "media", "baja"] as const;

type ItemType = (typeof ITEM_TYPES)[number];
type ItemStatus = (typeof ITEM_STATUSES)[number];
type ItemPriority = (typeof ITEM_PRIORITIES)[number];

type ModuleItem = {
  id: string;
  name: string;
};

type ItemRecord = {
  id: string;
  module_id: string | null;
  submodule: string | null;
  type: ItemType;
  title: string;
  description: string | null;
  status: ItemStatus;
  priority: ItemPriority;
  target_date: string | null;
  next_step: string | null;
  completed_at: string | null;
  created_at: string;
};

type ItemFormState = {
  moduleId: string;
  submodule: string;
  type: ItemType;
  title: string;
  description: string;
  status: ItemStatus;
  priority: ItemPriority;
  targetDate: string;
  nextStep: string;
};

const initialFormState: ItemFormState = {
  moduleId: "",
  submodule: "",
  type: "tarea",
  title: "",
  description: "",
  status: "pendiente",
  priority: "media",
  targetDate: "",
  nextStep: "",
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

function formatStatusLabel(value: ItemStatus) {
  return value === "en_proceso" ? "En proceso" : capitalize(value);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toFormState(item: ItemRecord): ItemFormState {
  return {
    moduleId: item.module_id || "",
    submodule: item.submodule || "",
    type: item.type,
    title: item.title,
    description: item.description || "",
    status: item.status,
    priority: item.priority,
    targetDate: item.target_date || "",
    nextStep: item.next_step || "",
  };
}

function buildItemPayload(form: ItemFormState) {
  return {
    module_id: form.moduleId || null,
    submodule: form.submodule.trim() || null,
    type: form.type,
    title: form.title.trim(),
    description: form.description.trim() || null,
    status: form.status,
    priority: form.priority,
    target_date: form.targetDate || null,
    next_step: form.nextStep.trim() || null,
  };
}

function getCompletedAtValue(nextStatus: ItemStatus, currentCompletedAt: string | null) {
  if (nextStatus === "hecho") {
    return currentCompletedAt || new Date().toISOString();
  }

  return null;
}

export default function ItemsPage() {
  const supabase = createSupabaseBrowserClient();

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(initialFormState);

  useEffect(() => {
    let mounted = true;

    async function loadPageData() {
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
        setLoading(false);
        return;
      }

      const user = session?.user ?? null;

      if (!user) {
        setHasSession(false);
        setUserEmail(null);
        setModules([]);
        setItems([]);
        setEditingItemId(null);
        setForm(initialFormState);
        setLoading(false);
        return;
      }

      setHasSession(true);
      setUserEmail(user.email ?? null);

      const [modulesResult, itemsResult] = await Promise.all([
        supabase
          .from("modules")
          .select("id, name")
          .order("sort_order", { ascending: true }),
        supabase
          .from("items")
          .select(
            "id, module_id, submodule, type, title, description, status, priority, target_date, next_step, completed_at, created_at"
          )
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
        const nextItems = (itemsResult.data ?? []) as ItemRecord[];
        setItems(nextItems);

        if (editingItemId) {
          const activeItem = nextItems.find((item) => item.id === editingItemId);
          if (!activeItem) {
            setEditingItemId(null);
            setForm((current) => ({
              ...initialFormState,
              moduleId: current.moduleId || modulesResult.data?.[0]?.id || "",
            }));
          }
        }
      }

      setLoading(false);
    }

    loadPageData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (mounted) {
        loadPageData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [editingItemId, supabase]);

  async function refreshItems() {
    const { data, error: reloadError } = await supabase
      .from("items")
      .select(
        "id, module_id, submodule, type, title, description, status, priority, target_date, next_step, completed_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (reloadError) {
      throw new Error(reloadError.message);
    }

    setItems((data ?? []) as ItemRecord[]);
    return (data ?? []) as ItemRecord[];
  }

  function resetCreateForm(nextModuleId?: string) {
    setEditingItemId(null);
    setForm({
      ...initialFormState,
      moduleId: nextModuleId ?? modules[0]?.id ?? "",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!hasSession) {
      setFormError("Necesitas iniciar sesion para gestionar items.");
      return;
    }

    if (!form.title.trim()) {
      setFormError("El titulo es obligatorio.");
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

      const payload = buildItemPayload(form);

      if (editingItemId) {
        const currentItem = items.find((item) => item.id === editingItemId);

        if (!currentItem) {
          throw new Error("No se encontro el item que intentas editar.");
        }

        const updatePayload = {
          ...payload,
          completed_at: getCompletedAtValue(payload.status, currentItem.completed_at),
        };

        const { error: updateError } = await supabase
          .from("items")
          .update(updatePayload)
          .eq("id", editingItemId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const refreshedItems = await refreshItems();
        const updatedItem = refreshedItems.find((item) => item.id === editingItemId);

        if (updatedItem) {
          setForm(toFormState(updatedItem));
        }

        setSuccessMessage("Item actualizado correctamente.");
      } else {
        const createPayload = {
          user_id: user.id,
          ...payload,
          completed_at: getCompletedAtValue(payload.status, null),
        };

        const { error: insertError } = await supabase.from("items").insert(createPayload);

        if (insertError) {
          throw new Error(insertError.message);
        }

        await refreshItems();
        resetCreateForm(form.moduleId || modules[0]?.id || "");
        setSuccessMessage("Item creado correctamente.");
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No se pudo guardar el item.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickStatusChange(item: ItemRecord, nextStatus: ItemStatus) {
    if (quickUpdatingId || item.status === nextStatus) {
      return;
    }

    setQuickUpdatingId(item.id);
    setError(null);
    setSuccessMessage(null);

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

      const refreshedItems = await refreshItems();

      if (editingItemId === item.id) {
        const updatedItem = refreshedItems.find((current) => current.id === item.id);
        if (updatedItem) {
          setForm(toFormState(updatedItem));
        }
      }

      setSuccessMessage(
        nextStatus === "hecho"
          ? "Item marcado como hecho."
          : "Estado actualizado correctamente."
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo actualizar el estado.";
      setError(message);
    } finally {
      setQuickUpdatingId(null);
    }
  }

  function startEditing(item: ItemRecord) {
    setEditingItemId(item.id);
    setFormError(null);
    setSuccessMessage(null);
    setForm(toFormState(item));
  }

  function cancelEditing() {
    setFormError(null);
    setSuccessMessage(null);
    resetCreateForm(form.moduleId || modules[0]?.id || "");
  }

  function updateForm<K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function getModuleName(moduleId: string | null) {
    if (!moduleId) return "Sin modulo";
    return modules.find((module) => module.id === moduleId)?.name || "Modulo no disponible";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-400">
              Operacion diaria
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Items</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Gestiona tareas, metas y objetivos en una sola vista simple para trabajar
              con continuidad.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {userEmail && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                {userEmail}
              </div>
            )}
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
              Inicia sesion para ver y gestionar items dentro de tu espacio de trabajo.
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
            Cargando items...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-950/40 p-5 text-sm text-red-200">
            Error al cargar datos: {error}
          </div>
        )}

        {!loading && !error && hasSession && (
          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    {editingItemId ? "Edicion" : "Nuevo item"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {editingItemId ? "Editar item" : "Crear registro"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    {editingItemId
                      ? "Actualiza el item y guarda cambios sin salir de la pagina."
                      : "Carga lo minimo necesario para empezar a trabajar hoy."}
                  </p>
                </div>

                {editingItemId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <Field label="Modulo">
                    <select
                      value={form.moduleId}
                      onChange={(event) => updateForm("moduleId", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      <option value="">Sin modulo</option>
                      {modules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Submodulo">
                    <input
                      type="text"
                      value={form.submodule}
                      onChange={(event) => updateForm("submodule", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                      placeholder="Ej. Campanas Q2"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Tipo">
                    <select
                      value={form.type}
                      onChange={(event) => updateForm("type", event.target.value as ItemType)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      {ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {capitalize(type)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Estado">
                    <select
                      value={form.status}
                      onChange={(event) => updateForm("status", event.target.value as ItemStatus)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      {ITEM_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Prioridad">
                    <select
                      value={form.priority}
                      onChange={(event) => updateForm("priority", event.target.value as ItemPriority)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    >
                      {ITEM_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {capitalize(priority)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Titulo">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    placeholder="Define el trabajo principal"
                    required
                  />
                </Field>

                <Field label="Descripcion">
                  <textarea
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    placeholder="Contexto breve del item"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fecha objetivo">
                    <input
                      type="date"
                      value={form.targetDate}
                      onChange={(event) => updateForm("targetDate", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    />
                  </Field>

                  <Field label="Siguiente paso">
                    <input
                      type="text"
                      value={form.nextStep}
                      onChange={(event) => updateForm("nextStep", event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                      placeholder="Accion concreta inmediata"
                    />
                  </Field>
                </div>

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
                  {submitting
                    ? editingItemId
                      ? "Guardando cambios..."
                      : "Creando item..."
                    : editingItemId
                      ? "Guardar cambios"
                      : "Crear item"}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Bandeja actual
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Lista de items</h2>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {items.length} registrados
                </span>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
                  Aun no tienes items. Crea el primero desde el formulario para empezar a
                  operar dentro del sistema.
                </div>
              ) : (
                <div className="grid gap-4">
                  {items.map((item) => {
                    const isEditing = editingItemId === item.id;
                    const isQuickUpdating = quickUpdatingId === item.id;

                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border p-5 transition ${
                          isEditing
                            ? "border-cyan-500/40 bg-slate-950"
                            : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {getModuleName(item.module_id)}
                              {item.submodule ? ` / ${item.submodule}` : ""}
                            </p>
                            <h3 className="mt-2 text-lg font-semibold text-white">
                              {item.title}
                            </h3>
                            <p className="mt-2 text-sm text-slate-300">
                              {item.description || "Sin descripcion"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200">
                              {capitalize(item.type)}
                            </span>
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

                        <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Siguiente paso
                            </p>
                            <p className="mt-2">{item.next_step || "Aun no definido"}</p>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Fecha objetivo
                            </p>
                            <p className="mt-2">{item.target_date || "Sin fecha"}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <Field label="Cambio rapido de estado">
                              <select
                                value={item.status}
                                onChange={(event) =>
                                  handleQuickStatusChange(item, event.target.value as ItemStatus)
                                }
                                disabled={isQuickUpdating}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {ITEM_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {formatStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(item, "hecho")}
                              disabled={isQuickUpdating || item.status === "hecho"}
                              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isQuickUpdating && item.status !== "hecho" ? "Guardando..." : "Marcar hecho"}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => startEditing(item)}
                              className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500 hover:bg-slate-900"
                            >
                              {isEditing ? "Editando" : "Editar"}
                            </button>
                          </div>
                        </div>

                        {item.completed_at && (
                          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-emerald-300">
                            Completado: {new Date(item.completed_at).toLocaleString()}
                          </p>
                        )}
                      </article>
                    );
                  })}
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






