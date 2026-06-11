import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = "Select an option",
  icon,
  className = "",
  disabled = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Find the selected option's label
  let selectedLabel = placeholder;
  if (groups.length > 0) {
    for (const group of groups) {
      const opt = group.options.find(o => o.value === value);
      if (opt) {
        selectedLabel = opt.label;
        break;
      }
    }
  } else {
    const opt = options.find(o => o.value === value);
    if (opt) {
      selectedLabel = opt.label;
    }
  }

  const hasGroups = groups.length > 0;
  const itemsToRender = hasGroups ? groups : [{ label: '', options }];

  return (
    <div 
      className={`relative ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      ref={containerRef}
    >
      <div 
        className={`w-full ${icon ? 'pl-9' : 'pl-4'} pr-4 py-2 border border-border rounded-md bg-background hover:bg-muted/50 shadow-sm text-sm font-medium flex justify-between items-center transition-all ${disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
            {icon}
          </div>
        )}
        <span className="truncate pr-2">{selectedLabel}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180 text-foreground' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1 bg-card rounded-md shadow-xl border border-border z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-150">
          {itemsToRender.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.label && (
                <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0 backdrop-blur-md z-10 border-b border-border">
                  {group.label}
                </div>
              )}
              <div className="p-1 flex flex-col gap-0.5">
                {group.options.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground text-center">No options</div>
                ) : (
                  group.options.map(opt => (
                    <button
                      key={opt.value}
                      disabled={opt.disabled}
                      className={`w-full text-left px-2 py-2 text-sm rounded-md transition-all flex items-center gap-2 ${
                        value === opt.value 
                          ? 'bg-primary/20 text-primary font-semibold' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      } ${opt.disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground' : ''}`}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === opt.value ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]' : 'bg-transparent'}`} />
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
