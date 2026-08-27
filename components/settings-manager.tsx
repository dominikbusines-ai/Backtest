"use client";

import { useEffect, useState } from "react";
import { FolderPlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Tag, TagCategory } from "@/lib/types";

export function SettingsManager() {
  const [tags, setTags] = useState<Tag[]>([]); const [categories, setCategories] = useState<TagCategory[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [newTag, setNewTag] = useState(""); const [newCategory, setNewCategory] = useState(""); const [categoryId, setCategoryId] = useState("");
  async function load() { try { const response = await fetch("/api/tags"); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTags(data.tags); setCategories(data.categories); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Einstellungen konnten nicht geladen werden."); } finally { setLoading(false); } }
  useEffect(() => {
    let active = true;
    fetch("/api/tags")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        if (!active) return;
        setTags(data.tags); setCategories(data.categories); setError("");
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Einstellungen konnten nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function request(path: string, method: string, body?: object) { const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); }
  async function addTag() { if (!newTag.trim()) return; try { await request("/api/tags", "POST", { name: newTag, category_id: categoryId || null }); setNewTag(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Tag konnte nicht erstellt werden."); } }
  async function addCategory() { if (!newCategory.trim()) return; try { await request("/api/categories", "POST", { name: newCategory }); setNewCategory(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kategorie konnte nicht erstellt werden."); } }
  async function rename(kind: "tags" | "categories", id: string, oldName: string, currentCategory?: string | null) { const name = window.prompt("Neuer Name", oldName)?.trim(); if (!name || name === oldName) return; try { await request(`/api/${kind}/${id}`, "PATCH", kind === "tags" ? { name, category_id: currentCategory ?? null } : { name }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Eintrag konnte nicht geändert werden."); } }
  async function remove(kind: "tags" | "categories", id: string, name: string) { if (!window.confirm(`„${name}“ wirklich löschen?`)) return; try { await request(`/api/${kind}/${id}`, "DELETE"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Eintrag konnte nicht gelöscht werden."); } }
  async function assign(tag: Tag, nextCategory: string) { try { await request(`/api/tags/${tag.id}`, "PATCH", { name: tag.name, category_id: nextCategory || null }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kategorie konnte nicht zugeordnet werden."); } }

  if (loading && !tags.length) return <div className="panel flex min-h-72 items-center justify-center text-sm text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Einstellungen werden geladen</div>;
  if (error && !tags.length) return <div className="panel p-8"><p className="text-sm font-semibold">Supabase-Verbindung erforderlich</p><p className="mt-2 text-sm text-zinc-500">{error}</p></div>;

  return <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
    <section className="panel self-start p-5"><div className="mb-5"><p className="text-sm font-semibold">Kategorien</p><p className="mt-1 text-xs text-zinc-600">Frei erstellen, umbenennen und löschen.</p></div><div className="mb-4 flex gap-2"><input className="field" placeholder="Neue Kategorie" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addCategory(); }} /><button onClick={() => void addCategory()} className="rounded-lg bg-lime px-4 text-ink"><FolderPlus className="h-4 w-4" /></button></div><div className="divide-y divide-line">{categories.map((category) => <div key={category.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{category.name}</p><p className="mt-0.5 text-[10px] text-zinc-600">{tags.filter((tag) => tag.category_id === category.id).length} Tags</p></div><div className="flex gap-1"><button aria-label="Kategorie umbenennen" onClick={() => void rename("categories", category.id, category.name)} className="rounded p-2 text-zinc-600 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button><button aria-label="Kategorie löschen" onClick={() => void remove("categories", category.id, category.name)} className="rounded p-2 text-zinc-600 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div></section>
    <section className="panel p-5"><div className="mb-5"><p className="text-sm font-semibold">Tags</p><p className="mt-1 text-xs text-zinc-600">Standardwerte sind vollständig veränderbar.</p></div><div className="mb-5 grid gap-2 sm:grid-cols-[1fr_220px_auto]"><input className="field" placeholder="Neuer Tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addTag(); }} /><select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Ohne Kategorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button onClick={() => void addTag()} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-lime px-4 text-xs font-bold text-ink"><Plus className="h-4 w-4" /> Hinzufügen</button></div>{error && <p className="mb-4 text-xs text-rose-400">{error}</p>}<div className="divide-y divide-line">{tags.map((tag) => <div key={tag.id} className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_220px_auto]"><div><p className="text-sm font-medium">{tag.name}</p>{tag.is_default && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-700">Startwert</p>}</div><select aria-label={`Kategorie für ${tag.name}`} className="field h-9" value={tag.category_id ?? ""} onChange={(e) => void assign(tag, e.target.value)}><option value="">Ohne Kategorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><div className="flex justify-end gap-1"><button aria-label="Tag umbenennen" onClick={() => void rename("tags", tag.id, tag.name, tag.category_id)} className="rounded p-2 text-zinc-600 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button><button aria-label="Tag löschen" onClick={() => void remove("tags", tag.id, tag.name)} className="rounded p-2 text-zinc-600 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div>
    </section>
  </div>;
}
