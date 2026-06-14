"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = "text", ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full px-3 py-2 border rounded-lg shadow-sm transition-colors",
            "text-gray-900 dark:text-[#F8FAFC] placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-[#0F172A]",
            "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500",
            "border-gray-300 dark:border-[#1E293B]",
            error ? "border-red-500 dark:border-red-500" : "",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
