import {GenerateMapboxStopFilters} from "./app.js";
import fs from "node:fs";

const lines = [
    1, 4, 5, 7, 10, 11, 21, 23, 25, 27, 32, 41, 44, 47, 53, 61, 62, 63, 66, 69, 72, 73, 74, 76, 79, 85, 86, 90, 93, 95, 96, 97
]

const filter = await GenerateMapboxStopFilters(lines);
const outputFile = 'output/filters/style.json';
fs.writeFileSync(outputFile, JSON.stringify(filter));