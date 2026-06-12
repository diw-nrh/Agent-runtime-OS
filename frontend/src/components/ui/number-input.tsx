import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronDown } from "lucide-react"

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: number | string;
  onChange?: (value: number | string) => void;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, min, max, step = 1, disabled, placeholder, ...props }, ref) => {
    
    const handleIncrement = () => {
      if (disabled) return;
      
      let currentValue = value === '' || value === undefined ? 0 : Number(value);
      if (isNaN(currentValue)) currentValue = 0;
      
      let newValue = currentValue + Number(step);
      if (max !== undefined && newValue > Number(max)) newValue = Number(max);
      
      if (onChange) onChange(newValue);
    }
    
    const handleDecrement = () => {
      if (disabled) return;
      
      let currentValue = value === '' || value === undefined ? 0 : Number(value);
      if (isNaN(currentValue)) currentValue = 0;
      
      let newValue = currentValue - Number(step);
      if (min !== undefined && newValue < Number(min)) newValue = Number(min);
      
      if (onChange) onChange(newValue);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    }

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <input
          type="number"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={value}
          onChange={handleChange}
          ref={ref}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          {...props}
        />
        <div className="absolute right-1 flex flex-col h-[calc(100%-8px)] w-6 border-l border-border/50 pl-1">
          <button 
            type="button" 
            onClick={handleIncrement} 
            disabled={disabled}
            className="flex flex-1 items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground rounded-tr-sm transition-colors disabled:opacity-50 focus:outline-none"
            tabIndex={-1}
          >
            <ChevronUp size={12} strokeWidth={2.5} />
          </button>
          <button 
            type="button" 
            onClick={handleDecrement} 
            disabled={disabled}
            className="flex flex-1 items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground rounded-br-sm transition-colors disabled:opacity-50 focus:outline-none"
            tabIndex={-1}
          >
            <ChevronDown size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }
)
NumberInput.displayName = "NumberInput"
