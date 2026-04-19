import fs from 'node:fs';
import path from "node:path";
import gpxParser from 'gpxparser';
import { loadEnvFile } from 'node:process';
import mysql from 'mysql2';
import { input } from '@inquirer/prompts';
import { select } from '@inquirer/prompts';
import geoJSONLength from '@turf/length';

let db;

async function initDatabase() {
    loadEnvFile();

    db = await mysql.createConnection({
        host: process.env.LJF_DB_HOST,
        user: process.env.LJF_DB_USER,
        password: process.env.LJF_DB_PASSWORD
    });

    await db.promise().query("USE stb_pathways");
}

async function getNextOrderNumber(line) {
    const queryResult = await db.promise().query("SELECT MAX(path_order) as highest_path_order FROM pathways WHERE path_lines = ?", [line]);

    if (queryResult[0][0].highest_path_order === undefined) return 1;
    return queryResult[0][0].highest_path_order + 1;
}

function findClosestStop(targetLat, targetLon, stopJSONFile, subway = 0) {
    const stopsJSON = JSON.parse(fs.readFileSync(stopJSONFile, 'utf8'));
    return stopsJSON.reduce((closest, obj) => {
        const diff = Math.sqrt(
            Math.pow(obj.latitude - targetLat, 2) +
            Math.pow(obj.longitude - targetLon, 2)
        );
        if (diff >= closest.diff) return closest;
        if (subway && obj.type !== 1) return closest;
        return { obj, diff };
    }, {obj: null, diff: Infinity});
}

async function getLastId() {
    const idQuery = await db.promise().query("SELECT id FROM pathways ORDER BY id DESC LIMIT 1");
    if (idQuery[0][0] === undefined) return -1;
    return idQuery[0][0].id;
}

function compareLines(a, b) {
    let values = [a, b];
    if(Number.isInteger(a)) {
        if(Number.isInteger(b)) {
            return a-b;
        } else {
            return -1;
        }
    } else {
        if(Number.isInteger(b)) {
            return 1;
        } else {
            for(let q=0; q<=1; q++) {
                if(values[q].includes('N'))
                    values[q] = Number(values[q].split('N')[1]);
                else if(values[q].includes('B'))
                    values[q] = Number(values[q].split('B')[0]);
                else if(values[q].includes('O'))
                    values[q] = Number(values[q].split('O')[0]);
            }
            return compareLines(values[0], values[1]);
        }
    }
}

