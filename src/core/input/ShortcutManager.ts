export interface ShortcutBinding {
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export class ShortcutManager {
  private bindings: ShortcutBinding[] = [];
  private attached = false;

  register(binding: ShortcutBinding): void {
    this.bindings.push(binding);
  }

  registerMany(bindings: ShortcutBinding[]): void {
    this.bindings.push(...bindings);
  }

  attach(): void {
    if (this.attached || typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleKeyDown);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached || typeof window === "undefined") return;
    window.removeEventListener("keydown", this.handleKeyDown);
    this.attached = false;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isEditableTarget(e.target)) {
      return;
    }

    const pressedKey = e.key.toLowerCase();
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    for (const binding of this.bindings) {
      const expectCtrl = Boolean(binding.ctrlOrMeta);
      const expectShift = Boolean(binding.shift);
      const expectAlt = Boolean(binding.alt);

      if (
        binding.key.toLowerCase() === pressedKey &&
        ctrlOrMeta === expectCtrl &&
        e.shiftKey === expectShift &&
        e.altKey === expectAlt
      ) {
        e.preventDefault();
        binding.action();
        return;
      }
    }
  };

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }
}
