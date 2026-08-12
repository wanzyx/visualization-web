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
  digitStat: {
    type: 'digitStat',
    label: '数字翻牌',
    description: '适合大屏核心数值、金额、总量和实时计数展示',
    icon: '888',
    size: { w: 420, h: 210 },
    style: {
      ...defaultStyle,
      background: 'linear-gradient(180deg, rgba(10, 25, 46, 0.86), rgba(4, 10, 20, 0.82))'
    },
    props: {
      title: '今日交易额',
      value: 1284068,
      unit: '元',
      tag: 'REALTIME',
      prefix: '¥',
      suffix: '',
      decimals: 0,
      groupSeparator: true,
      color: '#ecf7ff',
      accent: '#46eeff',
      unitColor: 'rgba(235, 247, 255, 0.72)'
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
  heatmapChart: {
    type: 'heatmapChart',
    label: '区域热力图',
    description: '适合展示区域活跃度、时段密度和站点热度分布',
    icon: 'HT',
    size: { w: 560, h: 340 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '区域活跃热力',
      xLabels: ['东区', '西区', '南区', '北区', '中枢'],
      yLabels: ['00:00', '06:00', '12:00', '18:00'],
      values: [
        [12, 18, 9, 6, 22],
        [22, 31, 16, 12, 35],
        [30, 42, 28, 20, 48],
        [18, 26, 19, 14, 29]
      ],
      lowColor: 'rgba(70, 238, 255, 0.08)',
      highColor: '#46eeff',
      showValues: true
    }
  },
  chinaRegionMap: {
    type: 'chinaRegionMap',
    label: '\u4e2d\u56fd\u5730\u56fe',
    description:
      '\u9002\u5408\u5c55\u793a\u7701\u7ea7\u70ed\u5ea6\u5206\u5e03\uff0c\u5e76\u53ef\u53e0\u52a0\u6563\u70b9\u3001\u98de\u7ebf\u548c\u70b9\u51fb\u4e0b\u94bb\u3002',
    icon: 'CN',
    size: { w: 620, h: 360 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '\u5168\u56fd\u4e1a\u52a1\u5206\u5e03',
      unit: '\u70b9',
      lowColor: 'rgba(70, 238, 255, 0.08)',
      highColor: '#46eeff',
      accent: '#7bfecb',
      showLegend: true,
      enableDrilldown: true,
      showScatter: true,
      showFlightLines: true,
      activeProvince: '',
      items: [
        { name: '\u5e7f\u4e1c', value: 96 },
        { name: '\u6c5f\u82cf', value: 88 },
        { name: '\u6d59\u6c5f', value: 84 },
        { name: '\u5c71\u4e1c', value: 76 },
        { name: '\u56db\u5ddd', value: 69 },
        { name: '\u6e56\u5317', value: 63 },
        { name: '\u5317\u4eac', value: 58 },
        { name: '\u4e0a\u6d77', value: 55 },
        { name: '\u798f\u5efa', value: 49 },
        { name: '\u6cb3\u5357', value: 45 }
      ],
      points: [
        { name: '\u5317\u4eac', value: 82, category: '\u67a2\u7ebd', color: '#46eeff', size: 18 },
        { name: '\u4e0a\u6d77', value: 76, category: '\u95e8\u6237', color: '#7bfecb', size: 16 },
        { name: '\u5e7f\u4e1c', value: 91, category: '\u4ea4\u6613', color: '#ffd66b', size: 18 },
        { name: '\u56db\u5ddd', value: 63, category: '\u4e2d\u8f6c', color: '#6d8bff', size: 15 }
      ],
      links: [
        { from: '\u5317\u4eac', to: '\u4e0a\u6d77', value: 128, color: 'rgba(70, 238, 255, 0.75)' },
        { from: '\u5e7f\u4e1c', to: '\u56db\u5ddd', value: 96, color: 'rgba(123, 254, 203, 0.7)' },
        { from: '\u6e56\u5317', to: '\u6d59\u6c5f', value: 74, color: 'rgba(255, 214, 107, 0.72)' }
      ]
    }
  },
  pieChart: {
    type: 'pieChart',
    label: '饼图',
    description: '适合占比、构成和分类分析',
    icon: 'PIE',
    size: { w: 420, h: 320 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '业务构成',
      categories: ['零售', '服务', '供应链', '其他'],
      values: [38, 26, 21, 15],
      colors: ['#46eeff', '#7bfecb', '#ffd66b', '#6d8bff']
    }
  },
  rankingList: {
    type: 'rankingList',
    label: '排行列表',
    description: '适合展示榜单、区域排名和 TOP 数据',
    icon: '#',
    size: { w: 420, h: 320 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '区域排名',
      unit: '分',
      accent: '#46eeff',
      items: [
        { name: '浦东新区', value: 98 },
        { name: '黄浦区', value: 92 },
        { name: '徐汇区', value: 88 },
        { name: '长宁区', value: 81 },
        { name: '静安区', value: 76 }
      ]
    }
  },
  image: {
    type: 'image',
    label: '图片',
    description: '适合品牌标识、背景图、示意图和海报',
    icon: 'Img',
    size: { w: 360, h: 220 },
    style: {
      ...defaultStyle,
      padding: 12
    },
    props: {
      src: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
      alt: '智慧园区示意图',
      caption: '园区运营总览',
      objectFit: 'cover',
      showCaption: true
    }
  },
  video: {
    type: 'video',
    label: '视频',
    description: '适合宣传片、监控轮播和演示视频',
    icon: 'Vid',
    size: { w: 420, h: 260 },
    style: {
      ...defaultStyle,
      padding: 12
    },
    props: {
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      poster:
        'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
      title: '园区宣传视频',
      objectFit: 'cover',
      autoplay: true,
      loop: true,
      muted: true,
      controls: true
    }
  },
  iframe: {
    type: 'iframe',
    label: '网页嵌入',
    description: '适合挂载地图、BI 看板、监控页和外部业务系统',
    icon: 'Web',
    size: { w: 520, h: 340 },
    style: {
      ...defaultStyle,
      padding: 12
    },
    props: {
      src: 'https://www.openstreetmap.org/export/embed.html?bbox=121.441%2C31.205%2C121.503%2C31.255&layer=mapnik',
      title: '园区地图总览',
      showToolbar: true,
      allowFullscreen: true,
      sandbox: ''
    }
  },
  clock: {
    type: 'clock',
    label: '时钟日期',
    description: '适合展示当前时间、日期、星期和时区信息',
    icon: 'CLK',
    size: { w: 420, h: 220 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '北京时间',
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN',
      zoneLabel: '',
      showSeconds: true,
      showDate: true,
      showWeekday: true,
      use24Hour: true,
      color: '#ecf7ff',
      accent: '#46eeff',
      dateColor: 'rgba(235, 247, 255, 0.72)',
      timeText: '',
      dateText: ''
    }
  },
  noticeTicker: {
    type: 'noticeTicker',
    label: '公告跑马灯',
    description: '适合轮播公告、预警播报、值班提示和实时事件流',
    icon: 'NTC',
    size: { w: 560, h: 92 },
    style: {
      ...defaultStyle,
      background: 'linear-gradient(180deg, rgba(8, 21, 39, 0.9), rgba(4, 10, 20, 0.84))',
      radius: 20,
      padding: 12
    },
    props: {
      title: '实时播报',
      tag: 'NOTICE',
      items: [
        '北区停车场余位低于 15%，建议引导车辆分流',
        '园区主链路抖动已恢复，当前延迟回落至 18ms',
        'A 栋会议中心 10:30 将开始访客高峰预警'
      ],
      direction: 'left',
      duration: 18,
      showDot: true,
      pauseOnHover: true,
      accent: '#46eeff'
    }
  },
  tabPanel: {
    type: 'tabPanel',
    label: 'Tabs 分区切换',
    description: '适合多视角切换、分区摘要和同屏信息分层展示',
    icon: 'TAB',
    size: { w: 560, h: 300 },
    style: {
      ...defaultStyle,
      background: 'linear-gradient(180deg, rgba(8, 20, 38, 0.92), rgba(4, 10, 20, 0.86))',
      padding: 18
    },
    props: {
      title: '运行分区',
      activeIndex: 0,
      showTitle: true,
      accent: '#46eeff',
      secondaryColor: 'rgba(235, 247, 255, 0.16)',
      items: [
        {
          label: '园区总览',
          value: '128',
          unit: '项',
          description: '在线任务总体平稳，停车与能耗两个区域需要持续关注。',
          meta: '综合态势'
        },
        {
          label: '安防态势',
          value: '18',
          unit: '条',
          description: '重点告警主要集中在北区出入口和会议中心周边。',
          meta: '重点告警'
        },
        {
          label: '设备运维',
          value: '96',
          unit: '%',
          description: '主设备在线率维持高位，建议继续跟进两台边缘节点。',
          meta: '在线率'
        }
      ]
    }
  },
  filterBar: {
    type: 'filterBar',
    label: '联动筛选条',
    description: '适合大屏顶部条件切换，可联动过滤排行、表格、区域分布和时间轴',
    icon: 'FLT',
    size: { w: 620, h: 104 },
    style: {
      ...defaultStyle,
      background: 'linear-gradient(180deg, rgba(8, 20, 38, 0.92), rgba(4, 10, 20, 0.84))',
      radius: 22,
      padding: 14
    },
    props: {
      title: '状态筛选',
      field: 'status',
      activeValue: '',
      showTitle: true,
      allowClear: true,
      accent: '#46eeff',
      secondaryColor: 'rgba(123, 254, 203, 0.16)',
      targetWidgetIds: [],
      options: [
        { label: '已完成', value: 'done', count: 12 },
        { label: '进行中', value: 'active', count: 5 },
        { label: '待处理', value: 'pending', count: 9 },
        { label: '预警', value: 'warning', count: 2 }
      ]
    }
  },
  timelinePanel: {
    type: 'timelinePanel',
    label: '时间轴',
    description: '适合展示事件演进、任务节点、工单流程和告警处置时间线',
    icon: 'TML',
    size: { w: 620, h: 360 },
    style: {
      ...defaultStyle,
      background: 'linear-gradient(180deg, rgba(8, 20, 38, 0.94), rgba(4, 10, 20, 0.88))',
      padding: 18
    },
    props: {
      title: '事件处理时间轴',
      subtitle: 'Timeline Overview',
      activeIndex: 1,
      accent: '#46eeff',
      secondaryColor: 'rgba(123, 254, 203, 0.16)',
      showPulse: true,
      showConnector: true,
      items: [
        {
          time: '08:30',
          title: '异常发现',
          description: '北区入口客流连续 5 分钟高于阈值，系统自动生成预警。',
          tag: '告警触发',
          status: 'done'
        },
        {
          time: '08:42',
          title: '联动研判',
          description: '值班人员调取现场视频与历史波峰，确认属于短时集中入场。',
          tag: '处理中',
          status: 'active'
        },
        {
          time: '08:55',
          title: '现场分流',
          description: '引导屏切换绕行提示，并通知安保执行双通道放行。',
          tag: '待执行',
          status: 'pending'
        },
        {
          time: '09:10',
          title: '结果复盘',
          description: '预计 09:10 完成现场恢复，并同步更新今日峰值记录。',
          tag: '待完成',
          status: 'pending'
        }
      ]
    }
  },
  titleBar: {
    type: 'titleBar',
    label: '分区标题条',
    description: '适合大屏模块标题、章节分区和导览头部',
    icon: 'Hdr',
    size: { w: 520, h: 120 },
    style: {
      background: 'transparent',
      borderColor: 'transparent',
      radius: 0,
      padding: 0,
      opacity: 1,
      rotate: 0
    },
    props: {
      title: '园区安防态势',
      subtitle: 'Security Overview',
      tag: 'SECTION 01',
      align: 'left',
      accent: '#46eeff',
      showLine: true,
      showGlow: true
    }
  },
  borderFrame: {
    type: 'borderFrame',
    label: '装饰边框',
    description: '适合模块框架、重点区域包裹和内容分区外框',
    icon: 'Frm',
    size: { w: 520, h: 300 },
    style: {
      ...defaultStyle,
      background: 'rgba(4, 12, 22, 0.28)',
      padding: 16
    },
    props: {
      title: '重点监控区',
      subtitle: 'Support Zone',
      badge: 'LIVE',
      accent: '#46eeff',
      secondaryColor: '#7bfecb',
      showHeader: true,
      showGrid: true,
      showGlow: true
    }
  },
  dataTable: {
    type: 'dataTable',
    label: '数据表格',
    description: '适合展示明细、告警列表和实时记录',
    icon: 'Tbl',
    size: { w: 560, h: 320 },
    style: {
      ...defaultStyle
    },
    props: {
      title: '实时告警列表',
      accent: '#46eeff',
      columns: [
        { key: 'name', label: '事件' },
        { key: 'level', label: '等级' },
        { key: 'owner', label: '负责人' },
        { key: 'time', label: '时间' }
      ],
      rows: [
        { name: '北区客流异常', level: '高', owner: '张峰', time: '09:42:18' },
        { name: '园区网络波动', level: '中', owner: '李欣', time: '09:39:07' },
        { name: '停车场余位预警', level: '低', owner: '王宁', time: '09:32:44' },
        { name: '能耗峰值提醒', level: '中', owner: '陈晨', time: '09:28:13' }
      ]
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
    dataBinding: {
      sourceId: ''
    },
    interaction: {
      trigger: 'click',
      actions: []
    },
    x: 80,
    y: 80,
    w: material.size.w,
    h: material.size.h,
    zIndex: 1,
    style: cloneDeep(material.style),
    props: cloneDeep(material.props),
    ...cloneDeep(overrides),
    dataBinding: {
      sourceId: '',
      ...(overrides.dataBinding ?? {})
    },
    interaction: {
      trigger: 'click',
      actions: [],
      ...(overrides.interaction ?? {})
    },
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
