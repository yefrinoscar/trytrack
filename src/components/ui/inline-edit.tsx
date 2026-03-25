import type { InputHTMLAttributes } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface InlineEditProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  label: string
  value: string
  displayValue: string
  onChange: (value: string) => void
  onSave?: (value: string) => void
}

export function InlineEdit({
  label,
  value,
  displayValue,
  onChange,
  onSave,
  className,
  ...props
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    if (tempValue !== value) {
      onChange(tempValue)
      onSave?.(tempValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setTempValue(value)
      setIsEditing(false)
    }
  }

  const startEditing = () => {
    setTempValue(value)
    setIsEditing(true)
  }

  return (
    <div className="group flex min-h-[3.25rem] flex-col justify-center py-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative min-h-[1.75rem]">
        {isEditing ? (
          <input
            ref={inputRef}
            {...props}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full bg-transparent px-0 py-0.5 text-sm font-medium text-foreground focus-visible:outline-none',
              className,
            )}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="flex w-full items-center gap-1.5 px-0 py-0.5 text-left hover:opacity-70 transition-opacity"
          >
            <span className="text-sm font-medium">{displayValue}</span>
          </button>
        )}
      </div>
    </div>
  )
}

interface InlineDateEditProps {
  label: string
  value: string
  displayValue: string
  onChange: (value: string) => void
  onSave?: (value: string) => void
}

export function InlineDateEdit({
  label,
  value,
  displayValue,
  onChange,
  onSave,
}: InlineDateEditProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = date.toISOString().slice(0, 10)
      onChange(dateStr)
      onSave?.(dateStr)
    }
    setIsOpen(false)
  }

  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined

  return (
    <div className="group flex min-h-[3.25rem] flex-col justify-center py-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-0 py-0.5 text-left hover:opacity-70 transition-opacity"
          >
            <span className="text-sm font-medium">{displayValue}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            captionLayout="dropdown"
            fromYear={2018}
            toYear={2035}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface InlineSelectProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  onSave?: (value: string) => void
}

export function InlineSelect({
  label,
  value,
  options,
  onChange,
  onSave,
}: InlineSelectProps) {
  const [isEditing, setIsEditing] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  const currentOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus()
    }
  }, [isEditing])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
    setIsEditing(false)
    onSave?.(e.target.value)
  }

  const handleBlur = () => {
    setIsEditing(false)
  }

  return (
    <div className="group flex min-h-[3.25rem] flex-col justify-center py-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative min-h-[1.75rem]">
        {isEditing ? (
          <select
            ref={selectRef}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full cursor-pointer bg-transparent px-0 py-0.5 text-sm font-medium text-foreground focus-visible:outline-none"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex w-full items-center gap-1.5 px-0 py-0.5 text-left hover:opacity-70 transition-opacity"
          >
            <span className="text-sm font-medium">
              {currentOption?.label || value}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
