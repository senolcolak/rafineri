'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <label
        className={cn(
          'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
          props.checked ? 'bg-primary' : 'bg-input',
          className
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          ref={ref}
          {...props}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            props.checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
