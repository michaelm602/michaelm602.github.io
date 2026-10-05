const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function trapFocusWithin(event, container, activeElement) {
  if (event?.key !== "Tab" || !container) return false;

  const focusableElements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus?.();
    return true;
  }

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const focusIsOutside = !container.contains(activeElement);

  if (event.shiftKey && (activeElement === first || focusIsOutside)) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}
