import fs from 'node:fs';
import path from "node:path";
import gpxParser from 'gpxparser';
import { loadEnvFile } from 'node:process';
import mysql from 'mysql';
import { input } from '@inquirer/prompts';
import { select } from '@inquirer/prompts';
import { checkbox } from '@inquirer/prompts';

const folderPath = "./input"

loadEnvFile();

const isFile = fileName => {
    return fs.lstatSync(fileName).isFile();
};
const files =
    fs.readdirSync(folderPath)
    .map(fileName => {
        return path.join(folderPath, fileName);
    })
    .filter(isFile);

let db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

db.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
    db.query("USE stb_pathways", function (err, result) {
        if (err) throw err;
        console.log("Database selected!");
    });
});

// function getLastId() {
//     let idQuery;
//     db.query("SELECT id FROM pathways ORDER BY id DESC LIMIT 1", function (err, result) {
//         idQuery = result;
//     });
//     if(idQuery === undefined) return -1;
//     return idQuery;
//
// }

async function getNextOrderNumber(line) {
    const queryResult = await db.query("SELECT MAX(path_order) as highest_path_order FROM pathways WHERE path_lines = ?", [line]);
    console.log(queryResult);
    if(queryResult[0].highest_path_order === undefined) return 1;
    return queryResult[0].highest_path_order+1;

    // queryResult.forEach((obj) => {
    //     if(obj.contains(line)) return
    // });
}

function findClosestStop(targetLat, targetLon) {
    const stops = JSON.parse(fs.readFileSync('stb-stops.json', 'utf8'));
    return stops.reduce((closest, obj) => {
        const diff = Math.sqrt(
            Math.pow(obj.latitude - targetLat, 2) +
            Math.pow(obj.longitude - targetLon, 2)
        );
        return diff < closest.diff ? { obj, diff } : closest;
    }, { obj: null, diff: Infinity });
}

function getPathDirection(pathId, directions) {
    if(directions[0]<directions[1]) {
        if(directions[0]<=pathId && pathId<directions[1]) return 0;
        else return 1;
    } else {
        if(directions[1]<=pathId && pathId<directions[0]) return 1;
        else return 0;
    }
}

//Store path stops and ids
let paths = [];
let i=0;
for(const file of files) {
    var gpx = new gpxParser();
    gpx.parse(fs.readFileSync(file, 'utf8'));
    const json = gpx.toGeoJSON();

    const coords = json.features[0].geometry.coordinates;
    const startStop = findClosestStop(coords[0][1], coords[0][0]).obj;
    const endStop = findClosestStop(coords[coords.length-1][1], coords[coords.length-1][0]).obj;

    paths[i] = `${i}: ${startStop.name} (${startStop.id})  ->  ${endStop.name} (${endStop.id})`;
    i++;
}

//Read lines and directions from keyboard
let lines = [];
// const multipleLines = Number(prompt("Do these paths correspond to multiple lines? 0/1 "));
const multipleLines = await select({
    message: 'Do these paths correspond to multiple lines?',
    choices: [
        {
            name: 'Yes',
            value: 1
        },
        {
            name: 'No',
            value: 0
        }
    ]
});
if(multipleLines) {
    // const noLines = Number(prompt("Enter the number of lines: "));
    const noLines = Number(await input(
        {
            message: 'Enter the number of lines:',
            required: true,
            pattern: RegExp('[2-9][0-9]*'),
            patternError: 'Please enter any number other than 1!'
        }));
    // const mainLine = prompt("Enter the main line (that corresponds to all input files): ");
    const mainLine = await input(
        {
            message: 'Enter the main line (that corresponds to all input files):',
            required: true,
            pattern: RegExp('[1-9][0-9]*'),
            patternError: 'Please enter a number!'
        }
    )
    for(let j=0; j<i; j++) {
        lines[j]=mainLine;
    }
    for(let j=0; j<noLines-1; j++) {
        // const start = Number(prompt(`Enter the start of range no ${j}: `));
        const start = await select({
            message: `Select the first path of range ${j+1}`,
            choices: paths.map((name, index) => ({
                name: name,
                value: index
            })),
            pageSize: 10,
            required: true
        });
        // const end = Number(prompt(`Enter the end of range no ${j}: `));
        const end = await select({
            message: `Select the last path of range ${j+1}`,
            choices: paths.map((name, i) => ({
                name: name,
                value: i
            })),
            pageSize: 10,
            required: true
        });
        // const line = prompt(`Enter line no ${j}: `);
        const line = await input({
            message: `Enter line no ${j+1}:`,
            required: true,
            pattern: RegExp('[1-9][0-9]*'),
            patternError: 'Please enter a number!'
        });
        for(let k=start; k<=end; k++) {
            lines[k]=lines[k] + "," + line;
        }
    }
} else {
    const line = await input({
        message: `Enter the line:`,
        required: true,
        pattern: RegExp('[1-9][0-9]*'),
        patternError: 'Please enter a number!'
    });
    for(let j=0; j<i; j++) {
        lines[j]=line;
    }
}
console.log(lines);

let directions = [];
// directions[0] = Number(prompt("Enter id of first path in direction 0: "));
directions[0] = await select({
    message: `Select the first path in direction 0`,
    choices: paths.map((name, index) => ({
        name: name,
        value: index
    })),
    pageSize: 10,
    required: true
});
// directions[1] = Number(prompt("Enter id of first path in direction 1: "));
directions[1] = await select({
    message: `Select the first path in direction 1`,
    choices: paths.map((name, index) => ({
        name: name,
        value: index
    })),
    pageSize: 10,
    required: true
});


i=0;
for(const file of files) {
    var gpx1 = new gpxParser();
    gpx1.parse(fs.readFileSync(file, 'utf8'));
    const json1 = gpx1.toGeoJSON();

    delete json1.features[0].properties.name;
    delete json1.features[0].properties.cmt;
    delete json1.features[0].properties.desc;
    delete json1.features[0].properties.src;
    delete json1.features[0].properties.number;
    delete json1.features[0].properties.link;
    delete json1.features[0].properties.type;

    const coords = json1.features[0].geometry.coordinates;

    // const id = getLastId()+1;
    const path_order = await getNextOrderNumber(lines[i]);
    const startId = findClosestStop(coords[0][1], coords[0][0]).obj.id;
    const endId = findClosestStop(coords[coords.length-1][1], coords[coords.length-1][0]).obj.id;
    const path_lines = lines[i];
    const path_direction = getPathDirection(i, directions);
    const path_length = gpx1.tracks[0].distance.total.toFixed(3);

    // json1.features[0].properties.id = id;
    json1.features[0].properties.path_order = path_order;
    json1.features[0].properties.startId = startId;
    json1.features[0].properties.endId = endId;
    json1.features[0].properties.path_lines = path_lines;
    json1.features[0].properties.path_direction = path_direction;
    json1.features[0].properties.path_length = path_length;

    console.log(json1.features[0]);

    const values = [0, path_order, startId, endId, path_lines, path_direction, path_length];
    db.query("INSERT INTO pathways (id, path_order, startId, endId, path_lines, path_direction, path_length) VALUES (?)", [values], function (err, result) {
        if(err) throw err;
    });
    db.query("SELECT * FROM pathways", function (err, result) {
        console.log(result);
    });

    const outputFile = "output/" + file.split("/")[1].split(".")[0] + ".geojson";
    console.log("Writing " + outputFile + "...");
    fs.writeFileSync(outputFile, JSON.stringify(json1));
    i++;
}