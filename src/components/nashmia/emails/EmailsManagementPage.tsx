import { useState, useEffect, useMemo } from "react";
import {
  Mail,
  Plus,
  Send,
  FileEdit,
  Clock,
  AlertCircle,
  Menu,
  RotateCcw,
  Sparkles,
  Inbox,
} from "lucide-react";
import { useEmails, useRetryEmail } from "@/lib/use-emails";
import { EmailFolderSidebar } from "./EmailFolderSidebar";
import { EmailListPanel } from "./EmailListPanel";
import { EmailPreviewPanel } from "./EmailPreviewPanel";
import { ComposeEmailModal } from "./ComposeEmailModal";
import { GmailConnectionBanner } from "./GmailConnectionBanner";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import type { EmailFolderId, EmailMessageRecord } from "@/types/email.types";
import { cn } from "@/lib/utils";

interface EmailsManagementPageProps {
  onOpenMobileMenu?: () => void;
}

export function EmailsManagementPage({ onOpenMobileMenu }: EmailsManagementPageProps) {
  const [selectedFolder, setSelectedFolder] = useState<EmailFolderId>("all");
  const [activeFolderTag, setActiveFolderTag] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessageRecord | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState<EmailMessageRecord | null>(null);

  const { emails, allEmails, statistics, folderCounts, isLoading, isError, refetch } =
    useEmails(selectedFolder);

  const retryMutation = useRetryEmail();

  // Filter emails when custom folder tag (office, personal, freelance) is active
  const displayedEmails = useMemo(() => {
    if (!activeFolderTag) return emails;
    const tag = activeFolderTag.toLowerCase();
    return emails.filter((e) => {
      const text =
        `${e.subject} ${e.body} ${e.snippet || ""} ${e.toName || ""} ${e.fromName || ""}`.toLowerCase();
      return text.includes(tag);
    });
  }, [emails, activeFolderTag]);

  // Support URL query parameters (?emailId=..., ?movement=..., ?threadId=...) to preselect the email
  useEffect(() => {
    if (typeof window === "undefined" || allEmails.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const paramEmailId = params.get("emailId");
      const paramMovement = params.get("movement");
      const paramThreadId = params.get("threadId");

      if (paramEmailId) {
        const found = allEmails.find(
          (e) => e.id === paramEmailId || e.gmailMessageId === paramEmailId,
        );
        if (found) {
          setSelectedEmail(found);
          return;
        }
      }

      if (paramThreadId) {
        const found = allEmails.find((e) => e.gmailThreadId === paramThreadId);
        if (found) {
          setSelectedEmail(found);
          return;
        }
      }

      if (paramMovement) {
        const found = allEmails.find(
          (e) =>
            e.movementNumber?.toLowerCase() === paramMovement.toLowerCase() ||
            e.bookingReference?.toLowerCase() === paramMovement.toLowerCase(),
        );
        if (found) {
          setSelectedEmail(found);
          return;
        }
      }
    } catch {
      // ignore
    }
  }, [allEmails]);

  // Automatically select the first email when loaded if none is selected or when switching folders
  useEffect(() => {
    if (displayedEmails.length === 0) {
      setSelectedEmail(null);
      return;
    }

    setSelectedEmail((prev) => {
      if (!prev) return displayedEmails[0];
      const match = displayedEmails.find((e) => e.id === prev.id);
      return match || displayedEmails[0];
    });
  }, [displayedEmails]);

  const handleOpenCompose = () => {
    setDraftToEdit(null);
    setIsComposeOpen(true);
  };

  const handleOpenDraft = (draft: EmailMessageRecord) => {
    setDraftToEdit(draft);
    setIsComposeOpen(true);
  };

  const handleRetryEmail = (email: EmailMessageRecord) => {
    retryMutation.mutate(email);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="size-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Emails
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage booking requests, sent emails, drafts and correspondence.
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-xs shrink-0 disabled:opacity-50"
            title="Refresh All Emails"
          >
            <RotateCcw className={cn("size-3.5", isLoading && "animate-spin text-blue-600")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCompose}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF334B] hover:bg-[#F2243C] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-red-500/20 shrink-0"
          >
            <Plus className="size-4 text-white stroke-[2.5]" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Gmail Google Workspace Integration Status */}
      <GmailConnectionBanner onRefreshEmails={refetch} />

      {/* 3. Main Three-Section Email Interface Matching the Reference Design */}
      {isError ? (
        <div className="p-12 rounded-2xl border border-red-200 bg-red-50 text-center space-y-3">
          <AlertCircle className="size-8 text-red-600 mx-auto" />
          <h3 className="text-sm font-bold text-red-900">Unable to load emails</h3>
          <p className="text-xs text-red-700 max-w-sm mx-auto">
            Failed to connect to the database. Check your connection or credentials.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
          >
            <RotateCcw className="size-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-stretch gap-6 min-h-[720px] lg:h-[calc(100vh-190px)]">
          {/* Left Folder Navigation (Desktop) */}
          <div className="hidden lg:flex shrink-0">
            <EmailFolderSidebar
              selectedFolder={selectedFolder}
              onSelectFolder={(f) => {
                setActiveFolderTag(null);
                setSelectedFolder(f);
              }}
              folderCounts={folderCounts}
              onOpenCompose={handleOpenCompose}
              activeFolderTag={activeFolderTag}
              onSelectFolderTag={(tag) => setActiveFolderTag(tag)}
            />
          </div>

          {/* Mobile Folder Selector Dropdown */}
          <div className="lg:hidden w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white gap-3">
            <span className="text-xs font-bold text-slate-700">Mailbox:</span>
            <LifecycleDropdownSelect
              value={selectedFolder}
              onChange={(val) => setSelectedFolder(val as EmailFolderId)}
              options={[
                { value: "all", label: `All Emails (${folderCounts.all})` },
                { value: "inbox", label: `Inbox (${folderCounts.inbox})` },
                { value: "sent", label: `Sent (${folderCounts.sent})` },
                { value: "drafts", label: `Drafts (${folderCounts.drafts})` },
                { value: "pending", label: `Pending (${folderCounts.pending})` },
                { value: "failed", label: `Failed (${folderCounts.failed})` },
                { value: "booking", label: `Booking Emails (${folderCounts.booking})` },
                { value: "system", label: `System Emails (${folderCounts.system})` },
              ]}
              placeholder="Select Mailbox"
              size="sm"
              activeColor="teal"
              className="flex-1 max-w-xs"
              triggerClassName="w-full"
            />
          </div>

          {/* Center Email List Panel */}
          <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 h-full flex flex-col">
            <EmailListPanel
              emails={displayedEmails}
              selectedEmailId={selectedEmail?.id || null}
              onSelectEmail={setSelectedEmail}
              isLoading={isLoading}
              onOpenComposeDraft={handleOpenDraft}
              onRetryEmail={handleRetryEmail}
            />
          </div>

          {/* Right Email Preview Panel */}
          <div className="w-full lg:flex-1 h-full flex flex-col">
            <EmailPreviewPanel
              email={selectedEmail}
              allEmails={allEmails}
              isLoading={isLoading}
              onSelectEmail={setSelectedEmail}
              onRetry={handleRetryEmail}
              onOpenDraftModal={handleOpenDraft}
              isRetrying={retryMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Compose & Edit Draft Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        initialDraft={draftToEdit}
      />
    </div>
  );
}
