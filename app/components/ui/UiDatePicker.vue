<script setup lang="ts">
interface CalendarDay {
  isoDate: string
  dayNumber: number
  isToday: boolean
  isSelected: boolean
  disabled: boolean
}

interface CalendarCell {
  key: string
  placeholder: boolean
  day?: CalendarDay
}

const props = withDefaults(defineProps<{
  modelValue: string
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  mobileTitle?: string
}>(), {
  min: '',
  max: '',
  disabled: false,
  placeholder: 'Select date',
  mobileTitle: 'Select date'
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const isMobile = ref(false)
const menuPlacement = ref<'down' | 'up'>('down')
const monthTransitionName = ref<'ui-month-forward' | 'ui-month-backward'>('ui-month-forward')

const todayIso = new Date().toISOString().slice(0, 10)

function parseIsoDate(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null
  }

  const [yearString, monthString, dayString] = isoDate.split('-')
  const year = Number.parseInt(yearString, 10)
  const month = Number.parseInt(monthString, 10)
  const day = Number.parseInt(dayString, 10)

  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function toIsoDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

const selectedDate = computed(() => parseIsoDate(props.modelValue))

const initialMonth = selectedDate.value
  ? new Date(Date.UTC(selectedDate.value.getUTCFullYear(), selectedDate.value.getUTCMonth(), 1))
  : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))

const displayMonth = ref(initialMonth)

const displayMonthLabel = computed(() => {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(displayMonth.value)
})

const selectedLabel = computed(() => {
  if (!selectedDate.value) {
    return props.placeholder
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(selectedDate.value)
})

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const calendarCells = computed<CalendarCell[]>(() => {
  const startOfMonth = new Date(Date.UTC(
    displayMonth.value.getUTCFullYear(),
    displayMonth.value.getUTCMonth(),
    1
  ))

  const startOffset = startOfMonth.getUTCDay()
  const daysInMonth = new Date(Date.UTC(
    displayMonth.value.getUTCFullYear(),
    displayMonth.value.getUTCMonth() + 1,
    0
  )).getUTCDate()

  const cells: CalendarCell[] = []

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({
      key: `lead-${index}`,
      placeholder: true
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayDate = new Date(Date.UTC(
      displayMonth.value.getUTCFullYear(),
      displayMonth.value.getUTCMonth(),
      day
    ))
    const isoDate = toIsoDate(dayDate)

    const disabled = Boolean(
      (props.min && isoDate < props.min)
      || (props.max && isoDate > props.max)
    )

    cells.push({
      key: isoDate,
      placeholder: false,
      day: {
        isoDate,
        dayNumber: day,
        isToday: isoDate === todayIso,
        isSelected: isoDate === props.modelValue,
        disabled
      }
    })
  }

  const trailingCount = (7 - (cells.length % 7)) % 7

  for (let index = 0; index < trailingCount; index += 1) {
    cells.push({
      key: `trail-${index}`,
      placeholder: true
    })
  }

  return cells
})

function setViewportMode() {
  if (!import.meta.client) {
    return
  }

  isMobile.value = window.innerWidth < 768

  if (open.value) {
    updateMenuPlacement()
  }
}

function openPicker() {
  if (props.disabled) {
    return
  }

  open.value = true
  updateMenuPlacement()
}

function closePicker() {
  open.value = false
}

function togglePicker() {
  if (open.value) {
    closePicker()
    return
  }

  openPicker()
}

function selectDate(day: CalendarDay) {
  if (day.disabled) {
    return
  }

  emit('update:modelValue', day.isoDate)
  closePicker()
}

function shiftMonth(offset: number) {
  monthTransitionName.value = offset >= 0 ? 'ui-month-forward' : 'ui-month-backward'

  const next = new Date(Date.UTC(
    displayMonth.value.getUTCFullYear(),
    displayMonth.value.getUTCMonth() + offset,
    1
  ))

  displayMonth.value = next
}

function updateMenuPlacement() {
  if (!import.meta.client || !rootRef.value || isMobile.value) {
    menuPlacement.value = 'down'
    return
  }

  const rect = rootRef.value.getBoundingClientRect()
  const estimatedMenuHeight = 340
  const spaceBelow = window.innerHeight - rect.bottom - 10
  const spaceAbove = rect.top - 10

  if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
    menuPlacement.value = 'up'
    return
  }

  menuPlacement.value = 'down'
}

function syncDisplayMonthToSelection() {
  if (!selectedDate.value) {
    return
  }

  displayMonth.value = new Date(Date.UTC(
    selectedDate.value.getUTCFullYear(),
    selectedDate.value.getUTCMonth(),
    1
  ))
}

function handleOutsideClick(event: MouseEvent | TouchEvent) {
  if (!open.value || !rootRef.value) {
    return
  }

  if (rootRef.value.contains(event.target as Node)) {
    return
  }

  closePicker()
}

function handleKeydown(event: KeyboardEvent) {
  if (!open.value) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closePicker()
  }
}

