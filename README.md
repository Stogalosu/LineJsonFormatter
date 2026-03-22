# Line JSON Formatter

## What is this?
It's a weird tool that I made to help me with a specific task while creating my app, STB Logger. I'll use it to convert and format multiple GPX files that I created. They represent every path between two public transport stops in Bucharest. This tool helps me convert them into GeoJSON and add properties (lines, id, length).

## How does it work?
It uses a database with all the stops in Bucharest to find the closest stops to the start and end of each path and saves the ids in the json's properties.

The user is asked which lines use these paths and can choose to enter one or more.

The user is also propted to choose which paths are in which direction.

Path length is calculated using a npm module.


## Why?
I thought that instead of doing this task manually, it's faster to make a script. This way, I also practice JavaScript.

## Demo video
[Screencast_20260322_231915.webm](https://github.com/user-attachments/assets/863b6159-2c13-4cef-8c38-9e0ca7bffbb7)
