import type { Command } from "../types";

export function cmdId(): string {
  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeCommand(partial: Omit<Command, "id"> & { id?: string }): Command {
  return { ...partial, id: partial.id || cmdId() };
}

export function statusLabel(status: string): string {
  if (status === "queued") return "排队中";
  if (status === "queued_uploaded") return "排队中（已上传）";
  if (status === "sent") return "发送完毕";
  if (status === "failed") return "失败";
  return status;
}
