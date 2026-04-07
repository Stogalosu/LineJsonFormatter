import {SubwayJSONFormatter} from "./app.js";
import fs from "node:fs";

const formattedSubwayJSON = await SubwayJSONFormatter("input/Metrou 2.geojson", "stb-stops.json", false, true);
const outputFile1 = "output/subway.geojson";
const outputFile2 = "output/stb-stops-modified.json";

console.log("Writing file that contains all subway paths...");
fs.writeFileSync(outputFile1, JSON.stringify(formattedSubwayJSON.subway));
console.log("Writing file that contains all stops...");
fs.writeFileSync(outputFile2, JSON.stringify(formattedSubwayJSON.stops));