import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { Profile } from "@/types";

interface ProfilesPanelProps {
  profiles: Profile[];
  activeProfileId: string | null;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function ProfilesPanel({
  profiles,
  activeProfileId,
  onSwitch,
  onCreate,
  onRename,
  onDelete
}: ProfilesPanelProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function commitCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
  }

  function commitRename() {
    const name = editingName.trim();
    if (!editingId || !name) return;
    onRename(editingId, name);
    setEditingId(null);
    setEditingName("");
  }

  return (
    <aside className="lg:sticky lg:top-24">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-ink-faint">{t.profiles.title}</h2>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          commitCreate();
        }}
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={t.profiles.newPlaceholder}
          className="h-10"
        />
        <Button type="submit" variant="soft" size="icon" disabled={!newName.trim()} aria-label={t.profiles.add}>
          <Plus />
        </Button>
      </form>

      <ul className="mt-3 flex flex-col gap-1.5">
        {profiles.map((profile, index) => {
          const isActive = activeProfileId === profile.id;
          const isEditing = editingId === profile.id;

          return (
            <li key={profile.id} className="stagger" style={{ "--index": index } as React.CSSProperties}>
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename();
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    className="h-10"
                  />
                  <Button variant="soft" size="icon-sm" onClick={commitRename} aria-label={t.profiles.saveName}>
                    <Check />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(null)} aria-label={t.profiles.cancel}>
                    <X />
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-2xl border px-1.5 py-1 transition-colors duration-300 ease-out",
                    isActive ? "border-primary/40 bg-primary-soft" : "border-line bg-surface hover:border-line-strong"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSwitch(profile.id)}
                    className={cn(
                      "press min-w-0 flex-1 truncate rounded-xl px-2.5 py-2 text-start text-sm",
                      isActive ? "font-semibold text-primary" : "text-ink"
                    )}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {profile.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => {
                      setEditingId(profile.id);
                      setEditingName(profile.name);
                    }}
                    aria-label={`${t.profiles.rename}: ${profile.name}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-critical opacity-0 hover:bg-critical-soft focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => onDelete(profile.id)}
                    aria-label={`${t.profiles.delete}: ${profile.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
