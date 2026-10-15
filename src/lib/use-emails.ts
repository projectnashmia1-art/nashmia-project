import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  fetchEmailsFromSupabase,
  calculateEmailStatistics,
  calculateFolderCounts,
  saveDraftEmailInSupabase,
  sendEmailThroughBackend,
  retrySendEmailInSupabase,
} from "./email-services";
import type {
  EmailMessageRecord,
  EmailStatistics,
  EmailFolderCount,
  EmailFolderId,
  ComposeEmailFormValues,
} from "@/types/email.types";
import { useAuth } from "./auth-context";
import { showPillToast } from "./pill-toast";

export const EMAILS_QUERY_KEY = ["emails"];

/**
 * Real-time Supabase hook for Emails page
 */
export function useEmails(selectedFolder: EmailFolderId = "all") {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...EMAILS_QUERY_KEY, userId],
    queryFn: () => fetchEmailsFromSupabase(userId),
    staleTime: 1000, // 1 second - ensure instant freshness
    refetchInterval: 3000, // Fast 3s polling for real-time incoming emails
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });

  // Real-time synchronization with window events and storage
  useEffect(() => {
    const handleUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
    };

    window.addEventListener("nashmia_booking_confirmed", handleUpdate);
    window.addEventListener("nashmia_booking_status_updated", handleUpdate);
    window.addEventListener("supabase_realtime_bookings_change", handleUpdate);
    window.addEventListener("nashmia_bookings_updated", handleUpdate);
    window.addEventListener("nashmia_emails_updated", handleUpdate);
    window.addEventListener("nashmia:email-sent", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_booking_confirmed", handleUpdate);
      window.removeEventListener("nashmia_booking_status_updated", handleUpdate);
      window.removeEventListener("supabase_realtime_bookings_change", handleUpdate);
      window.removeEventListener("nashmia_bookings_updated", handleUpdate);
      window.removeEventListener("nashmia_emails_updated", handleUpdate);
      window.removeEventListener("nashmia:email-sent", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [queryClient]);

  // Supabase Realtime subscription for instant live updates
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("realtime-email-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_threads",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const allEmails = query.data || [];

  // Filter emails based on the active folder
  const filteredEmails = useMemo(() => {
    return allEmails.filter((email) => {
      switch (selectedFolder) {
        case "inbox":
          return email.direction === "inbound";
        case "sent":
          return email.status === "SENT";
        case "drafts":
          return email.status === "DRAFT";
        case "pending":
          return email.status === "PENDING" || email.status === "SENDING";
        case "failed":
          return email.status === "FAILED" || email.status === "CANCELLED";
        case "booking":
          return email.emailType.startsWith("BOOKING_") || Boolean(email.bookingId);
        case "system":
          return email.emailType === "SYSTEM";
        case "all":
        default:
          return true;
      }
    });
  }, [allEmails, selectedFolder]);

  const statistics: EmailStatistics = useMemo(
    () => calculateEmailStatistics(allEmails),
    [allEmails],
  );
  const folderCounts: EmailFolderCount = useMemo(
    () => calculateFolderCounts(allEmails),
    [allEmails],
  );

  return {
    ...query,
    allEmails,
    emails: filteredEmails,
    statistics,
    folderCounts,
  };
}

/**
 * Mutation for sending an email
 */
export function useSendEmail() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: (values: ComposeEmailFormValues) => sendEmailThroughBackend(userId, values),
    onSuccess: (result, values) => {
      queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
      if (result.success) {
        // Dispatch custom event for real-time notification integration
        if (typeof window !== "undefined") {
          const match = `${values.subject} ${values.body}`.match(
            /\b(BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|GD-[A-Z0-9-]+)\b/i,
          );
          const bookingRef = match ? match[0].toUpperCase() : undefined;

          window.dispatchEvent(
            new CustomEvent("nashmia:email-sent", {
              detail: {
                id: result.emailId || result.gmailMessageId,
                toEmail: values.toEmail,
                toName: values.toName,
                subject: values.subject,
                snippet: values.body ? values.body.slice(0, 100) : values.subject,
                bookingReference: bookingRef,
              },
            }),
          );
        }
      } else {
        const isQuota =
          result.errorMessage?.includes("Quota") ||
          result.errorMessage?.includes("rateLimit") ||
          result.errorMessage?.includes("Units per minute");

        if (isQuota) {
          showPillToast.info(
            "Gmail per-minute user limit reached on Google Cloud. Your message is recorded and queued.",
            "Email Queued (Quota Cooldown)",
          );
        } else {
          showPillToast.error(
            result.errorMessage || "Unable to complete Gmail API delivery.",
            "Email Transmission Failed",
          );
        }
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      const isQuota =
        msg.includes("Quota") || msg.includes("rateLimit") || msg.includes("Units per minute");

      if (isQuota) {
        showPillToast.info(
          "Google Cloud per-minute user limit reached. Please wait ~60s before sending again.",
          "Google API Quota Window Active",
        );
      } else {
        showPillToast.error(msg, "Failed to Send Email");
      }
    },
  });
}

/**
 * Mutation for saving draft
 */
export function useSaveDraft() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: (values: ComposeEmailFormValues) => saveDraftEmailInSupabase(userId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
      showPillToast.build("Your message has been safely saved to drafts.", "Draft Saved");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not save draft to database.";
      showPillToast.error(msg, "Failed to Save Draft");
    },
  });
}

/**
 * Mutation for retrying failed email
 */
export function useRetryEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: EmailMessageRecord) => retrySendEmailInSupabase(email),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
      if (res.success) {
        showPillToast.build(
          "Transmission completed via backend.",
          "Email Retried & Sent Successfully",
        );
      } else {
        showPillToast.error(res.errorMessage || "Could not send email.", "Retry Attempt Failed");
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to contact email dispatch service.";
      showPillToast.error(msg, "Retry Failed");
    },
  });
}
