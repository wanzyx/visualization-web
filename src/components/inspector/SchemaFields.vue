<script setup>
const props = defineProps({
  fields: {
    type: Array,
    default: () => []
  },
  model: {
    type: Object,
    default: null
  }
})

function getByPath(target, path) {
  if (!target || !path) {
    return undefined
  }

  return path.split('.').reduce((current, key) => current?.[key], target)
}

function setByPath(target, path, value) {
  if (!target || !path) {
    return
  }

  const keys = path.split('.')
  let current = target

  while (keys.length > 1) {
    const key = keys.shift()

    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }

    current = current[key]
  }

  current[keys[0]] = value
}

function readField(field) {
  if (typeof field.get === 'function') {
    return field.get(props.model)
  }

  const value = getByPath(props.model, field.path)

  if (value === undefined || value === null) {
    if (field.type === 'checkbox') {
      return false
    }

    return field.defaultValue ?? ''
  }

  return value
}

function writeField(field, rawValue) {
  let value = rawValue

  if (field.type === 'number') {
    const parsed = Number(rawValue)

    if (!Number.isFinite(parsed)) {
      return
    }

    value = parsed
  }

  if (typeof field.set === 'function') {
    field.set(value, props.model)
    return
  }

  setByPath(props.model, field.path, value)
}

function getFieldKey(field, index) {
  return field.key || field.path || field.label || `field-${index}`
}

function getFieldClass(field) {
  return [
    'schema-field',
    field.span === 'half' ? 'schema-field--half' : 'schema-field--full',
    field.type === 'checkbox' ? 'schema-field--checkbox' : ''
  ]
}
</script>

<template>
  <div class="schema-fields">
    <template v-for="(field, index) in fields" :key="getFieldKey(field, index)">
      <label v-if="field.type === 'checkbox'" :class="getFieldClass(field)">
        <input
          type="checkbox"
          :checked="Boolean(readField(field))"
          :disabled="field.disabled"
          @change="writeField(field, $event.target.checked)"
        />
        <span>{{ field.label }}</span>
      </label>

      <label v-else :class="getFieldClass(field)">
        <span>{{ field.label }}</span>

        <textarea
          v-if="field.type === 'textarea'"
          :value="readField(field)"
          :rows="field.rows ?? 4"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          @input="writeField(field, $event.target.value)"
        />

        <select
          v-else-if="field.type === 'select'"
          :value="readField(field)"
          :disabled="field.disabled"
          @change="writeField(field, $event.target.value)"
        >
          <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <input
          v-else
          :type="field.type ?? 'text'"
          :value="readField(field)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          @input="field.type === 'number' ? undefined : writeField(field, $event.target.value)"
          @change="field.type === 'number' ? writeField(field, $event.target.value) : undefined"
        />
      </label>
    </template>
  </div>
</template>
