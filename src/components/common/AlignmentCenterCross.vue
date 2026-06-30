<!--
  Small center cross drawn when an element is an alignment target. Placed inside
  any positioned container; the cross is centered on that container's 50%/50%
  (use a zero-size container positioned at a point, or a full-size overlay).
  Shared by ElementWrapper and the multi-label layout so the marker is identical.
-->
<template>
  <div
    data-print-exclude="true"
    class="absolute w-px theme-bg-strong"
    style="left: 50%; top: 50%; height: 6px; transform: translate(-0.5px, -50%)"
  ></div>
  <div
    data-print-exclude="true"
    class="absolute h-px theme-bg-strong"
    style="left: 50%; top: 50%; width: 6px; transform: translate(-50%, -0.5px)"
  ></div>
</template>
