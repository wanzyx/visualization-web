<script setup>
import { computed, ref, watch } from 'vue'
import chinaGeoJson from '../../assets/china-geo.json'
import BaseEChart from './BaseEChart.vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  },
  previewMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['widget-command'])

const provinceNameAliases = Object.fromEntries([
  ['广东', '广东'],
  ['江苏', '江苏'],
  ['浙江', '浙江'],
  ['山东', '山东'],
  ['四川', '四川'],
  ['湖北', '湖北'],
  ['湖南', '湖南'],
  ['北京', '北京'],
  ['上海', '上海'],
  ['福建', '福建'],
  ['河南', '河南'],
  ['江西', '江西'],
  ['河北', '河北'],
  ['山西', '山西'],
  ['陕西', '陕西'],
  ['辽宁', '辽宁'],
  ['吉林', '吉林'],
  ['黑龙江', '黑龙江'],
  ['安徽', '安徽'],
  ['重庆', '重庆'],
  ['广西', '广西'],
  ['贵州', '贵州'],
  ['云南', '云南'],
  ['天津', '天津'],
  ['内蒙古', '内蒙古'],
  ['宁夏', '宁夏'],
  ['新疆', '新疆'],
  ['青海', '青海'],
  ['甘肃', '甘肃'],
  ['西藏', '西藏'],
  ['台湾', '台湾'],
  ['海南', '海南'],
  ['香港', '香港'],
  ['澳门', '澳门'],
  ['骞夸笢', '广东'],
  ['姹熻嫃', '江苏'],
  ['娴欐睙', '浙江'],
  ['灞变笢', '山东'],
  ['鍥涘窛', '四川'],
  ['婀栧寳', '湖北'],
  ['婀栧崡', '湖南'],
  ['鍖椾含', '北京'],
  ['涓婃捣', '上海'],
  ['绂忓缓', '福建'],
  ['娌冲崡', '河南'],
  ['姹熻タ', '江西'],
  ['娌冲寳', '河北'],
  ['灞辫タ', '山西'],
  ['闄曡タ', '陕西'],
  ['杈藉畞', '辽宁'],
  ['鍚夋灄', '吉林'],
  ['榛戦緳姹', '黑龙江'],
  ['瀹夊窘', '安徽'],
  ['閲嶅簡', '重庆'],
  ['骞胯タ', '广西'],
  ['璐靛窞', '贵州'],
  ['浜戝崡', '云南'],
  ['澶╂触', '天津'],
  ['鍐呰挋鍙', '内蒙古'],
  ['瀹佸', '宁夏'],
  ['鏂扮枂', '新疆'],
  ['闈掓捣', '青海'],
  ['鐢樿們', '甘肃'],
  ['瑗胯棌', '西藏'],
  ['鍙版咕', '台湾'],
  ['娴峰崡', '海南'],
  ['棣欐腐', '香港'],
  ['婢抽棬', '澳门']
])

const provinceSuffixes = [
  '维吾尔自治区',
  '壮族自治区',
  '回族自治区',
  '特别行政区',
  '自治区',
  '省',
  '市'
]

function normalizeProvinceName(name) {
  let normalized = String(name ?? '').trim().replace(/\s+/g, '')

  if (!normalized) {
    return ''
  }

  normalized = provinceNameAliases[normalized] ?? normalized

  provinceSuffixes.forEach((suffix) => {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length)
    }
  })

  return provinceNameAliases[normalized] ?? normalized
}

function toNumber(value, fallback = 0) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

function formatValue(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('zh-CN') : '--'
}

const provinceCoordinateMap = new Map(
  (Array.isArray(chinaGeoJson.features) ? chinaGeoJson.features : [])
    .map((feature) => {
      const normalizedName = normalizeProvinceName(feature?.properties?.name)
      const cp = feature?.properties?.cp
      const center = feature?.properties?.center
      const centroid = feature?.properties?.centroid
      const coordinate = Array.isArray(cp) ? cp : Array.isArray(center) ? center : centroid

      if (!normalizedName || !Array.isArray(coordinate) || coordinate.length < 2) {
        return null
      }

      return [normalizedName, [Number(coordinate[0]), Number(coordinate[1])]]
    })
    .filter(Boolean)
)

function getProvinceCoordinate(name) {
  return provinceCoordinateMap.get(normalizeProvinceName(name)) ?? null
}

const activeProvinceName = ref('')

watch(
  () => String(props.widget.props.activeProvince ?? '').trim(),
  (value) => {
    activeProvinceName.value = normalizeProvinceName(value)
  },
  { immediate: true }
)

