/**
 * Audit log action keys. The log stores the key; the console shows the label from
 * messages/en.json (admin.audit.actions). Unknown keys are shown as stored.
 */
export const AUDIT_ACTIONS = [
  "signed_in",
  "signed_out",
  "password_reset",
  "room_closed",
  "room_advanced",
  "pack_created",
  "pack_edited",
  "pack_deleted",
  "question_added",
  "questions_added",
  "questions_imported",
  "question_edited",
  "question_hidden",
  "question_shown",
  "question_deleted",
  "report_dismissed",
  "player_removed",
  "message_status",
  "settings_changed",
  "flag_changed",
  "admin_added",
  "admin_role_changed",
  "admin_removed",
  "admin_password_reset",
  "account_edited",
  "password_changed",
  "data_reset",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
