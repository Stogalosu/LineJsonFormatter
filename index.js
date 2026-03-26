import { LineJSONFormatter } from "./app.js";
import fs from 'node:fs';

const formattedJSON = await LineJSONFormatter("input/", "stb-stops.json");

console.log("Writing file that contains all paths...");
const outputFile = "output/features.geojson";
fs.writeFileSync(outputFile, JSON.stringify(formattedJSON));