import { Command as CommandPrimitive } from "cmdk";
import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import type { MultiSelectOption } from "@/atom";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

export default function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: MultiSelectOption[];
  onChange: (value: MultiSelectOption[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Portal into the wrapper so the popup stays inside modals (z-index, Radix Dialog focus/pointer-events).
  const wrapper = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);

  const isSelected = (o: MultiSelectOption) =>
    value.some((v) => v.value === o.value);
  const remove = (o: MultiSelectOption) =>
    onChange(value.filter((v) => v.value !== o.value));
  const toggle = (o: MultiSelectOption) =>
    isSelected(o) ? remove(o) : onChange([...value, o]);

  return (
    <div ref={wrapper} className={className}>
      <Command className="h-auto overflow-visible bg-transparent">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div
              ref={anchor}
              className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-1.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30"
            >
              {value.map((o) => (
                <span
                  key={o.value}
                  className="flex h-5.5 w-fit items-center gap-1 rounded-sm bg-muted pl-1.5 text-xs font-medium whitespace-nowrap text-foreground"
                >
                  {o.label}
                  <button
                    type="button"
                    aria-label={`Remove ${o.label}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => remove(o)}
                    className="px-1 opacity-50 hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !query && value.length)
                    remove(value[value.length - 1]);
                }}
                placeholder={placeholder}
                className="min-w-16 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            container={wrapper.current}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (anchor.current?.contains(e.target as Node))
                e.preventDefault();
            }}
          >
            <CommandList className="max-h-60 p-1">
              <CommandEmpty>No results found.</CommandEmpty>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => toggle(o)}
                  className="justify-between"
                >
                  {o.label}
                  {isSelected(o) && <Check />}
                </CommandItem>
              ))}
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
    </div>
  );
}
