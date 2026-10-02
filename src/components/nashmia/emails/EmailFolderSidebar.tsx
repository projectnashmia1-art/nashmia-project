import { useState } from "react";
import {
  Mail,
  Star,
  FileText,
  Send,
  Trash2,
  LayoutGrid,
  Folder,
  Plus,
  PenSquare,
  Sparkles,
  ChevronDown,
  Check,
} from "lucide-react";
import type { EmailFolderId, EmailFolderCount } from "@/types/email.types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface EmailFolderSidebarProps {
  selectedFolder: EmailFolderId | string;
  onSelectFolder: (folder: EmailFolderId) => void;
  folderCounts: EmailFolderCount;
  onOpenCompose?: () => void;
  activeFolderTag?: string | null;
  onSelectFolderTag?: (tag: string | null) => void;
}

export function EmailFolderSidebar({
  selectedFolder,
  onSelectFolder,
  folderCounts,
  onOpenCompose,
  activeFolderTag,
  onSelectFolderTag,
}: EmailFolderSidebarProps) {
  const { user, profile } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [customFolders, setCustomFolders] = useState([
    { id: "office", name: "Office", color: "text-blue-500 fill-blue-500" },
    { id: "personal", name: "Personal", color: "text-rose-500 fill-rose-500" },
    { id: "freelance", name: "Freelance", color: "text-amber-500 fill-amber-500" },
  ]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleAddFolder = () => {
    if (!newFolderName.trim()) {
      setIsAddingFolder(false);
      return;
    }
    const colors = [
      "text-indigo-500 fill-indigo-500",
      "text-emerald-500 fill-emerald-500",
      "text-purple-500 fill-purple-500",
      "text-cyan-500 fill-cyan-500",
    ];
    const pickedColor = colors[customFolders.length % colors.length];
    setCustomFolders((prev) => [
      ...prev,
      {
        id: newFolderName.toLowerCase().replace(/\s+/g, "-"),
        name: newFolderName.trim(),
        color: pickedColor,
      },
    ]);
    setNewFolderName("");
    setIsAddingFolder(false);
  };

  // Determine display name and email of the authenticated user
  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split("@")[0] : "Nashmia Logistics");
  const displayEmail = user?.email || profile?.email || "";
  const avatarLetter = (displayName[0] || user?.email?.[0] || "N").toUpperCase();
  const avatarUrl = profile?.avatar_url;

  // Inbox count for the pill badge
  const unreadCount = folderCounts.inbox;

  return (
    <aside className="w-full lg:w-[260px] xl:w-[280px] shrink-0 flex flex-col justify-between select-none py-2">
      <div className="space-y-7">
        {/* 1. User Profile Header */}
        <div className="flex items-center gap-3.5 px-2">
          <div className="relative size-12 shrink-0">
            <div className="grid size-12 place-items-center rounded-full bg-gradient-to-tr from-[#0FA3B1] to-[#078A99] font-bold text-white text-[16px] ring-2 ring-slate-100 shadow-xs">
              {avatarLetter}
            </div>
            <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-blue-600 truncate leading-tight tracking-tight">
              {displayName}
            </h2>
            <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
              {displayEmail || "Online"}
            </p>
          </div>
        </div>

        {/* 2. Main Navigation Menu */}
        <nav className="space-y-1 relative" aria-label="Mailbox folders">
          {/* Inbox */}
          <button
            type="button"
            onClick={() => {
              onSelectFolderTag?.(null);
              onSelectFolder("inbox");
            }}
            className={cn(
              "group relative w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] font-semibold transition-colors text-left",
              selectedFolder === "inbox" && !activeFolderTag
                ? "text-slate-900 bg-slate-50/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 font-medium",
            )}
          >
            {selectedFolder === "inbox" && !activeFolderTag && (
              <span className="absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-600 rounded-r-full" />
            )}
            <Mail
              className={cn(
                "size-5 transition-colors shrink-0",
                selectedFolder === "inbox" && !activeFolderTag
                  ? "text-blue-600"
                  : "text-slate-400 group-hover:text-slate-600",
              )}
            />
            <span className="truncate">Inbox</span>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FF334B] text-white shadow-xs">
              {unreadCount}
            </span>
          </button>

          {/* Flagged */}
          <button
            type="button"
            onClick={() => {
              onSelectFolderTag?.(null);
              onSelectFolder("all");
            }}
            className={cn(
              "group relative w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] transition-colors text-left",
              selectedFolder === "all" && !activeFolderTag
                ? "text-slate-900 bg-slate-50/80 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 font-medium",
            )}
          >
            {selectedFolder === "all" && !activeFolderTag && (
              <span className="absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-600 rounded-r-full" />
            )}
            <Star
              className={cn(
                "size-5 transition-colors shrink-0",
                selectedFolder === "all" && !activeFolderTag
                  ? "text-blue-600"
                  : "text-slate-400 group-hover:text-slate-600",
              )}
            />
            <span className="truncate">Flagged</span>
          </button>

          {/* Draft */}
          <button
            type="button"
            onClick={() => {
              onSelectFolderTag?.(null);
              onSelectFolder("drafts");
            }}
            className={cn(
              "group relative w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] transition-colors text-left",
              selectedFolder === "drafts" && !activeFolderTag
                ? "text-slate-900 bg-slate-50/80 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 font-medium",
            )}
          >
            {selectedFolder === "drafts" && !activeFolderTag && (
              <span className="absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-600 rounded-r-full" />
            )}
            <FileText
              className={cn(
                "size-5 transition-colors shrink-0",
                selectedFolder === "drafts" && !activeFolderTag
                  ? "text-blue-600"
                  : "text-slate-400 group-hover:text-slate-600",
              )}
            />
            <span className="truncate">Draft</span>
            {folderCounts.drafts > 0 && (
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {folderCounts.drafts}
              </span>
            )}
          </button>

          {/* Sent */}
          <button
            type="button"
            onClick={() => {
              onSelectFolderTag?.(null);
              onSelectFolder("sent");
            }}
            className={cn(
              "group relative w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] transition-colors text-left",
              selectedFolder === "sent" && !activeFolderTag
                ? "text-slate-900 bg-slate-50/80 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 font-medium",
            )}
          >
            {selectedFolder === "sent" && !activeFolderTag && (
              <span className="absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-600 rounded-r-full" />
            )}
            <Send
              className={cn(
                "size-5 transition-colors shrink-0",
                selectedFolder === "sent" && !activeFolderTag
                  ? "text-blue-600"
                  : "text-slate-400 group-hover:text-slate-600",
              )}
            />
            <span className="truncate">Sent</span>
            {folderCounts.sent > 0 && (
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {folderCounts.sent}
              </span>
            )}
          </button>

          {/* Trash */}
          <button
            type="button"
            onClick={() => {
              onSelectFolderTag?.(null);
              onSelectFolder("failed");
            }}
            className={cn(
              "group relative w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] transition-colors text-left",
              selectedFolder === "failed" && !activeFolderTag
                ? "text-slate-900 bg-slate-50/80 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 font-medium",
            )}
          >
            {selectedFolder === "failed" && !activeFolderTag && (
              <span className="absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-600 rounded-r-full" />
            )}
            <Trash2
              className={cn(
                "size-5 transition-colors shrink-0",
                selectedFolder === "failed" && !activeFolderTag
                  ? "text-blue-600"
                  : "text-slate-400 group-hover:text-slate-600",
              )}
            />
            <span className="truncate">Trash</span>
          </button>

          {/* More */}
          <button
            type="button"
            onClick={() => setIsMoreOpen((v) => !v)}
            className="group w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <LayoutGrid className="size-5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              <span>More</span>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-slate-400 transition-transform duration-200",
                isMoreOpen && "rotate-180",
              )}
            />
          </button>

          {/* Expanded More mailboxes */}
          {isMoreOpen && (
            <div className="pl-9 pr-2 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                type="button"
                onClick={() => {
                  onSelectFolderTag?.(null);
                  onSelectFolder("booking");
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between",
                  selectedFolder === "booking"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                <span>Booking Emails</span>
                <span className="text-[11px] text-slate-400">{folderCounts.booking}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectFolderTag?.(null);
                  onSelectFolder("pending");
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between",
                  selectedFolder === "pending"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                <span>Pending Outbox</span>
                <span className="text-[11px] text-slate-400">{folderCounts.pending}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectFolderTag?.(null);
                  onSelectFolder("system");
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between",
                  selectedFolder === "system"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                <span>System Audits</span>
                <span className="text-[11px] text-slate-400">{folderCounts.system}</span>
              </button>
            </div>
          )}
        </nav>

        {/* 3. Folders Section */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between px-3.5">
            <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">Folders</h3>
            <button
              type="button"
              onClick={() => setIsAddingFolder((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
            >
              <Plus className="size-3" />
              <span>Add</span>
            </button>
          </div>

          {/* Quick Add Folder input */}
          {isAddingFolder && (
            <div className="px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
                placeholder="Folder name..."
                autoFocus
                className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddFolder}
                className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <Check className="size-3" />
              </button>
            </div>
          )}

          {/* Custom Folders list matching the reference design */}
          <div className="space-y-0.5">
            {customFolders.map((folder) => {
              const isSelected = activeFolderTag === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    onSelectFolderTag?.(isSelected ? null : folder.id);
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-colors text-left",
                    isSelected
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/60",
                  )}
                >
                  <Folder className={cn("size-5 shrink-0", folder.color)} />
                  <span className="truncate">{folder.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Large Compose Button at Bottom */}
      <div className="pt-8 px-1 pb-2">
        <button
          type="button"
          onClick={onOpenCompose}
          className="w-full py-3.5 px-5 rounded-2xl bg-[#FF334B] hover:bg-[#F2243C] text-white text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-md shadow-red-500/20 active:scale-[0.99] transition-all cursor-pointer"
        >
          <PenSquare className="size-4 text-white stroke-[2.5]" />
          <span>Compose</span>
        </button>
      </div>
    </aside>
  );
}
