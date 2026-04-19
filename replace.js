import { ReplaceLineIDs } from "./app.js";
import fs from "node:fs";

function removeRange(line) {
    if(line === undefined) return false;
    else return RegExp("4[0-9][0-9]B*").test(line)
}

const replacedJSON = ReplaceLineIDs('stop_times_4.json', 'line', 'routes_2.json', (line) => { return removeRange(line) });

console.log("Writing file with replaced values...");
const outputFile = "output/replaced.json";
fs.writeFileSync(outputFile, JSON.stringify(replacedJSON));