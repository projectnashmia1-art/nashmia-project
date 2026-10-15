import React, { useState } from "react";
import { Copy, Check, Users, Globe, Lock, Shield, Link as LinkIcon, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import { cn } from "@/lib/utils";
import type { DriveFile, DriveFolder } from "./documents-data";

interface ShareDocumentModalProps {
  item: DriveFile | DriveFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDocumentModal({ item, open, onOpenChange }: ShareDocumentModalProps) {
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");

  if (!item) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl =
    (item as DriveFile).url ||
    (item as DriveFile).metadata?.fileUrl ||
    `${origin}/documents?id=${encodeURIComponent(item.id)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard", {
      description: "Anyone with this link can view the document.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    toast.success(`Invitation sent to ${inviteEmail}`, {
      description: `Granted ${role} permissions for ${item.name}`,
    });
    setInviteEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="size-4 text-[#1D63ED]" /> Share &ldquo;{item.name}&rdquo;
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Manage sharing links and invite teammates to collaborate.
          </DialogDescription>
        </DialogHeader>

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="mt-2 space-y-3">
          <div className="flex gap-2 items-center">
            <Input
              type="email"
              placeholder="Add people, emails, or groups..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="text-xs h-9 flex-1"
            />
            <LifecycleDropdownSelect
              value={role}
              onChange={(val) => setRole(val as "viewer" | "editor")}
              options={[
                { value: "viewer", label: "Viewer" },
                { value: "editor", label: "Editor" },
              ]}
              placeholder="Role"
              size="sm"
              activeColor="blue"
              triggerClassName="h-9 w-28"
            />
            <Button
              type="submit"
              size="sm"
              className="bg-[#1D63ED] hover:bg-blue-700 text-white h-9 px-3 shrink-0"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </form>

        {/* General Access */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100/60 text-[#1D63ED]">
              <Globe className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">General Access</div>
              <div className="text-[11px] text-slate-500">Anyone with the link can view</div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 text-xs font-semibold text-[#1D63ED] border-blue-200 hover:bg-blue-50 gap-1.5"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Copy Link
              </>
            )}
          </Button>
        </div>

        {/* Link preview */}
        <div className="text-[11px] text-slate-400 truncate bg-slate-100/70 p-2 rounded-lg font-mono">
          {shareUrl}
        </div>
      </DialogContent>
    </Dialog>
  );
}
