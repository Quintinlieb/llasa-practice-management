export type MentionRecipient = {
  label: string;
  recipientUserId: string;
  token: string;
};

const mentionRegex = /(^|[\s(>])@([A-Za-z0-9_.-]+)(?=$|[\s).,!?:;])/g;

export const extractMentionTokens = (value: string) => {
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(String(value || ""))) !== null) {
    const token = String(match[2] || "").trim().toLowerCase();
    if (token) tokens.add(token);
  }
  return Array.from(tokens);
};

export const resolveMentionRecipients = (
  value: string,
  options: MentionRecipient[],
  currentUserId: string,
) => {
  const tokens = new Set(extractMentionTokens(value));
  const seenRecipientIds = new Set<string>();

  return options.filter((option) => {
    const recipientUserId = String(option.recipientUserId || "").trim();
    const token = String(option.token || "").trim().toLowerCase();
    if (!recipientUserId || !token || recipientUserId === currentUserId) return false;
    if (!tokens.has(token) || seenRecipientIds.has(recipientUserId)) return false;
    seenRecipientIds.add(recipientUserId);
    return true;
  });
};
