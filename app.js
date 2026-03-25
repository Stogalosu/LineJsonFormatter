import fs from 'node:fs';
import path from "node:path";
import gpxParser from 'gpxparser';
import { loadEnvFile } from 'node:process';
import mysql from 'mysql2';
import { input } from '@inquirer/prompts';
import { select } from '@inquirer/prompts';

export const LineJSONFormatter = async (inputPath, stopJSONPath) => {

    loadEnvFile();

    const isFile = fileName => {
        return fs.lstatSync(fileName).isFile();
    };
    const files =
        fs.readdirSync(inputPath)
            .map(fileName => {
                return path.join(inputPath, fileName);
            })
            .filter(isFile);

    let db = mysql.createConnection({
        host: process.env.LJF_DB_HOST,
        user: process.env.LJF_DB_USER,
        password: process.env.LJF_DB_PASSWORD
    });

    db.connect(function (err) {
        if (err) throw err;
        db.query("USE stb_pathways", function (err, result) {
            if (err) throw err;
        });
    });

    async function getLastId() {
        const idQuery = await db.promise().query("SELECT id FROM pathways ORDER BY id DESC LIMIT 1");
        if (idQuery[0][0] === undefined) return -1;
        return idQuery[0][0].id;
    }

    async function getNextOrderNumber(line) {
        const queryResult = await db.promise().query("SELECT MAX(path_order) as highest_path_order FROM pathways WHERE path_lines = ?", [line]);

        if (queryResult[0][0].highest_path_order === undefined) return 1;
        return queryResult[0][0].highest_path_order + 1;
    }

    function findClosestStop(targetLat, targetLon) {
        const stopsJSON = JSON.parse(fs.readFileSync(stopJSONPath, 'utf8'));
        return stopsJSON.reduce((closest, obj) => {
            const diff = Math.sqrt(
                Math.pow(obj.latitude - targetLat, 2) +
                Math.pow(obj.longitude - targetLon, 2)
            );
            return diff < closest.diff ? {obj, diff} : closest;
        }, {obj: null, diff: Infinity});
    }

    function getStopsInRange(lat, lon, range) {
        const stopsJSON = JSON.parse(fs.readFileSync(stopJSONPath, 'utf8'));
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
    let i = 0;
    for (const file of files) {
        console.log("Processing file " + file);
        var gpx = new gpxParser();
        gpx.parse(fs.readFileSync(file, 'utf8'));
        const json = gpx.toGeoJSON();

        const coords = json.features[0].geometry.coordinates;
        const startStop = findClosestStop(coords[0][1], coords[0][0]).obj;
        const endStop = findClosestStop(coords[coords.length - 1][1], coords[coords.length - 1][0]).obj;

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

        i++;
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

    let mistakes = [];

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

        // Store mistake to correct them later
        mistakes.push({
            oldStop: stopToModify,
            newStop: newStop
        });
        console.log(mistakes);

        // Correct mistake only in console output
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
    let lines = [];
    let mainLine = "";
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
                pattern: RegExp('[MN]*[1-9][0-9]*B*'),
                patternError: 'Please enter a valid line!'
            }
        )
        mainLine = localMainLine;
        for (let j = 0; j < i; j++) {
            lines[j] = localMainLine;
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
                pattern: RegExp('[MN]*[1-9][0-9]*B*'),
                patternError: 'Please enter a valid line!'
            });
            for (let k = start; k <= end; k++) {
                lines[k] = lines[k] + "," + line;
            }
        }
    } else {
        const line = await input({
            message: `Enter the line:`,
            required: true,
            pattern: RegExp('[MN]*[1-9][0-9]*B*'),
            patternError: 'Please enter a valid line!'
        });
        for (let j = 0; j < i; j++) {
            lines[j] = line;
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


    let lastStopId = 0;
    let finalJSON = {};
    i = 0;
    for (const file of files) {
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

        const coords = json1.features[0].geometry.coordinates;

        const id = await getLastId() + 1;
        const path_order = await getNextOrderNumber(lines[i]);
        let startId = findClosestStop(coords[0][1], coords[0][0]).obj.id;
        let endId = findClosestStop(coords[coords.length - 1][1], coords[coords.length - 1][0]).obj.id;
        const path_lines_JSON = lines[i].split(",");
        const path_lines_db = lines[i];
        const path_direction = getPathDirection(i, directions);
        const path_length = gpx1.tracks[0].distance.total.toFixed(3);
        let skip = 0;

        // Correct mistakes
        let modified = false;
        mistakes.forEach((mis) => {
            if (!modified) {
                if (mis.oldStop.id === startId) {
                    startId = mis.newStop.id;
                    modified = true;
                } else if (mis.oldStop.id === endId) {
                    endId = mis.newStop.id;
                    modified = true;
                }
            }
        });

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
        i++;
    }

    // console.log("Writing file that contains all paths...");
    // const outputFile = outputPath + "/" + mainLine + ".geojson";
    // fs.writeFileSync(outputFile, JSON.stringify(finalJSON));

    db.end((error) => {
        if (error) {
            console.error('Error closing MySQL connection:', error);
            return;
        }
        console.log('MySQL connection closed.');
    });

    return finalJSON;
}