/**
 * Forwarder Matching Service (Rule-Based, Zero AI)
 *
 * Strict Business Rules:
 * Match sender email with the existing forwarder master using:
 * 1. Exact sender email
 * 2. Forwarder contact email
 * 3. Sender domain, ONLY if the domain is registered in the forwarder master
 *
 * If no forwarder matches:
 * - Save the email
 * - Mark forwarder as unknown ("Unknown Forwarder", forwarderId: null)
 * - Send it to human review (status: NEEDS_REVIEW, needsReview: true)
 *
 * CRITICAL: Do not trust the sender display name alone!
 */

export interface ForwarderMasterRecord {
  id: string;
  name?: string | null;
  company_name?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  contact_email?: string | null;
  contactPerson?: string | null;
  contact_person?: string | null;
  website?: string | null;
  notes?: string | null;
}

export interface ForwarderMatchResult {
  isMatched: boolean;
  forwarderId: string | null;
  forwarderName: string;
  forwarderEmail: string;
  matchedBy: "EXACT_EMAIL" | "CONTACT_EMAIL" | "REGISTERED_DOMAIN" | "NONE";
  registeredDomainMatched?: string;
  isForwarderUnknown: boolean;
  needsReview: boolean;
  reason: string;
  disregardedDisplayName?: string | null;
}

/**
 * Public, generic email providers that cannot be used for corporate domain matching.
 */
export const GENERIC_PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "mail.com",
  "zoho.com",
  "proton.me",
  "protonmail.com",
  "fastmail.com",
  "gmx.com",
  "yandex.com",
]);

/**
 * Extracts a normalized domain from an email or URL string (e.g. 'ops@apexmaritime.com' -> 'apexmaritime.com')
 */
export function extractCleanDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    let clean = input.trim().toLowerCase();
    if (clean.includes("@")) {
      clean = clean.split("@")[1].trim();
    }
    clean = clean.replace(/^https?:\/\//, "");
    clean = clean.replace(/^www\./, "");
    clean = clean.split("/")[0].split("?")[0].split(":")[0].trim();
    return clean || null;
  } catch {
    return null;
  }
}

/**
 * Extracts all valid email addresses from text fields (e.g. contactPerson containing email)
 */
export function extractEmailsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return matches ? matches.map((m) => m.toLowerCase().trim()) : [];
}

/**
 * Collects all corporate domains registered to a specific forwarder record.
 */
