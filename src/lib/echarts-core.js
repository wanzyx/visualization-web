import * as echarts from 'echarts/core'
import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart
} from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer
])

export { echarts }
