# Line JSON Formatter

## What is this?
It's a weird tool that I made to help me with a specific task while creating my app, STB Logger. I'll use it to convert and format multiple GPX files that I created. They represent every path between two public transport stops in Bucharest. This tool helps me convert them into GeoJSON, add properties (lines, id, length) and save them all in a MySQL database.

## How does it work?
<ins>**LineJSONFormatter**</ins>

It uses a database with all the stops in Bucharest to find the closest stops to the start and end of each path and saves the ids in the json's properties.

The user is asked which lines use these paths and can choose to enter one or more.

The user is also prompted to choose which paths are in which direction.

Path length is calculated using a npm module.

<ins>**SubwayJSONFormatter**</ins>

It takes a GeoJSON file with paths and stops corresponding to subway lines as input. I created it so that it uses a format I already have. The program uses the coordinates of the stops from the GeoJSON file, but uses the ids of stops in the stopJSON file. In order to avoid duplicates, stops whose ids have been used are deleted from the stopJSON file.

The paths are processed in the same way as the LineJSONFormatter function does. The only difference is the format of the input.

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
import { LineJSONFormatter, SubwayJSONFormatter } from "./app.js";

const formattedJSON = await LineJSONFormatter("input/", "stops.json");
const formattedSubwayJSON = await SubwayJSONFormatter("input/Metrou 2.geojson", "stb-stops.json", true);
```

## Documentation
The function `LineJSONFormatter` has 2 parameters:
| **Argument** | **Type** | **Description** |
| ------------ | -------- | --------------- |
| inputPath    | String   | The path where input gpx files are situated |
| stopJSONFile | String   | The JSON file that contains formatted stops |

The function `SubwayJSONFormatter' has 3 parameters:

| **Argument** | **Type** | **Required**               | **Description**                                                      |
| ------------ | -------- |----------------------------|----------------------------------------------------------------------|
| inputFile | String | Yes                        | The file that contains the paths to be formatted                     |
| stopJSONFile | String | Yes                        | The JSON file that contains formatted stops                          |
| returnStopJSON | Boolean | No, default value is false | Whether the function should return the modified stopJSON file or not |

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

<ins>**Subway GeoJSON format**</ins>

The subway GeoJSON file has to be of type `FeatureCollection` and has to only contain features of types `Point` and `LineString`.

Points must have the following properties:
- name - String - The name of the stop.
- line - String - Stores the lines that stop there. Lines must be separated by "/".

LineStrings must have the following properties:
- line - String - Stores the lines that stop there. Lines must be separated by "/".
- end1 - Int - One of the stops that the path connects.
- end2 - Int - The other stop.

Features may have other properties besides the required ones.

Example:
```
{
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": 49,
        "name": "1 Mai",
        "line": "M4"
      },
      "geometry": {
        "coordinates": [
          26.050627,
          44.470534,
          91.580843
        ],
        "type": "Point"
      },
      "id": "0598478d0b02151caba0b3d7813a2df9"
    },
    {
      "type": "Feature",
      "properties": {
        "line": "M1",
        "end1": 8,
        "end2": 9
      },
      "geometry": {
        "coordinates": [
          [
            26.068367,
            44.450738,
            81.30971
          ],
          [
            26.067905,
            44.451043,
            81.163368
          ]
        ],
        "type": "LineString"
      },
      "id": "07c9e42a96d13b687ed7b3d69647570c"
    }
  ]
}
```

## AI Usage
I used AI to help me with the closest distance algorithm.

## Demo videos
**LineJSONFormatter**
[Screencast_20260322_232538.webm](https://github.com/user-attachments/assets/37a75bbc-a608-472f-8423-5155ba38299b)
**SubwayJSONFormatter**
[Screencast_20260329_213430.webm](https://github.com/user-attachments/assets/cc97e6ae-b287-4d69-a25d-1fc346d8c219)
