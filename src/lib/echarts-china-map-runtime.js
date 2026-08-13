import { EffectScatterChart, LinesChart, MapChart } from "echarts/charts";
import { GeoComponent } from "echarts/components";
import chinaGeoJson from "../assets/china-geo.json";
import { echarts } from "./echarts-core.js";

echarts.use([EffectScatterChart, LinesChart, MapChart, GeoComponent]);

if (!echarts.getMap("china")) {
    echarts.registerMap("china", chinaGeoJson);
}

export { echarts };
