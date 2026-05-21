import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onChange, onKeyDown, onPaste, ...props }, ref) => {
  const isNumberInput = type === "number";

  const getSelection = (target) => {
    try {
      return {
        start: target.selectionStart ?? target.value.length,
        end: target.selectionEnd ?? target.value.length,
      };
    } catch {
      return { start: target.value.length, end: target.value.length };
    }
  };

  const setInputValue = (target, value) => {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(target, value);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const setCursor = (target, position) => {
    try {
      target.setSelectionRange(position, position);
    } catch {}
  };

  const insertDecimalPoint = (target) => {
    const { start, end } = getSelection(target);
    const nextValue = `${target.value.slice(0, start)}.${target.value.slice(end)}`;
    setInputValue(target, nextValue);
    requestAnimationFrame(() => {
      setCursor(target, start + 1);
    });
  };

  const handleKeyDown = (event) => {
    if (isNumberInput && event.key === ",") {
      event.preventDefault();
      insertDecimalPoint(event.currentTarget);
      return;
    }
    onKeyDown?.(event);
  };

  const handlePaste = (event) => {
    if (!isNumberInput) {
      onPaste?.(event);
      return;
    }

    const text = event.clipboardData?.getData("text");
    if (!text?.includes(",")) {
      onPaste?.(event);
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const { start, end } = getSelection(target);
    const normalizedText = text.replace(/,/g, ".");
    setInputValue(target, `${target.value.slice(0, start)}${normalizedText}${target.value.slice(end)}`);
    requestAnimationFrame(() => {
      setCursor(target, start + normalizedText.length);
    });
  };

  const handleChange = (event) => {
    if (isNumberInput && typeof event.target.value === "string" && event.target.value.includes(",")) {
      event.target.value = event.target.value.replace(/,/g, ".");
    }
    onChange?.(event);
  };

  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
