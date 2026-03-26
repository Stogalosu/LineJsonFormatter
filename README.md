# Line JSON Formatter

## What is this?
It's a weird tool that I made to help me with a specific task while creating my app, STB Logger. I'll use it to convert and format multiple GPX files that I created. They represent every path between two public transport stops in Bucharest. This tool helps me convert them into GeoJSON, add properties (lines, id, length) and save them all in a MySQL database.

## How does it work?
It uses a database with all the stops in Bucharest to find the closest stops to the start and end of each path and saves the ids in the json's properties.

The user is asked which lines use these paths and can choose to enter one or more.

The user is also propted to choose which paths are in which direction.

Path length is calculated using a npm module.

## Why?
I thought that instead of doing this task manually, it's faster to make a script. This way, I also practice JavaScript.

## Installation and usage
**Install from npm**
```
npm intall --save line-json-formatter
```
Link to npm module:

**Use in a node.js script**
```
import { LineJSONFormatter } from 'line-json-formatter';

const formattedJSON = await LineJSONFormatter("input/", "stops.json");
```

## Documentation
The function `LineJSONFormatter` has 2 parameters:
| **Argument** | **Type** | **Description** |
| ------------ | -------- | --------------- |
| inputPath    | String   | The path where input gpx files are situated |
| stopJSONPath | String   | The JSON file that contains formatted stops |

The module also requires 3 environmental variables. **You must define these in your .env file!**
| **Variable name** | **Description** |
| ----------------- | --------------- |
| LJF_DB_USER | The MySQL database user |
| LJF_DB_PASSWORD | The database password |
| LJF_DB_HOST | The ip address where the database is hosted (if hosted locally, should be 127.0.0.1) |



<ins>**Stop JSON format**</ins>

The stop JSON must contain an array of objects, each with the following properties: id, name, latitude, longitude.

Example:
```
[
  {
    "id": 3654,
    "name": "1 Mai",
    "latitude": 44.419407,
    "longitude": 26.047092
  },
  {
    "id": 8682,
    "name": "1 Martie",
    "latitude": 44.422333,
    "longitude": 25.878494
  }
}
```

## AI Usage
I used AI to help me with the closest distance algorithm.

## Demo video
[Screencast_20260322_232538.webm](https://github.com/user-attachments/assets/37a75bbc-a608-472f-8423-5155ba38299b)