const items = computed(() =>
  (Array.isArray(props.widget.props.items) ? props.widget.props.items : [])
    .map((item) => ({
      name: normalizeProvinceName(item?.name),
      value: Math.max(0, toNumber(item?.value))
    }))
    .filter((item) => item.name)
)

const pointItems = computed(() =>
  (Array.isArray(props.widget.props.points) ? props.widget.props.points : [])
    .map((item, index) => {
      const name = normalizeProvinceName(item?.name)
      const coordinate = getProvinceCoordinate(name)

      if (!name || !coordinate) {
        return null
      }

      return {
        name,
        value: Math.max(0, toNumber(item?.value)),
        category: String(item?.category ?? '').trim(),
        color: String(item?.color ?? '').trim(),
        size: Math.max(10, toNumber(item?.size, 14 + index)),
        coordinate
      }
    })
    .filter(Boolean)
)

const lineItems = computed(() =>
  (Array.isArray(props.widget.props.links) ? props.widget.props.links : [])
    .map((item) => {
      const from = normalizeProvinceName(item?.from)
      const to = normalizeProvinceName(item?.to)
      const fromCoordinate = getProvinceCoordinate(from)
      const toCoordinate = getProvinceCoordinate(to)

      if (!from || !to || !fromCoordinate || !toCoordinate) {
        return null
      }

      return {
        from,
        to,
        value: Math.max(0, toNumber(item?.value)),
        color: String(item?.color ?? '').trim(),
        coords: [fromCoordinate, toCoordinate]
      }
    })
    .filter(Boolean)
)

const totalValue = computed(() =>
  items.value.reduce((sum, item) => sum + Number(item.value ?? 0), 0)
)

const maxValue = computed(() => Math.max(1, ...items.value.map((item) => Number(item.value ?? 0))))
const showHeader = computed(() => props.widget.props.showHeader === true)

const summaryText = computed(() => {
  const unit = String(props.widget.props.unit ?? '').trim()
  return `覆盖 ${items.value.length} 个省级区域，累计 ${formatValue(totalValue.value)}${unit}`
})

const statusText = computed(() => {
  if (activeProvinceName.value) {
    return `已聚焦：${activeProvinceName.value}`
  }

  return props.widget.props.enableDrilldown === false ? '地图概览' : '点击省份聚焦'
})

