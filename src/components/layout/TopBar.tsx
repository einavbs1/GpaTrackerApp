import { useRef } from "react";
import { Download, FileSpreadsheet, GraduationCap, LogOut, MoreVertical, Moon, Settings, Sun, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuFootnote,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/menu";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";

interface TopBarProps {
  userLabel: string;
  userInitial: string;
  lastModified: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onDownloadBackup: () => void;
  onExportExcel: () => void;
  onUploadBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TopBar({
  userLabel,
  userInitial,
  lastModified,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onSignOut,
  onDownloadBackup,
  onExportExcel,
  onUploadBackup
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="glass pt-safe px-safe sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <GraduationCap className="size-5" />
          </span>
          <h1 className="truncate text-base font-normal text-ink-strong sm:text-lg">{t.app.name}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="max-w-44 gap-2 px-2"
            onClick={onOpenSettings}
            title={t.topbar.accountSettings}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-ink">
              {userInitial}
            </span>
            <span className="hidden truncate sm:inline">{userLabel}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleTheme}
            aria-label={isDark ? t.topbar.toLight : t.topbar.toDark}
            title={isDark ? t.topbar.toLight : t.topbar.toDark}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t.topbar.dataAndBackups} title={t.topbar.dataAndBackups}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onDownloadBackup}>
                <Download /> {t.topbar.downloadBackup}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportExcel}>
                <FileSpreadsheet /> {t.topbar.exportExcel}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  // Keeping the menu's focus restore from stealing the file picker.
                  event.preventDefault();
                  fileInputRef.current?.click();
                }}
              >
                <Upload /> {t.topbar.uploadBackup}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenSettings}>
                <Settings /> {t.nav.settings}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuFootnote>
                {t.topbar.lastModified}: {formatDateTime(lastModified)}
              </DropdownMenuFootnote>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-sm"
            className="text-critical hover:bg-critical-soft"
            onClick={onSignOut}
            aria-label={t.topbar.signOut}
            title={t.topbar.signOut}
          >
            <LogOut />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onUploadBackup}
      />
    </header>
  );
}