watch(() => props.modelValue, () => {
  syncDisplayMonthToSelection()
})

watch([open, isMobile], ([isOpen, mobile]) => {
  if (!import.meta.client) {
    return
  }

  if (isOpen && mobile) {
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = ''
})

onMounted(() => {
  setViewportMode()
  syncDisplayMonthToSelection()

  window.addEventListener('resize', setViewportMode)
  window.addEventListener('scroll', updateMenuPlacement, { passive: true })
  document.addEventListener('mousedown', handleOutsideClick)
  document.addEventListener('touchstart', handleOutsideClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', setViewportMode)
    window.removeEventListener('scroll', updateMenuPlacement)
    document.removeEventListener('mousedown', handleOutsideClick)
    document.removeEventListener('touchstart', handleOutsideClick)
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
})

watch(open, (isOpen) => {
  if (isOpen) {
    updateMenuPlacement()
  }
})
</script>

<template>
  <div ref="rootRef" class="relative" :class="{ 'ui-overlay-root': open }">
    <button
      type="button"
      class="ui-select-trigger"
      :class="{ 'opacity-60 cursor-not-allowed': disabled }"
      :disabled="disabled"
      @click="togglePicker"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <span class="ui-select-chevron" :class="{ 'rotate-180': open }">⌄</span>
    </button>

    <transition name="ui-fade-up">
      <div v-if="open && !isMobile" class="ui-date-menu desktop" :class="{ 'is-upward': menuPlacement === 'up' }">
        <div class="ui-date-header">
          <button type="button" class="ui-date-nav" @click="shiftMonth(-1)">‹</button>
          <p>{{ displayMonthLabel }}</p>
          <button type="button" class="ui-date-nav" @click="shiftMonth(1)">›</button>
        </div>

        <transition :name="monthTransitionName" mode="out-in">
          <div :key="displayMonthLabel">
            <div class="ui-date-grid-labels">
              <span v-for="day in weekDays" :key="day">{{ day }}</span>
            </div>

            <div class="ui-date-grid-days">
              <template v-for="cell in calendarCells" :key="cell.key">
                <div v-if="cell.placeholder" class="ui-date-day is-placeholder" aria-hidden="true"></div>
                <button
                  v-else-if="cell.day"
                  type="button"
                  class="ui-date-day"
                  :class="{
                    'is-today': cell.day.isToday,
                    'is-selected': cell.day.isSelected,
                    'is-disabled': cell.day.disabled
                  }"
                  :disabled="cell.day.disabled"
                  @click="selectDate(cell.day)"
                >
                  {{ cell.day.dayNumber }}
                </button>
              </template>
            </div>
          </div>
        </transition>
      </div>
    </transition>

    <Teleport to="body">
      <transition name="ui-fade-up">
        <div v-if="open && isMobile" class="ui-sheet-backdrop" @click.self="closePicker">
          <div class="ui-sheet-panel">
            <div class="ui-sheet-header">
              <p>{{ mobileTitle }}</p>
              <button type="button" class="ui-sheet-close" @click="closePicker">Close</button>
            </div>

            <div class="ui-date-header">
              <button type="button" class="ui-date-nav" @click="shiftMonth(-1)">‹</button>
              <p>{{ displayMonthLabel }}</p>
              <button type="button" class="ui-date-nav" @click="shiftMonth(1)">›</button>
            </div>

            <transition :name="monthTransitionName" mode="out-in">
              <div :key="`mobile-${displayMonthLabel}`">
                <div class="ui-date-grid-labels">
                  <span v-for="day in weekDays" :key="day">{{ day }}</span>
                </div>

                <div class="ui-date-grid-days">
                  <template v-for="cell in calendarCells" :key="`mobile-${cell.key}`">
                    <div v-if="cell.placeholder" class="ui-date-day is-placeholder" aria-hidden="true"></div>
                    <button
                      v-else-if="cell.day"
                      type="button"
                      class="ui-date-day"
                      :class="{
                        'is-today': cell.day.isToday,
                        'is-selected': cell.day.isSelected,
                        'is-disabled': cell.day.disabled
                      }"
                      :disabled="cell.day.disabled"
                      @click="selectDate(cell.day)"
                    >
                      {{ cell.day.dayNumber }}
                    </button>
                  </template>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
