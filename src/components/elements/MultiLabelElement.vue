<script setup lang="ts">
import { computed } from "vue";
import type { PrintElement } from "@/types";

const props = defineProps<{
  element: PrintElement;
}>();

const hasBorder = computed(() => {
  const bs = props.element.style?.borderStyle;
  return (
    !!bs && bs !== "none" && (Number(props.element.style?.borderWidth) || 0) > 0
  );
});

const boxStyle = computed(() => {
  const s = props.element.style || {};
  const style: Record<string, string> = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
  };
  const bg = s.backgroundColor;
  if (bg && bg !== "transparent" && bg !== "none") style.backgroundColor = bg;
  if (hasBorder.value) {
    style.border = `${Number(s.borderWidth) || 1}px ${s.borderStyle} ${
      s.borderColor || "#000000"
    }`;
  }
  return style;
});
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from "@/types";

// Multi-label layout = the first label cell. Its position/size (grid origin and
// single-label size) are edited through the shared Position/Size panel; the
// sections below add the layout grid + data binding + appearance, distributed
// across the standard Properties/Style tabs like every other element.
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: "editor.multiLabelData",
      tab: "properties",
      fields: [
        {
          label: "editor.multiLabelDataVariable",
          type: "text",
          target: "element",
          key: "dataVariable",
          placeholder: "@labels",
          defaultValue: "",
        },
      ],
    },
    {
      title: "editor.multiLabelLayout",
      tab: "properties",
      fields: [
        {
          label: "editor.multiLabelRows",
          type: "number",
          target: "element",
          key: "rows",
          min: 1,
          max: 100,
          defaultValue: 1,
          half: true,
        },
        {
          label: "editor.multiLabelCols",
          type: "number",
          target: "element",
          key: "cols",
          min: 1,
          max: 100,
          defaultValue: 1,
          half: true,
        },
        {
          label: "editor.multiLabelDirection",
          type: "select",
          target: "element",
          key: "direction",
          defaultValue: "row",
          options: [
            { label: "editor.multiLabelDirectionRow", value: "row" },
            { label: "editor.multiLabelDirectionColumn", value: "column" },
          ],
        },
        {
          label: "editor.multiLabelGapX",
          type: "number",
          target: "element",
          key: "gapX",
          min: 0,
          max: 1000,
          defaultValue: 0,
          half: true,
        },
        {
          label: "editor.multiLabelGapY",
          type: "number",
          target: "element",
          key: "gapY",
          min: 0,
          max: 1000,
          defaultValue: 0,
          half: true,
        },
      ],
    },
    {
      title: "editor.multiLabelStyle",
      tab: "style",
      fields: [
        {
          label: "editor.multiLabelBackgroundColor",
          type: "color",
          target: "style",
          key: "backgroundColor",
          defaultValue: "transparent",
        },
        {
          label: "editor.multiLabelBorderStyle",
          type: "select",
          target: "style",
          key: "borderStyle",
          defaultValue: "none",
          options: [
            { label: "properties.option.none", value: "none" },
            { label: "properties.option.solid", value: "solid" },
            { label: "properties.option.dashed", value: "dashed" },
            { label: "properties.option.dotted", value: "dotted" },
          ],
        },
        {
          label: "editor.multiLabelBorderWidth",
          type: "number",
          target: "style",
          key: "borderWidth",
          min: 0,
          max: 100,
          defaultValue: 1,
        },
        {
          label: "editor.multiLabelBorderColor",
          type: "color",
          target: "style",
          key: "borderColor",
          defaultValue: "#000000",
        },
      ],
    },
  ],
};
</script>

<template>
  <div class="w-full h-full relative" :style="boxStyle">
    <!-- When no explicit border, show a faint dashed guide so the editable
         first-label region is visible at design time (excluded from print). -->
    <div
      v-if="!hasBorder"
      data-print-exclude="true"
      class="absolute inset-0 pointer-events-none"
      style="outline: 1px dashed rgba(59, 130, 246, 0.5); outline-offset: -1px"
    ></div>
  </div>
</template>
