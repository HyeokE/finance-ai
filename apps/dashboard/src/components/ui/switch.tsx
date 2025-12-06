import * as React from 'react';
import { cn } from '../../lib/utils';

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        ref={ref}
        className={cn('peer sr-only', className)}
        {...props}
      />
      <div className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-blue-600"></div>
      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5 shadow" />
    </label>
  );
});
Switch.displayName = 'Switch';
