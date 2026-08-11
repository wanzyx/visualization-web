export const interactionActionOptions = [
  { value: 'none', label: '无动作' },
  { value: 'highlight-widgets', label: '高亮组件' },
  { value: 'refresh-sources', label: '刷新数据源' },
  { value: 'switch-page', label: '切换页面' }
]

export const alignOptions = [
  { value: 'left', label: 'left' },
  { value: 'center', label: 'center' },
  { value: 'right', label: 'right' }
]

export const baseFields = [
  {
    path: 'name',
    label: '名称',
    type: 'text',
    placeholder: '请输入组件名称'
  },
  {
    path: 'x',
    label: 'X',
    type: 'number',
    span: 'half'
  },
  {
    path: 'y',
    label: 'Y',
    type: 'number',
    span: 'half'
  },
  {
    path: 'w',
    label: '宽度',
    type: 'number',
    min: 120,
    span: 'half'
  },
  {
    path: 'h',
    label: '高度',
    type: 'number',
    min: 80,
    span: 'half'
  },
  {
    path: 'zIndex',
    label: '图层',
    type: 'number',
    span: 'half'
  },
  {
    path: 'style.rotate',
    label: '旋转',
    type: 'number',
    span: 'half'
  },
  {
    path: 'hidden',
    label: '隐藏当前组件',
    type: 'checkbox'
  },
  {
    path: 'locked',
    label: '锁定当前组件',
    type: 'checkbox'
  }
]

export const styleFields = [
  {
    path: 'style.background',
    label: '背景',
    type: 'text',
    placeholder: '支持颜色或渐变'
  },
  {
    path: 'style.borderColor',
    label: '边框颜色',
    type: 'text'
  },
  {
    path: 'style.radius',
    label: '圆角',
    type: 'number',
    min: 0,
    span: 'half'
  },
  {
    path: 'style.padding',
    label: '内边距',
    type: 'number',
    min: 0,
    span: 'half'
  },
  {
    path: 'style.opacity',
    label: '透明度',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.1,
    span: 'half'
  }
]

export function createPageFields({ page, project }) {
  return [
    {
      key: 'page-name',
      label: '页面名称',
      type: 'text',
      get: () => page?.name ?? '',
      set: (value) => {
        if (page) {
          page.name = value
        }
      }
    },
    {
      key: 'page-title',
      label: '画布标题',
      type: 'text',
      get: () => project.meta.title,
      set: (value) => {
        project.meta.title = value
      }
    },
    {
      key: 'page-width',
      label: '宽度',
      type: 'number',
      min: 1280,
      span: 'half',
      get: () => project.meta.screenWidth,
      set: (value) => {
        project.meta.screenWidth = value
      }
    },
    {
      key: 'page-height',
      label: '高度',
      type: 'number',
      min: 720,
      span: 'half',
      get: () => project.meta.screenHeight,
      set: (value) => {
        project.meta.screenHeight = value
      }
    },
    {
      key: 'page-background',
      label: '背景',
      type: 'textarea',
      rows: 4,
      get: () => project.meta.background,
      set: (value) => {
        project.meta.background = value
      }
    },
    {
      key: 'page-grid-color',
      label: '网格颜色',
      type: 'text',
      get: () => project.meta.gridColor,
      set: (value) => {
        project.meta.gridColor = value
      }
    },
    {
      key: 'page-grid-visible',
      label: '显示网格辅助线',
      type: 'checkbox',
      get: () => project.meta.showGrid,
      set: (value) => {
        project.meta.showGrid = value
      }
    },
    {
      key: 'page-ruler-visible',
      label: '显示标尺',
      type: 'checkbox',
      get: () => project.meta.showRulers,
      set: (value) => {
        project.meta.showRulers = value
      }
    },
    {
      key: 'page-guide-visible',
      label: '启用参考线',
      type: 'checkbox',
      get: () => project.meta.showGuides,
      set: (value) => {
        project.meta.showGuides = value
      }
    },
    {
      key: 'page-guide-color',
      label: '参考线颜色',
      type: 'text',
      get: () => project.meta.guideColor,
      set: (value) => {
        project.meta.guideColor = value
      }
    }
  ]
}

