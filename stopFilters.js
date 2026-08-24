import {GenerateMapboxStopFilters} from "./app.js";
import fs from "node:fs";

const lines = [
    1, 4, 5, 7, 10, 11, 21, 23, 25, 27, 32, 41, 44, 47, 53, 61, 62, 63, 66, 69, 72, 73, 74, 76, 79, 85, 86, 90, 93, 95, 96, 97
]
//
// const line = 1;
// const filter = await GenerateMapboxStopFilters(line.toString());
// const outputFile = `output/filters/filter${line.toString()}.geojson`;
//
// console.log("Writing file that contains filter...");
// fs.writeFileSync(outputFile, JSON.stringify(filter));

// for(const line of lines) {
//     const filter = await GenerateMapboxStopFilters(line.toString());
//     const outputFile = `output/filters/filter${line.toString()}.txt`;
//
//     console.log("Writing file that contains filter...");
//     fs.writeFileSync(outputFile, JSON.stringify(filter));
// }

const filter = await GenerateMapboxStopFilters(lines);
const outputFile = 'output/filters/style.json';
fs.writeFileSync(outputFile, JSON.stringify(filter));