export const LineJSONFormatter = async (inputPath, stopJSONFile, linesJSONFile) => {

    const isFile = fileName => {
        return fs.lstatSync(fileName).isFile();
    };
    const files =
        fs.readdirSync(inputPath)
            .map(fileName => {
                return path.join(inputPath, fileName);
            })
            .filter(isFile);

    await initDatabase();

    function getStopsInRange(lat, lon, range) {
        const stopsJSON = JSON.parse(fs.readFileSync(stopJSONFile, 'utf8'));
        let result = [];
        stopsJSON.forEach((stop) => {
            const dist = Math.sqrt(
                Math.pow(stop.latitude - lat, 2) +
                Math.pow(stop.longitude - lon, 2)
            );
            if (dist < range) result.push(stop);
        });
        return result;
    }

    function getPathDirection(pathId, directions) {
        if (directions[0] < directions[1]) {
            if (directions[0] <= pathId && pathId < directions[1]) return 0;
            else return 1;
        } else {
            if (directions[1] <= pathId && pathId < directions[0]) return 1;
            else return 0;
        }
    }

//Store paths and stops for console visualization
    let paths = [];
    let stops = [];
    let tempPathJSON = [];
    let i;
    for (i=0; i<files.length; i++) {
        const file = files[i];
        if(file.endsWith(".gpx")) {
            console.log("Processing file " + file);
            var gpx = new gpxParser();
            gpx.parse(fs.readFileSync(file, 'utf8'));
            const json = gpx.toGeoJSON();

            const coords = json.features[0].geometry.coordinates;
            const startStop = findClosestStop(coords[0][1], coords[0][0], stopJSONFile).obj;
            const endStop = findClosestStop(coords[coords.length - 1][1], coords[coords.length - 1][0], stopJSONFile).obj;

            const startStopObject = {
                id: startStop.id,
                name: `${startStop.name} (${startStop.id})`,
                latitude: startStop.latitude,
                longitude: startStop.longitude
            };
            const endStopObject = {
                id: endStop.id,
                name: `${endStop.name} (${endStop.id})`,
                latitude: endStop.latitude,
                longitude: endStop.longitude
            };
            paths[i] = `${i}: ${startStopObject.name} -> ${endStopObject.name}`;

            const tempStops = stops.map((stop) => (stop.name));
            if (!tempStops.includes(startStopObject.name)) stops.push(startStopObject);
            if (!tempStops.includes(endStopObject.name)) stops.push(endStopObject);

            tempPathJSON[i] = {
                startId: startStopObject.id,
                endId: endStopObject.id,
            }
        }
    }

// Ask if there are any mistakes in the stop ids
    console.log(paths);

    let mistake = await select({
        message: 'Are the stop names and ids correct?',
        choices: [
            {
                name: 'Yes',
                value: false
            },
            {
                name: 'No',
                value: true
            }
        ]
    });

// Correct mistakes
    while (mistake) {
        const stopToModify = await select({
            message: 'Choose the stop that needs to be modified',
            choices: stops.map((stop) => ({
                name: stop.name,
                value: stop
            }))
        });

        let otherStops = getStopsInRange(stopToModify.latitude, stopToModify.longitude, 0.000450); /* About 50 meters */
        otherStops = otherStops.map((stop) => ({
            id: stop.id,
            name: `${stop.name} (${stop.id})`,
            latitude: stop.latitude,
            longitude: stop.longitude
        }));

        const newStop = await select({
            message: 'Choose the correct stop',
            choices: otherStops.map((stop) => ({
                name: stop.name,
                value: stop
            }))
        });

        // Correct mistake in memory
        tempPathJSON.find(element => element.startId === stopToModify.id).startId = newStop;
        tempPathJSON.find(element => element.endId === stopToModify.id).endId = newStop;

        // Correct mistake in console output
        paths = paths.map(path => path.replace(stopToModify.name, newStop.name))
        for (let stop of stops)
            stop.name = stop.name.replace(stopToModify.name, newStop.name);
        console.log(paths);

        // Ask if there are still any mistakes
        mistake = await select({
            message: 'Are there any other mistakes?',
            choices: [
                {
                    name: 'Yes',
                    value: true
                },
                {
                    name: 'No',
                    value: false
                }
            ]
        });
    }

//Read lines and directions from keyboard
    let linesStrings = [];
    let linesArrays = [];
    let automaticDetection = 0;
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
    if (multipleLines) {
        automaticDetection = await select({
            message: 'Do you want automatic line detection?',
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
        if(!automaticDetection) {
            const noLines = Number(await input(
                {
                    message: 'Enter the number of lines:',
                    required: true,
                    pattern: RegExp('[2-9][0-9]*'),
                    patternError: 'Please enter any number other than 1!'
                }));
            const localMainLine = await input(
                {
                    message: 'Enter the main line (that corresponds to all input files):',
                    required: true,
                    pattern: RegExp('[MN]*[1-9][0-9]*[BO]*[1-9]*[0-9]*'),
                    patternError: 'Please enter a valid line!'
                }
            )
            for (let j = 0; j < i; j++) {
                linesStrings[j] = localMainLine;
            }
            for (let j = 0; j < noLines - 1; j++) {
                const start = await select({
                    message: `Select the first path of range ${j + 1}`,
                    choices: paths.map((name, index) => ({
                        name: name,
                        value: index
                    })),
                    pageSize: 10,
                    required: true
                });
                const end = await select({
                    message: `Select the last path of range ${j + 1}`,
                    choices: paths.map((name, i) => ({
                        name: name,
                        value: i
                    })),
                    pageSize: 10,
                    required: true
                });
                const line = await input({
                    message: `Enter line no ${j + 1}:`,
                    required: true,
                    pattern: RegExp('[MN]*[1-9][0-9]*[BO]*[1-9]*[0-9]*'),
                    patternError: 'Please enter a valid line!'
                });
                for (let k = start; k <= end; k++) {
                    linesStrings[k] = linesStrings[k] + "," + line;
                }
            }

            linesArrays = linesStrings.map(string => {
                let array = string.split(',');
                array = array.map(value => {
                    if(Number.isNaN(Number(value))) return value;
                    else return Number(value);
                });
                return array;
            });
        }
    } else {
        const line = await input({
            message: `Enter the line:`,
            required: true,
            pattern: RegExp('[MN]*[1-9][0-9]*[BO]*[1-9]*[0-9]*'),
            patternError: 'Please enter a valid line!'
        });
        for (let j = 0; j < i; j++) {
            linesStrings[j] = line;
        }
    }

    let directions = [];
    directions[0] = await select({
        message: `Select the first path in direction 0`,
        choices: paths.map((name, index) => ({
            name: name,
            value: index
        })),
        pageSize: 10,
        required: true
    });
    directions[1] = await select({
        message: `Select the first path in direction 1`,
        choices: paths.map((name, index) => ({
            name: name,
            value: index
        })),
        pageSize: 10,
        required: true
    });

    if(automaticDetection) {
        const linesJSON = JSON.parse(fs.readFileSync(linesJSONFile, 'utf8'));
        const localMainLine = Number(await input({
                message: 'Enter the main line (that corresponds to all input files):',
                required: true,
                pattern: RegExp('[MN]*[1-9][0-9]*[BO]*[1-9]*[0-9]*'),
                patternError: 'Please enter a valid line!'
        }));

        for(let j=0; j < i; j++) {
            const startStopIndex = linesJSON.findIndex(
                element =>
                    element.line === localMainLine &&
                    element.startId === tempPathJSON[j].startId
            );
            const endStopIndex = linesJSON.findIndex(
                element =>
                    element.line === localMainLine &&
                    element.startId === tempPathJSON[j].endId
            );

            linesArrays[j] = [];
            if(endStopIndex - startStopIndex === 1) {
                for (let k = 0; k < linesJSON.length - 1; k++) {
                    if (tempPathJSON[j].startId === linesJSON[k].startId && tempPathJSON[j].endId === linesJSON[k + 1].startId)
                        linesArrays[j].push(linesJSON[k].line);
                }
            } else if(linesJSON[startStopIndex].path_direction !== linesJSON[endStopIndex].path_direction) {
                const terminusPaths = linesJSON.filter(entry => entry.startId === tempPathJSON[j].startId || entry.startId === tempPathJSON[j].endId);
                let processedLines = [];
                for(const entry of terminusPaths) {
                    if(!processedLines.includes(entry.line)) {
                        const temp = terminusPaths.filter(element => element.line === entry.line);
                        if(temp.length === 2) linesArrays[j].push(entry.line);
                        processedLines.push(entry.line);
                    }
                }
            }
        }
        linesArrays.forEach(array => array.sort(compareLines));

        linesStrings = linesArrays.map(array => array.map(line => line.toString()));
        linesStrings = linesStrings.map(array => array.join());
    }

    let lastStopId = 0;
    let finalJSON = {};
    for(let i=0; i<files.length; i++) {
        const file = files[i];
        if(file.endsWith(".gpx")) {
            var gpx1 = new gpxParser();
            gpx1.parse(fs.readFileSync(file, 'utf8'));
            const json1 = gpx1.toGeoJSON();

            delete json1.properties;
            delete json1.features[0].properties.name;
            delete json1.features[0].properties.cmt;
            delete json1.features[0].properties.desc;
            delete json1.features[0].properties.src;
            delete json1.features[0].properties.number;
            delete json1.features[0].properties.link;
            delete json1.features[0].properties.type;

            const id = await getLastId() + 1;
            const path_order = await getNextOrderNumber(linesStrings[i]);
            let startId = tempPathJSON[i].startId;
            let endId = tempPathJSON[i].endId;
            const path_lines_JSON = linesArrays[i];
            const path_lines_db = linesStrings[i];
            const path_direction = getPathDirection(i, directions);
            const path_length = gpx1.tracks[0].distance.total.toFixed(3);
            let skip = 0;

            // Make sure that consecutive paths that don't have corresponding stops are correct
            if (lastStopId !== 0 && lastStopId !== startId) {
                skip = await select({
                    message: `Stops of paths ${i - 1} and ${i} don't correspond. Is this a mistake?\n${paths[i - 1]}\n${paths[i]}`,
                    choices: [
                        {
                            name: 'No',
                            value: 1
                        },
                        {
                            name: 'Yes',
                            value: 0
                        }
                    ]
                });
                if (!skip) {
                    const keepThis = await select({
                        message: `Which stop should be kept as the correct one?`,
                        choices: [
                            {
                                name: lastStopId.toString(),
                                value: 0
                            },
                            {
                                name: startId.toString(),
                                value: 1
                            }
                        ]
                    });
                    if (keepThis)
                        await db.promise().query("UPDATE pathways SET endId = ? WHERE id = ?", [startId, i - 1]);
                    else
                        startId = lastStopId;
                }
            }

            json1.features[0].properties.id = id;
            json1.features[0].properties.path_order = path_order;
            json1.features[0].properties.skip = skip;
            json1.features[0].properties.startId = startId;
            json1.features[0].properties.endId = endId;
            json1.features[0].properties.path_lines = path_lines_JSON;
            json1.features[0].properties.path_direction = path_direction;
            json1.features[0].properties.path_length = path_length;

            // Insert path in the database and write the JSON to a file
            const values = [0, path_order, startId, endId, path_lines_db, path_direction, path_length, skip];
            db.query("INSERT INTO pathways (id, path_order, startId, endId, path_lines, path_direction, path_length, skip) VALUES (?)", [values], function (err, result) {
                if (err) throw err;
            });

            if (i === 0) {
                finalJSON = json1;
            } else {
                finalJSON.features.push(json1.features[0]);
            }

            lastStopId = endId;
        }
    }

    db.end((error) => {
        if (error) {
            console.error('Error closing MySQL connection:', error);
            return;
        }
        console.log('MySQL connection closed.');
    });

    return finalJSON;
}

export const SubwayJSONFormatter = async (inputFile, stopJSONFile, modifyDb = true, returnStopJSON = false) => {

    await initDatabase();

    const stopsJSON = JSON.parse(fs.readFileSync(stopJSONFile, 'utf8'));
    const subwayJSON = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    for(const feature of subwayJSON.features) {
        if(feature.geometry.type === "Point") {
            const sameStop = stopsJSON.find((stop) => stop.name === feature.properties.name && stop.type === 1);
            if(sameStop === undefined) console.log(`Couldn't find matching stop for ${feature.properties.name}`);
            else {
                feature.properties.id = sameStop.id;
                feature.properties.description = "";
                feature.properties.type = 1;
                feature.properties.lines = feature.properties.line.split("/");
                delete feature.properties.line;

                const index = stopsJSON.indexOf(sameStop);
                stopsJSON.splice(index, 1);
            }
        }
    }
    for(const feature of subwayJSON.features) {
        if(feature.geometry.type === "LineString") {
            feature.properties.path_lines = feature.properties.line;
            delete feature.properties.line;
            delete feature.properties.end1;
            delete feature.properties.end2;

            const coords = feature.geometry.coordinates;

            const id = await getLastId() + 1;
            const path_order = await getNextOrderNumber(feature.properties.path_lines);
            const startId = findClosestStop(coords[0][1], coords[0][0], stopJSONFile, 1).obj.id;
            const endId = findClosestStop(coords[coords.length - 1][1], coords[coords.length - 1][0], stopJSONFile, 1).obj.id;
            const path_lines_db = feature.properties.path_lines;
            const path_lines_JSON = feature.properties.path_lines.split("/");
            const path_direction = 10;
            const path_length = geoJSONLength(feature, { units: 'meters' }).toFixed(3);
            let skip = 0;
            if(endId === 15102 || endId === 14708) skip = 1;

            feature.properties.id = id;
            feature.properties.path_order = path_order;
            feature.properties.startId = startId;
            feature.properties.endId = endId;
            feature.properties.path_lines = path_lines_JSON;
            feature.properties.path_direction = path_direction;
            feature.properties.path_length = path_length;
            feature.properties.skip = skip;

            if(modifyDb) {
                const values = [0, path_order, startId, endId, path_lines_db, path_direction, path_length, skip];
                db.query("INSERT INTO pathways (id, path_order, startId, endId, path_lines, path_direction, path_length, skip) VALUES (?)", [values], function (err, result) {
                    if (err) throw err;
                });
            }
        }
    }

    db.end((error) => {
        if (error) {
            console.error('Error closing MySQL connection:', error);
            return;
        }
        console.log('MySQL connection closed.');
    });

    if(returnStopJSON)
        return { subway: subwayJSON, stops: stopsJSON };
    else
        return subwayJSON;
}

export const ReplaceLineIDs = (inputFile, fieldToReplace, linesFile, removeRange = (fieldToReplace) => { return false; }) => {

    const inputJSON = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const linesJSON = JSON.parse(fs.readFileSync(linesFile, 'utf8'));

    for(let entry of inputJSON) {
        const replacement = linesJSON.find((element) => element.from === entry[fieldToReplace]);
        entry[fieldToReplace] = replacement.to;
    }
    for(let i=-1; i<inputJSON.length-1; i++) {
        while(removeRange(inputJSON[i+1][fieldToReplace].toString()))
            inputJSON.splice(i+1, 1);
    }

    return inputJSON;
}