const option = computed(() => {
  const title = String(props.widget.props.title || '中国地图').trim() || '中国地图'
  const unit = String(props.widget.props.unit || '').trim()
  const accent = String(props.widget.props.accent || '#7bfecb').trim() || '#7bfecb'
  const lowColor = String(props.widget.props.lowColor || 'rgba(70, 238, 255, 0.08)').trim()
  const highColor = String(props.widget.props.highColor || '#46eeff').trim() || '#46eeff'
  const showScatter = props.widget.props.showScatter !== false
  const showFlightLines = props.widget.props.showFlightLines !== false
  const enableDrilldown = props.widget.props.enableDrilldown !== false
  const activeName = activeProvinceName.value

  const series = [
    {
      name: title,
      type: 'map',
      map: 'china',
      geoIndex: 0,
      selectedMode: enableDrilldown ? 'single' : false,
      roam: false,
      data: items.value.map((item) => ({
        name: item.name,
        value: item.value,
        selected: item.name === activeName
      }))
    }
  ]

  if (showFlightLines && lineItems.value.length) {
    series.push({
      name: '飞线链路',
      type: 'lines',
      coordinateSystem: 'geo',
      zlevel: 2,
      effect: {
        show: true,
        period: 4.5,
        trailLength: 0.16,
        symbol: 'arrow',
        symbolSize: 7
      },
      lineStyle: {
        color: accent,
        width: 1.4,
        opacity: 0.42,
        curveness: 0.24
      },
      data: lineItems.value.map((item) => ({
        fromName: item.from,
        toName: item.to,
        value: item.value,
        coords: item.coords,
        lineStyle: item.color
          ? {
              color: item.color
            }
          : undefined
      }))
    })
  }

  if (showScatter && pointItems.value.length) {
    series.push({
      name: '重点节点',
      type: 'effectScatter',
      coordinateSystem: 'geo',
      zlevel: 3,
      showEffectOn: 'render',
      rippleEffect: {
        scale: 3,
        brushType: 'stroke'
      },
      label: {
        show: pointItems.value.length <= 10,
        position: 'right',
        color: '#effbff',
        fontSize: 11,
        formatter: '{b}'
      },
      itemStyle: {
        color: accent,
        shadowBlur: 18,
        shadowColor: 'rgba(70, 238, 255, 0.3)'
      },
      symbolSize: (value, params) =>
        params?.data?.size ?? Math.max(10, Math.sqrt(Number(value?.[2] ?? 0)) * 1.6),
      data: pointItems.value.map((item) => ({
        name: item.name,
        value: [...item.coordinate, item.value],
        size: item.size,
        category: item.category,
        itemStyle: item.color
          ? {
              color: item.color
            }
          : undefined
      }))
    })
  }

  return {
    animationDuration: 650,
    animationDurationUpdate: 260,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(4, 11, 22, 0.94)',
      borderColor: 'rgba(72, 220, 255, 0.18)',
      textStyle: {
        color: '#eff8ff'
      },
      formatter: (params) => {
        if (params?.seriesType === 'lines') {
          const value = Number(params?.data?.value ?? 0)
          return `${params?.data?.fromName ?? '--'} → ${params?.data?.toName ?? '--'}<br/>${formatValue(value)}${unit}`
        }

        if (params?.seriesType === 'effectScatter') {
          const value = Number(Array.isArray(params?.value) ? params.value[2] : params?.value ?? 0)
          const category = String(params?.data?.category ?? '').trim()
          return `${params?.name ?? '--'}<br/>${formatValue(value)}${unit}${category ? `<br/>${category}` : ''}`
        }

        const value = Number(params?.value ?? 0)
        return `${params?.name ?? '--'}<br/>${formatValue(value)}${unit}`
      }
    },
    visualMap: {
      show: showHeader.value && props.widget.props.showLegend !== false,
      min: 0,
      max: maxValue.value,
      orient: 'horizontal',
      left: 'center',
      bottom: 10,
      itemWidth: 112,
      itemHeight: 10,
      text: ['高', '低'],
      textGap: 10,
      calculable: false,
      textStyle: {
        color: 'rgba(235, 247, 255, 0.74)',
        fontSize: 11
      },
      inRange: {
        color: [lowColor, highColor]
      },
      seriesIndex: [0]
    },
    geo: {
      map: 'china',
      roam: false,
      layoutCenter: ['50%', '50%'],
      layoutSize: showHeader.value ? '108%' : '112%',
      label: {
        show: true,
        color: 'rgba(235, 247, 255, 0.72)',
        fontSize: 10
      },
      emphasis: {
        label: {
          color: '#ffffff',
          fontWeight: 700
        },
        itemStyle: {
          areaColor: accent,
          borderColor: '#f3fbff',
          borderWidth: 1.2,
          shadowBlur: 22,
          shadowColor: 'rgba(70, 238, 255, 0.28)'
        }
      },
      select: {
        label: {
          color: '#ffffff',
          fontWeight: 700
        },
        itemStyle: {
          areaColor: accent,
          borderColor: '#f3fbff',
          borderWidth: 1.3,
          shadowBlur: 28,
          shadowColor: 'rgba(70, 238, 255, 0.32)'
        }
      },
      itemStyle: {
        areaColor: 'rgba(11, 29, 53, 0.95)',
        borderColor: 'rgba(121, 228, 255, 0.58)',
        borderWidth: 1
      }
    },
    series
  }
})

function handleChartClick(params) {
  if (props.widget.props.enableDrilldown === false || !params) {
    return
  }

  if (!['map', 'effectScatter'].includes(String(params.seriesType || ''))) {
    return
  }

  const nextProvince = normalizeProvinceName(params?.name)

  if (!nextProvince || !provinceCoordinateMap.has(nextProvince)) {
    return
  }

  const nextActiveProvince = activeProvinceName.value === nextProvince ? '' : nextProvince
  activeProvinceName.value = nextActiveProvince

  emit('widget-command', {
    command: 'select-region',
    value: nextActiveProvince,
    label: nextActiveProvince
  })
}

const mapStyle = computed(() => ({
  '--china-map-accent': String(props.widget.props.accent || '#7bfecb').trim() || '#7bfecb'
}))
</script>

<template>
  <div class="widget-china-map" :style="mapStyle">
    <div class="widget-china-map__chart">
      <div v-if="showHeader" class="widget-china-map__head">
        <div class="widget-china-map__copy">
          <h3>{{ widget.props.title }}</h3>
          <p>{{ summaryText }}</p>
        </div>

        <div class="widget-china-map__meta">
          <div v-if="widget.props.showLegend !== false" class="widget-china-map__legend">
            <span>热度分布</span>
            <i />
          </div>
          <span class="widget-china-map__badge" :class="{ 'is-active': Boolean(activeProvinceName) }">
            {{ statusText }}
          </span>
        </div>
      </div>

      <BaseEChart runtime="china-map" :option="option" @chart-click="handleChartClick" />
    </div>
  </div>
</template>
