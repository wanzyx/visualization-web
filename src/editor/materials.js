const cloneDeep = (value) => JSON.parse(JSON.stringify(value))

const defaultStyle = {
  background: 'rgba(7, 19, 40, 0.72)',
  borderColor: 'rgba(79, 227, 255, 0.3)',
  radius: 24,
  padding: 20,
  opacity: 1,
  rotate: 0
}

const library = {
  text: {
    type: 'text',
    label: '标题文本',
    description: '适合页面主标题和分区说明',
    icon: 'T',
    size: { w: 520, h: 88 },
    style: {
      background: 'transparent',
      borderColor: 'transparent',
      radius: 0,
      padding: 0,
      opacity: 1,
      rotate: 0
    },
    props: {
      text: '智慧园区运营驾驶舱',
      align: 'left',
      color: '#ecf7ff',
      fontSize: 42,
      fontWeight: 700,
      letterSpacing: 3,
      shadow: true
    }
  },
  stat: {
    type: 'stat',
    label: '指标卡片',
    description: '展示核心指标、单位和趋势',
    icon: '01',
    size: { w: 340, h: 188 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '实时订单',
      value: 12840,
      unit: '单',
      trend: 12.6,
      trendLabel: '较昨日',
      color: '#44e6ff',
      accent: '#84ffbf'
    }
  },
  barChart: {
    type: 'barChart',
    label: '柱状图',
    description: '适合流量、销量和区域分布',
    icon: '||',
    size: { w: 520, h: 320 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '渠道流量',
      categories: ['App', '小程序', '官网', '门店', '其他'],
      values: [92, 76, 54, 39, 22],
      color: '#46eeff'
    }
  },
  lineChart: {
    type: 'lineChart',
    label: '折线图',
    description: '适合趋势和时序指标',
    icon: '~',
    size: { w: 520, h: 320 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '近七日告警趋势',
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      values: [14, 28, 19, 33, 48, 30, 22],
      color: '#7bfecb',
      areaColor: 'rgba(123, 254, 203, 0.18)'
    }
  },
  gauge: {
    type: 'gauge',
    label: '环形进度',
    description: '适合在线率、达成率等指标',
    icon: 'G',
    size: { w: 280, h: 280 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '设备在线率',
      value: 86,
      color: '#5affbd',
      trackColor: 'rgba(255, 255, 255, 0.12)'
    }
  },
  panel: {
    type: 'panel',
    label: '装饰面板',
    description: '用于承载分区和说明内容',
    icon: '[]',
    size: { w: 420, h: 240 },
    style: {
      ...defaultStyle,
      background: 'linear-gradient(180deg, rgba(17, 44, 82, 0.84), rgba(6, 14, 30, 0.84))'
    },
    props: {
      title: '业务分区',
      subtitle: '支持作为信息容器使用',
      content: '你可以把这类面板当作版心区块，搭配图表和指标卡片组成完整大屏。'
    }
  }
}

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `widget-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const materials = Object.values(library)

export function getMaterial(type) {
  return library[type]
}

export function createWidget(type, overrides = {}) {
  const material = getMaterial(type)

  if (!material) {
    throw new Error(`Unknown material type: ${type}`)
  }

  return {
    id: createId(),
    type: material.type,
    name: material.label,
    groupId: null,
    locked: false,
    hidden: false,
    x: 80,
    y: 80,
    w: material.size.w,
    h: material.size.h,
    zIndex: 1,
    style: cloneDeep(material.style),
    props: cloneDeep(material.props),
    ...cloneDeep(overrides),
    style: {
      ...cloneDeep(material.style),
      ...(overrides.style ?? {})
    },
    props: {
      ...cloneDeep(material.props),
      ...(overrides.props ?? {})
    }
  }
}

export function cloneWidget(widget, overrides = {}) {
  return {
    ...cloneDeep(widget),
    id: createId(),
    ...cloneDeep(overrides)
  }
}
