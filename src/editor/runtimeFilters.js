function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function hasField(item, field) {
  return Boolean(item) && typeof item === 'object' && !Array.isArray(item) && field in item
}

function matchesFilterValue(actualValue, expectedValue) {
  const normalizedExpected = normalizeText(expectedValue)

  if (!normalizedExpected) {
    return true
  }

  if (Array.isArray(actualValue)) {
    return actualValue.some((item) => normalizeText(item) === normalizedExpected)
  }

  if (actualValue === undefined || actualValue === null) {
    return false
  }

  return normalizeText(actualValue) === normalizedExpected
}

function toObjectList(source) {
  return Array.isArray(source)
    ? source.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    : []
}

function getApplicableFilters(collection, filters) {
  const list = toObjectList(collection)

  if (!list.length) {
    return []
  }

  return filters.filter((filter) => list.some((item) => hasField(item, filter.field)))
}

function filterObjectCollection(collection, filters) {
  const list = toObjectList(collection)
  const applicableFilters = getApplicableFilters(list, filters)

  if (!applicableFilters.length) {
    return Array.isArray(collection) ? collection : []
  }

  return list.filter((item) =>
    applicableFilters.every((filter) => matchesFilterValue(item?.[filter.field], filter.value))
  )
}

export function getWidgetRuntimeFilters(widgetId, runtimeFilters) {
  return Object.values(runtimeFilters ?? {}).filter((filter) => {
    if (!filter?.field || !String(filter.value ?? '').trim()) {
      return false
    }

    const targetWidgetIds = Array.isArray(filter.targetWidgetIds) ? filter.targetWidgetIds : []
    return !targetWidgetIds.length || targetWidgetIds.includes(widgetId)
  })
}

export function applyWidgetRuntimeFilters(widget, runtimeFilters = []) {
  if (!widget || !runtimeFilters.length) {
    return widget?.props ?? {}
  }

  const props = widget.props ?? {}

  switch (widget.type) {
    case 'rankingList':
    case 'chinaRegionMap':
    case 'timelinePanel':
      return {
        ...props,
        items: filterObjectCollection(props.items, runtimeFilters)
      }
    case 'dataTable':
      return {
        ...props,
        rows: filterObjectCollection(props.rows, runtimeFilters)
      }
    default:
      return props
  }
}