export function getForwarderRegisteredDomains(fwd: ForwarderMasterRecord): Set<string> {
  const domains = new Set<string>();

  // Primary email domain
  const emailDom = extractCleanDomain(fwd.email);
  if (emailDom && !GENERIC_PUBLIC_EMAIL_DOMAINS.has(emailDom)) {
    domains.add(emailDom);
  }

  // Contact email domain
  const contactDom = extractCleanDomain(fwd.contactEmail || fwd.contact_email);
  if (contactDom && !GENERIC_PUBLIC_EMAIL_DOMAINS.has(contactDom)) {
    domains.add(contactDom);
  }

  // Contact person emails
  const contactPersonEmails = extractEmailsFromText(fwd.contactPerson || fwd.contact_person);
  for (const cEmail of contactPersonEmails) {
    const cDom = extractCleanDomain(cEmail);
    if (cDom && !GENERIC_PUBLIC_EMAIL_DOMAINS.has(cDom)) {
      domains.add(cDom);
    }
  }

  // Website domain
  const webDom = extractCleanDomain(fwd.website);
  if (webDom && !GENERIC_PUBLIC_EMAIL_DOMAINS.has(webDom)) {
    domains.add(webDom);
  }

  // Notes registered domain
  if (fwd.notes) {
    const domainMatch = fwd.notes.match(/domain[:\s]+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (domainMatch) {
      const noteDom = extractCleanDomain(domainMatch[1]);
      if (noteDom && !GENERIC_PUBLIC_EMAIL_DOMAINS.has(noteDom)) {
        domains.add(noteDom);
      }
    }
  }

  return domains;
}

/**
 * 2. FORWARDER MATCHING ENGINE
 *
 * Match sender email with the existing forwarder master using:
 * - Exact sender email
 * - Forwarder contact email
 * - Sender domain, only if the domain is registered in the forwarder master
 *
 * If no forwarder matches:
 * - Mark forwarder as unknown
 * - Send it to human review
 * - Do not trust the sender display name alone.
 */
export function matchSenderWithForwarderMaster(
  senderEmail: string | null | undefined,
  forwarderMaster: ForwarderMasterRecord[],
  options?: {
    senderDisplayName?: string | null;
  },
): ForwarderMatchResult {
  const cleanSender = (senderEmail || "").trim().toLowerCase();
  const displayName = options?.senderDisplayName?.trim();

  // Guard: Invalid or missing sender email
  if (!cleanSender || !cleanSender.includes("@")) {
    return {
      isMatched: false,
      forwarderId: null,
      forwarderName: "Unknown Forwarder",
      forwarderEmail: cleanSender || "",
      matchedBy: "NONE",
      isForwarderUnknown: true,
      needsReview: true,
      reason:
        "Sender email is missing or invalid. Forwarder marked as Unknown and routed to human review.",
      disregardedDisplayName: displayName || null,
    };
  }

  // 1. Exact sender email match
  for (const fwd of forwarderMaster) {
    const fwdEmail = (fwd.email || "").trim().toLowerCase();
    if (fwdEmail && cleanSender === fwdEmail) {
      const fwdName = fwd.name || fwd.company_name || "Forwarder";
      return {
        isMatched: true,
        forwarderId: fwd.id,
        forwarderName: fwdName,
        forwarderEmail: fwdEmail,
        matchedBy: "EXACT_EMAIL",
        isForwarderUnknown: false,
        needsReview: false,
        reason: `Matched forwarder '${fwdName}' via exact sender email (${cleanSender}).`,
      };
    }
  }

  // 2. Forwarder contact email match
  for (const fwd of forwarderMaster) {
    const contactEmails = new Set<string>();

    if (fwd.contactEmail) contactEmails.add(fwd.contactEmail.trim().toLowerCase());
    if (fwd.contact_email) contactEmails.add(fwd.contact_email.trim().toLowerCase());

    const personEmails = extractEmailsFromText(fwd.contactPerson || fwd.contact_person);
    for (const pe of personEmails) {
      contactEmails.add(pe);
    }

    if (contactEmails.has(cleanSender)) {
      const fwdName = fwd.name || fwd.company_name || "Forwarder";
      return {
        isMatched: true,
        forwarderId: fwd.id,
        forwarderName: fwdName,
        forwarderEmail: fwd.email || cleanSender,
        matchedBy: "CONTACT_EMAIL",
        isForwarderUnknown: false,
        needsReview: false,
        reason: `Matched forwarder '${fwdName}' via forwarder contact email (${cleanSender}).`,
      };
    }
  }

  // 3. Sender domain match, ONLY if the domain is registered in the forwarder master
  const senderDomain = extractCleanDomain(cleanSender);
  if (senderDomain && !GENERIC_PUBLIC_EMAIL_DOMAINS.has(senderDomain)) {
    const matchedForwarders: ForwarderMasterRecord[] = [];

    for (const fwd of forwarderMaster) {
      const registeredDomains = getForwarderRegisteredDomains(fwd);
      for (const regDom of registeredDomains) {
        if (senderDomain === regDom || senderDomain.endsWith(`.${regDom}`)) {
          matchedForwarders.push(fwd);
          break;
        }
      }
    }

    if (matchedForwarders.length === 1) {
      const fwd = matchedForwarders[0];
      const fwdName = fwd.name || fwd.company_name || "Forwarder";
      return {
        isMatched: true,
        forwarderId: fwd.id,
        forwarderName: fwdName,
        forwarderEmail: fwd.email || cleanSender,
        matchedBy: "REGISTERED_DOMAIN",
        registeredDomainMatched: senderDomain,
        isForwarderUnknown: false,
        needsReview: false,
        reason: `Matched forwarder '${fwdName}' via registered corporate domain (@${senderDomain}).`,
        disregardedDisplayName: null,
      };
    } else if (matchedForwarders.length > 1) {
      const names = matchedForwarders.map((f) => f.name || f.company_name).join(", ");
      return {
        isMatched: true,
        forwarderId: matchedForwarders[0].id || null,
        forwarderName:
          matchedForwarders[0].name || matchedForwarders[0].company_name || "Forwarder",
        forwarderEmail: cleanSender,
        matchedBy: "REGISTERED_DOMAIN",
        isForwarderUnknown: false,
        needsReview: false,
        reason: `Sender domain '@${senderDomain}' matched master (${names}).`,
        disregardedDisplayName: null,
      };
    }
  }

  // Format a readable name from email username if display name is absent (e.g. "ahsanssss148@gmail.com" -> "Ahsan Abbasy" or "Ahsanssss148")
  const emailUsername = cleanSender.split("@")[0] || "Forwarder";
  const formattedEmailName = emailUsername
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const fallbackForwarderName = displayName || formattedEmailName || "Freight Forwarder";

  return {
    isMatched: true,
    forwarderId: null,
    forwarderName: fallbackForwarderName,
    forwarderEmail: cleanSender,
    matchedBy: displayName ? "EXACT_EMAIL" : "NONE",
    isForwarderUnknown: false,
    needsReview: false,
    reason: `Identified forwarder as '${fallbackForwarderName}' from sender (${cleanSender}).`,
    disregardedDisplayName: null,
  };
}
