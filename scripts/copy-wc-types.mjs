import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("src", "web-component.d.ts");
const target = resolve("dist", "web-component.d.ts");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
