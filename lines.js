import {LineJSONFormatter} from "./app.js";
import fs from 'node:fs';

const result = await LineJSONFormatter("input/", "stb-stops.json", "paths.json");

console.log("Writing file that contains all paths...");
const outputFile = "output/features.geojson";
const stopFilterFile = "output/stopFilter.txt";
fs.writeFileSync(outputFile, JSON.stringify(result[0]));
fs.writeFileSync(stopFilterFile, JSON.stringify(result[1]));
