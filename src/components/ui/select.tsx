import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type SelectProps = {
  className?: string
  children: React.ReactNode
  value?: string
  defaultValue?: string
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
  id?: string
  name?: string
  disabled?: boolean
  placeholder?: string
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      id,
      name,
      disabled,
      placeholder,
    },
    ref,
  ) => {
    const options = React.Children.toArray(children)
      .filter(
        (
          child,
        ): child is React.ReactElement<
          React.OptionHTMLAttributes<HTMLOptionElement>
        > => React.isValidElement(child) && child.type === 'option',
      )
      .map((option) => {
        const optionValue = String(
          option.props.value ?? option.props.children ?? '',
        )
        const optionLabel = option.props.children
        return {
          value: optionValue,
          label: optionLabel,
          disabled: option.props.disabled,
        }
      })

    return (
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={(nextValue) => {
          const event = {
            target: { value: nextValue },
            currentTarget: { value: nextValue },
          } as React.ChangeEvent<HTMLSelectElement>

          onChange?.(event)
        }}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-2 text-base text-[var(--foreground)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-[var(--foreground-faint)]',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 text-[var(--foreground-faint)]" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            className="z-[80] max-h-72 min-w-[8rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-elevated)] text-[var(--foreground)] shadow-xl"
          >
            <SelectPrimitive.ScrollUpButton className="flex h-8 items-center justify-center text-[var(--foreground-faint)]">
              <ChevronUp className="h-4 w-4" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="relative flex w-full cursor-default select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--surface-muted)] data-[highlighted]:text-[var(--foreground)]"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-3.5 w-3.5" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-8 items-center justify-center text-[var(--foreground-faint)]">
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    )
  },
)

Select.displayName = 'Select'

export { Select }
