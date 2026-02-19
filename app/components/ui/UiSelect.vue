<script setup lang="ts">
interface UiSelectOption {
  value: string
  label: string
  description?: string
  swatch?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: UiSelectOption[]
  placeholder?: string
  disabled?: boolean
  mobileTitle?: string
}>(), {
  placeholder: 'Select an option',
  disabled: false,
  mobileTitle: 'Select'
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const highlightedIndex = ref(-1)
const isMobile = ref(false)
const menuPlacement = ref<'down' | 'up'>('down')

const selectedOption = computed(() => {
  return props.options.find(option => option.value === props.modelValue) || null
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

function closeMenu() {
  open.value = false
}

function updateMenuPlacement() {
  if (!import.meta.client || !rootRef.value || isMobile.value) {
    menuPlacement.value = 'down'
    return
  }

  const rect = rootRef.value.getBoundingClientRect()
  const optionRows = Math.min(props.options.length, 8)
  const estimatedMenuHeight = optionRows * 46 + 14
  const spaceBelow = window.innerHeight - rect.bottom - 10
  const spaceAbove = rect.top - 10

  if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
    menuPlacement.value = 'up'
    return
  }

  menuPlacement.value = 'down'
}

function openMenu() {
  if (props.disabled || !props.options.length) {
    return
  }

  open.value = true
  updateMenuPlacement()

  const selectedIndex = props.options.findIndex(option => option.value === props.modelValue)
  highlightedIndex.value = selectedIndex >= 0 ? selectedIndex : 0
}

function toggleMenu() {
  if (open.value) {
    closeMenu()
    return
  }

  openMenu()
}

function selectOption(option: UiSelectOption) {
  emit('update:modelValue', option.value)
  closeMenu()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  if (!open.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    openMenu()
    return
  }

  if (!open.value) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(props.options.length - 1, highlightedIndex.value + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(0, highlightedIndex.value - 1)
    return
  }

  if (event.key === 'Enter' && highlightedIndex.value >= 0) {
    event.preventDefault()
    const option = props.options[highlightedIndex.value]
    if (option) {
      selectOption(option)
    }
  }
}

function handleOutsideClick(event: MouseEvent | TouchEvent) {
  if (!open.value || !rootRef.value) {
    return
  }

  if (rootRef.value.contains(event.target as Node)) {
    return
  }

  closeMenu()
}

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
  window.addEventListener('resize', setViewportMode)
  window.addEventListener('scroll', updateMenuPlacement, { passive: true })
  document.addEventListener('mousedown', handleOutsideClick)
  document.addEventListener('touchstart', handleOutsideClick)
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', setViewportMode)
    window.removeEventListener('scroll', updateMenuPlacement)
    document.removeEventListener('mousedown', handleOutsideClick)
    document.removeEventListener('touchstart', handleOutsideClick)
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
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <span class="flex min-w-0 items-center gap-2">
        <span
          v-if="selectedOption?.swatch"
          class="ui-select-swatch"
          :style="{ background: selectedOption.swatch }"
        ></span>
        <span class="truncate">{{ selectedOption?.label || placeholder }}</span>
      </span>
      <span class="ui-select-chevron" :class="{ 'rotate-180': open }">⌄</span>
    </button>

    <transition name="ui-fade-up">
      <div
        v-if="open && !isMobile"
        class="ui-select-menu desktop"
        :class="{ 'is-upward': menuPlacement === 'up' }"
        role="listbox"
      >
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          class="ui-select-option"
          :class="{
            'is-selected': option.value === modelValue,
            'is-highlighted': index === highlightedIndex
          }"
          @mouseenter="highlightedIndex = index"
          @click="selectOption(option)"
        >
          <span class="flex items-center gap-2">
            <span
              v-if="option.swatch"
              class="ui-select-swatch"
              :style="{ background: option.swatch }"
            ></span>
            <span class="ui-select-option-label">{{ option.label }}</span>
          </span>
          <span v-if="option.description" class="ui-select-option-desc">{{ option.description }}</span>
        </button>
      </div>
    </transition>

    <Teleport to="body">
      <transition name="ui-fade-up">
        <div v-if="open && isMobile" class="ui-sheet-backdrop" @click.self="closeMenu">
          <div class="ui-sheet-panel">
            <div class="ui-sheet-header">
              <p>{{ mobileTitle }}</p>
              <button type="button" class="ui-sheet-close" @click="closeMenu">Close</button>
            </div>

            <div class="ui-sheet-options">
              <button
                v-for="option in options"
                :key="option.value"
                type="button"
                class="ui-select-option"
                :class="{ 'is-selected': option.value === modelValue }"
                @click="selectOption(option)"
              >
                <span class="flex items-center gap-2">
                  <span
                    v-if="option.swatch"
                    class="ui-select-swatch"
                    :style="{ background: option.swatch }"
                  ></span>
                  <span class="ui-select-option-label">{{ option.label }}</span>
                </span>
                <span v-if="option.description" class="ui-select-option-desc">{{ option.description }}</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