export function createWidgetFields({ widget, barCategories, barValues, lineLabels, lineValues }) {
  if (!widget) {
    return []
  }

  switch (widget.type) {
    case 'text':
      return [
        {
          path: 'props.text',
          label: '内容',
          type: 'textarea',
          rows: 4
        },
        {
          path: 'props.fontSize',
          label: '字号',
          type: 'number',
          min: 12,
          span: 'half'
        },
        {
          path: 'props.fontWeight',
          label: '字重',
          type: 'number',
          min: 300,
          max: 900,
          step: 100,
          span: 'half'
        },
        {
          path: 'props.letterSpacing',
          label: '字距',
          type: 'number',
          min: 0,
          span: 'half'
        },
        {
          path: 'props.align',
          label: '对齐',
          type: 'select',
          options: alignOptions,
          span: 'half'
        },
        {
          path: 'props.color',
          label: '颜色',
          type: 'text'
        }
      ]

    case 'stat':
      return [
        {
          path: 'props.title',
          label: '标题',
          type: 'text'
        },
        {
          path: 'props.value',
          label: '数值',
          type: 'text',
          span: 'half'
        },
        {
          path: 'props.unit',
          label: '单位',
          type: 'text',
          span: 'half'
        },
        {
          path: 'props.trend',
          label: '趋势',
          type: 'number',
          step: 0.1,
          span: 'half'
        },
        {
          path: 'props.trendLabel',
          label: '趋势描述',
          type: 'text',
          span: 'half'
        },
        {
          path: 'props.color',
          label: '主色',
          type: 'text'
        },
        {
          path: 'props.accent',
          label: '强调色',
          type: 'text'
        }
      ]

    case 'barChart':
      return [
        {
          path: 'props.title',
          label: '标题',
          type: 'text'
        },
        {
          key: 'bar-categories',
          label: '分类（每行一个）',
          type: 'textarea',
          rows: 5,
          get: () => barCategories.value,
          set: (value) => {
            barCategories.value = value
          }
        },
        {
          key: 'bar-values',
          label: '数值（逗号分隔）',
          type: 'textarea',
          rows: 3,
          get: () => barValues.value,
          set: (value) => {
            barValues.value = value
          }
        },
        {
          path: 'props.color',
          label: '柱体颜色',
          type: 'text'
        }
      ]

    case 'lineChart':
      return [
        {
          path: 'props.title',
          label: '标题',
          type: 'text'
        },
        {
          key: 'line-labels',
          label: '标签（每行一个）',
          type: 'textarea',
          rows: 5,
          get: () => lineLabels.value,
          set: (value) => {
            lineLabels.value = value
          }
        },
        {
          key: 'line-values',
          label: '数值（逗号分隔）',
          type: 'textarea',
          rows: 3,
          get: () => lineValues.value,
          set: (value) => {
            lineValues.value = value
          }
        },
        {
          path: 'props.color',
          label: '线条颜色',
          type: 'text'
        },
        {
          path: 'props.areaColor',
          label: '区域颜色',
          type: 'text'
        }
      ]

    case 'gauge':
      return [
        {
          path: 'props.title',
          label: '标题',
          type: 'text'
        },
        {
          path: 'props.value',
          label: '百分比',
          type: 'number',
          min: 0,
          max: 100,
          span: 'half'
        },
        {
          path: 'props.color',
          label: '主色',
          type: 'text',
          span: 'half'
        },
        {
          path: 'props.trackColor',
          label: '轨道色',
          type: 'text'
        }
      ]

    case 'panel':
    default:
      return [
        {
          path: 'props.title',
          label: '标题',
          type: 'text'
        },
        {
          path: 'props.subtitle',
          label: '副标题',
          type: 'text'
        },
        {
          path: 'props.content',
          label: '正文',
          type: 'textarea',
          rows: 4
        }
      ]
  }
}

export function getWidgetSectionTitle(type) {
  switch (type) {
    case 'text':
      return '文本内容'
    case 'stat':
      return '指标卡片'
    case 'barChart':
      return '柱状图数据'
    case 'lineChart':
      return '折线图数据'
    case 'gauge':
      return '环形进度'
    case 'panel':
    default:
      return '面板内容'
  }
}
