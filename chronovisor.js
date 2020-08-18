/**
 * Series of classes for importing json and csv files
 * and converting them to Chronovis formmated jsons
 */
var Chronovisor;
(function (Chronovisor) {
    class Chrono {
        constructor(type, key, title, description, start, end = null, tags) {
            this.type = type;
            this.key = key;
            this.title = title;
            this.description = description;
            this.start = start;
            if (end === null || end === 0) {
                this.end = this.start;
            }
            else {
                this.end = end;
            }
            this.duration = this.end - this.start;
        }
        toJson() {
            let s = new Date(this.start);
            let e = new Date(this.end);
            return {
                "type": this.type,
                "key": this.key,
                "title": this.title,
                "description": this.description,
                "start": {
                    "minute": s.getMinutes(),
                    "second": s.getSeconds(),
                    "totalSec": s.valueOf() * 1000,
                },
                "end": {
                    "minute": e.getMinutes(),
                    "second": e.getSeconds(),
                    "totalSec": e.valueOf() * 1000
                },
                "duration": this.duration,
                "myAnnotTags": {
                // TODO: implement tags
                },
                "myPrimaryTagKey": null
            };
        }
        static Jsonify(chronos) {
            let json = {};
            let keys = {};
            for (let i = 0; i < chronos.length; i++) {
                let key;
                if (chronos[i].key) {
                    // check if in keys
                    if (chronos[i].key in keys) {
                        keys[chronos[i].key] += 1;
                    }
                    else {
                        keys[chronos[i].key] = 0;
                    }
                    key = keys[chronos[i].key].toString() + chronos[i].key;
                }
                else {
                    key = getUuid();
                }
                chronos[i].key = key;
                json[key] = chronos[i].toJson();
            }
            return json;
        }
    }
    Chronovisor.Chrono = Chrono;
    class Tag {
    }
    Chronovisor.Tag = Tag;
    /**
     * Class that maps a csv or json to a Chrono object.
     * This object can be exported or imported to speed up the process
     * of converting files.
     */
    class Map {
        constructor(type, key, title, description, start, end, tags, firstRow = false, mapName = null, timestampFormat = "C", sep = ",") {
            this.type = type;
            this.key = key;
            this.title = title;
            this.description = description;
            this.start = start;
            this.end = end;
            this.tags = tags;
            this.firstRow = firstRow;
            this.mapName = mapName;
            this.timestampFormat = timestampFormat;
            this.sep = sep;
        }
        convertCsv(data) {
            let chronos = [];
            let x = 0;
            if (this.firstRow)
                x = 1;
            for (let i = x; i < data.length; i++) {
                // separate out the csv cells
                let row = data[i].split(this.sep);
                // Parse
                let c = new Chrono((this.type === null) ? null : row[this.type], (this.key === null) ? null : row[this.key], (this.title === null) ? null : row[this.title], (this.description === null) ? null : row[this.description], (this.start === null) ? null : Map.convertTimestamp(row[this.start], this.timestampFormat) - timeOffset, (this.end === null) ? null : Map.convertTimestamp(row[this.end], this.timestampFormat) - timeOffset, (this.tags === null) ? null : row[this.tags]);
                chronos.push(c);
            }
            return chronos;
        }
        static convertTimestamp(timestamp, format = 'C') {
            if (timestamp === null)
                return null;
            if (typeof (timestamp) === 'string') {
                timestamp = parseInt(timestamp);
            }
            if (format === "pythonic") {
                timestamp = timestamp * 1000;
            }
            else if (format === "C") {
                // nanoseconds to milliseconds
                timestamp = timestamp * 0.0001;
                // offset to Unix epoch
                let d = new Date(0, 0, 0, 0, 0, 0, 0);
                d.setFullYear(1);
                d.setMonth(0);
                d.setDate(1);
                timestamp = timestamp - d.valueOf();
            }
            return timestamp;
        }
        convertJson(data) {
            // let chronos = [];
            // console.error("Not Implemented");
            // return chronos;
            let chronos = [];
            let x = 0;
            if (this.firstRow)
                x = 1;
            for (let i = x; i < data.length; i++) {
                // Parse
                let c = new Chrono((this.type === null) ? null : Map.getNestedValue(data[i], this.type), (this.key === null) ? null : Map.getNestedValue(data[i], this.key), (this.title === null) ? null : Map.getNestedValue(data[i], this.title), (this.description === null) ? null : Map.getNestedValue(data[i], this.description), (this.start === null) ? null : Map.convertTimestamp(Map.getNestedValue(data[i], this.start), this.timestampFormat) - timeOffset, (this.end === null) ? null : Map.convertTimestamp(Map.getNestedValue(data[i], this.end), this.timestampFormat) - timeOffset, (this.tags === null) ? null : Map.getNestedValue(data[i], this.tags));
                chronos.push(c);
            }
            return chronos;
        }
        static getNestedValue(data, keys) {
            if (typeof (keys) === "string")
                return keys;
            let ret = data;
            for (let i = 0; i < keys.length; i++) {
                ret = ret[keys[i]];
            }
            if (ret)
                return ret.toString();
            else
                return null;
        }
        export() {
            if (this.mapName === null) {
                this.mapName = window.prompt("Give this mapping a name", "myMap");
            }
            let json = {
                mapName: this.mapName,
                type: this.type,
                key: this.key,
                title: this.title,
                description: this.description,
                start: this.start,
                end: this.end,
                tags: this.tags,
                firstRow: this.firstRow,
                timestampFormat: this.timestampFormat,
                sep: this.sep
            };
            download(this.mapName + ".json", JSON.stringify(json));
        }
        static import(json) {
            if (typeof (json) === "string") {
                json = JSON.parse(json);
            }
            return new Map(json["type"], json["key"], json["title"], json["description"], json["start"], json["end"], json["tags"], json["firstRow"], json["mapName"], json["timestampFormat"], json["sep"]);
        }
        static getMapFromDOM(fileIndex) {
            console.log("Getting map with file index", fileIndex);
            if (typeof (fileIndex) !== "number") {
                let saveButtons = document.getElementsByClassName("chronovisor-save-mapping");
                for (let i = 0; i < saveButtons.length; i++) {
                    if (saveButtons[i] === fileIndex) {
                        fileIndex = i;
                        console.log("file index set to", i);
                    }
                }
            }
            fileIndex = parseInt(fileIndex.toString());
            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            let map = new Map(null, null, null, null, null, null, null, false, null);
            // CSV parsing
            if (table.classList.contains("csv")) {
                // Get mapping row
                let mappingRow = document.getElementsByClassName("chronovisor-selector-mapto")[fileIndex];
                let mapSelections = mappingRow.getElementsByTagName("select");
                for (let i = 0; i < mapSelections.length; i++) {
                    if (mapSelections[i].value === "ignore")
                        continue;
                    map[mapSelections[i].value] = i;
                }
            }
            // JSON parsing
            else {
                for (let i = 0; i < table.rows.length; i++) {
                    let row = table.rows[i];
                    console.log(row);
                    if (row.cells[0].getElementsByTagName("select").length > 0) {
                        let mapto = row.cells[0].getElementsByTagName("select")[0].value;
                        let accessors = [];
                        for (let c = 0; c < row.cells.length; c++) {
                            let cell = row.cells[c];
                            if (cell.getElementsByTagName("input").length > 0) {
                                accessors.push(cell.getElementsByTagName("input")[0].value);
                            }
                        }
                        if (accessors.length === 0)
                            map[mapto] = null;
                        else
                            map[mapto] = accessors;
                    }
                }
            }
            // Check static properties
            let opts = ["type", "title", "description", "start", "end", "tags"];
            for (let i = 0; i < opts.length; i++) {
                let opt = document.getElementsByClassName("chronovisor-static-" + opts[i])[fileIndex];
                let val = opt.value;
                if (val !== "") {
                    map[opts[i]] = val;
                }
            }
            // Get extras
            map.firstRow = document.getElementsByClassName("chronovisor-selector-firstrow")[fileIndex].checked;
            map.timestampFormat = document.getElementsByClassName("chronovisor-timestamp-format")[fileIndex].value;
            map.sep = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0].value;
            return map;
        }
    }
    Chronovisor.Map = Map;
    class CSV {
        /**
         * Creates a table that allows for easy mapping from the CSV to chronovis json
         * @param csv csv rows to display (just pass the first few rows)
         * @param sep the separator to use. Probably ',' or ';'
         */
        static displayCsv(csv, fileIndex, sep = ",") {
            // make table
            document.getElementsByClassName("chronovisor-selector")[fileIndex].innerHTML = "";
            let table = document.createElement("table");
            table.classList.add("csv");
            // Create rows and populate them
            for (let i = 0; i < csv.length; i++) {
                let elms = csv[i].split(sep);
                // Create selection row
                if (i === 0) {
                    table.appendChild(this.createSelection(elms.length));
                }
                let row = document.createElement("tr");
                for (let j = 0; j < elms.length; j++) {
                    let cell = document.createElement("td");
                    cell.innerHTML = elms[j];
                    row.appendChild(cell);
                }
                table.appendChild(row);
            }
            document.getElementsByClassName("chronovisor-selector")[fileIndex].appendChild(table);
        }
        /**
         * Creates a row filled with selection boxes
         * each selection box has the same options.
         * These options correspond to which chronovis properties the row should correspond to.
         * @param {number} numberOfCells number of columns to make with selection boxes
         */
        static createSelection(numberOfCells) {
            let row = document.createElement("tr");
            row.classList.add("chronovisor-selector-mapto");
            for (let i = 0; i < numberOfCells; i++) {
                let cell = document.createElement("td");
                let sel = document.createElement("select");
                // Create options
                let opts = ["ignore", "type", "title", "description", "start", "end", "tags"];
                for (let j = 0; j < opts.length; j++) {
                    let opt = document.createElement("option");
                    opt.value = opts[j];
                    opt.innerHTML = opts[j];
                    sel.appendChild(opt);
                }
                if (i < opts.length) {
                    sel.value = opts[i];
                }
                cell.appendChild(sel);
                row.appendChild(cell);
            }
            return row;
        }
    }
    Chronovisor.CSV = CSV;
    class Json {
        static displayJson(json, fileIndex) {
            // make table
            let container = document.getElementsByClassName("chronovisor-selector")[fileIndex];
            container.innerHTML = "";
            let table = document.createElement("table");
            table.classList.add("json");
            container.appendChild(table);
            // Create rows and populate them with json data
            Json.showSamples(fileIndex, 0, 5);
            Json.createSelection(fileIndex, table);
            document.getElementsByClassName("chronovisor-selector")[fileIndex].appendChild(table);
        }
        static showSamples(fileIndex, startIndex, endIndex) {
            // Check valid indecies
            if (startIndex < 0 || startIndex > data[fileIndex].length || endIndex < startIndex || endIndex >= data[fileIndex].length) {
                console.error("Invalid indecies");
            }
            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            if (table.rows[0]) {
                table.rows[0].innerHTML = "";
            }
            else {
                table.insertRow(0);
            }
            for (let i = endIndex - 1; i >= startIndex; i--) {
                let cell = table.rows[0].insertCell(0);
                let span = document.createElement("div");
                span.innerHTML = JSON.stringify(data[fileIndex][i], null, 4);
                cell.appendChild(span);
            }
        }
        static addNestedProperty(ev) {
            let row = ev.target.parentElement.parentElement;
            let cell = row.insertCell(-1);
            // Add input
            let input = document.createElement("input");
            input.type = "text";
            // Add remove button
            let rm = document.createElement("button");
            rm.innerHTML = "-";
            rm.onclick = Json.rmNestedProperty;
            // add to DOM
            cell.appendChild(input);
            cell.appendChild(rm);
        }
        static rmNestedProperty(ev) {
            let cell = ev.target.parentElement;
            let row = cell.parentElement;
            row.deleteCell(cell.cellIndex);
        }
        static createSelection(fileIndex) {
            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            let opts = ["type", "title", "description", "start", "end", "tags"];
            for (let i = opts.length - 1; i >= 0; i--) {
                let row = table.insertRow(1);
                // Create selection element
                let selectionRow = row.insertCell(0);
                let sel = document.createElement("select");
                for (let j = 0; j < opts.length; j++) {
                    let opt = document.createElement("option");
                    opt.value = opts[j];
                    opt.innerHTML = opts[j];
                    sel.appendChild(opt);
                }
                sel.value = opts[i];
                selectionRow.appendChild(sel);
                // Create button for adding nested property
                let addRow = row.insertCell(-1);
                let button = document.createElement("button");
                button.innerHTML = "add property";
                button.onclick = Json.addNestedProperty;
                addRow.appendChild(button);
            }
            Json.addRowButton(table);
        }
        static addRow(ev) {
            let table = ev.target.parentElement.parentElement.parentElement;
            table.deleteRow(-1);
            let row = table.insertRow(-1);
            let opts = ["type", "title", "description", "start", "end", "tags"];
            // Create selection element
            let selectionRow = row.insertCell(0);
            let sel = document.createElement("select");
            for (let j = 0; j < opts.length; j++) {
                let opt = document.createElement("option");
                opt.value = opts[j];
                opt.innerHTML = opts[j];
                sel.appendChild(opt);
            }
            sel.value = opts[0];
            selectionRow.appendChild(sel);
            // Create button for adding nested property
            let addRow = row.insertCell(-1);
            let button = document.createElement("button");
            button.innerHTML = "add property";
            button.onclick = Json.addNestedProperty;
            addRow.appendChild(button);
            Json.addRowButton(table);
        }
        static addRowButton(table) {
            let row = table.insertRow(-1);
            let cell = row.insertCell(0);
            let button = document.createElement("button");
            button.innerHTML = "add row";
            button.onclick = Json.addRow;
            cell.style.columnSpan = -1;
            cell.appendChild(button);
        }
    }
    Chronovisor.Json = Json;
})(Chronovisor || (Chronovisor = {}));
/*
==========================
        MAIN
==========================
*/
var data = [null];
var og_data = [null];
var files = [null];
var maps = [null];
var fileTemplate;
var timeOffset;
function onLoad() {
    fileTemplate = document.getElementsByClassName("chronovisor-converter-template")[0];
}
/**
 * Handles import of csv or json data to be converted to chronovis format
 * @param input event data from <input>'s onchange callback
 */
function onImport(input) {
    let inputFields = document.getElementsByClassName("chronovisor-input-file");
    let fileIndex = 0;
    for (let i = 0; i < inputFields.length; i++) {
        if (inputFields[i] === input) {
            fileIndex = i;
            console.debug("File index set to", i);
            break;
        }
    }
    let file = input.files[0];
    if (!file) {
        return;
    }
    files[fileIndex] = input.files[0].name;
    // Setup reader
    let reader = new FileReader();
    reader.onerror = function () {
        console.error("Failed to parse file");
    };
    if (file.name.indexOf(".csv") !== -1) {
        reader.onload = function (ev) {
            let contents = ev.target.result.toString();
            data[fileIndex] = contents.split(/[\r\n]+/g);
            og_data[fileIndex] = data[fileIndex];
            let separatorContainer = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex];
            separatorContainer.style.visibility = "visible";
            let separator = separatorContainer.getElementsByTagName("input")[0].value;
            Chronovisor.CSV.displayCsv(data[fileIndex].slice(0, 4), fileIndex, separator);
        };
    }
    else if (file.name.indexOf(".json") !== -1) {
        reader.onload = function (ev) {
            let contents = ev.target.result.toString();
            data[fileIndex] = JSON.parse(contents);
            og_data[fileIndex] = data[fileIndex];
            let separatorContainer = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex];
            separatorContainer.style.visibility = "hidden";
            Chronovisor.Json.displayJson(data[fileIndex].slice(0, 4), fileIndex);
        };
    }
    else {
        console.error("Invalid file type", file.name);
    }
    reader.readAsText(file);
}
/**
 * Updates the display of data when the csv separator character is changed
 */
function updateSeparator(ev) {
    let fileIndex = 0;
    let sepFields = document.getElementsByClassName("chronovisor-csv-sep");
    for (let i = 0; i < sepFields.length; i++) {
        if (sepFields[i] === ev.parentNode) {
            fileIndex = i;
            console.debug("Sep field index set to", i);
            break;
        }
    }
    let separator = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0].value;
    Chronovisor.CSV.displayCsv(data.slice(0, 4), fileIndex, separator);
}
/**
 * Converts csv/json to chronovis json.
 */
function convert() {
    // get time offset
    timeOffset = document.getElementById("chronovisor-time-offset").value;
    let timeOffsetFormat = document.getElementById("chronovisor-time-offset-format").value;
    timeOffset = Chronovisor.Map.convertTimestamp(timeOffset, timeOffsetFormat);
    let chronos = [];
    for (let i = 0; i < data.length; i++) {
        if (maps[i] === null) {
            maps[i] = Chronovisor.Map.getMapFromDOM(i);
        }
        if (files[i].indexOf(".csv") !== -1) {
            chronos = chronos.concat(maps[i].convertCsv(data[i]));
        }
        else {
            chronos = chronos.concat(maps[i].convertJson(data[i]));
        }
    }
    let formattedChronos = Chronovisor.Chrono.Jsonify(chronos);
    download("output.chronovis.json", JSON.stringify(formattedChronos));
}
/**
 * sets the map data being used when a map file is uploaded
 * @param input file sent from <input>'s onchange callback
 */
function loadMap(input) {
    let file = input.files[0];
    if (!file) {
        return;
    }
    // Get fileIndex
    let mapFields = document.getElementsByClassName("chronovisor-map-file");
    let fileIndex = 0;
    for (let i = 0; i < mapFields.length; i++) {
        if (mapFields[i] === input) {
            fileIndex = i;
            console.debug("map index set to", i);
            break;
        }
    }
    // Setup reader
    let reader = new FileReader();
    reader.onerror = function () {
        console.error("Failed to parse file");
    };
    reader.onload = function (ev) {
        let contents = JSON.parse(ev.target.result.toString());
        maps[fileIndex] = Chronovisor.Map.import(contents);
    };
    reader.readAsText(file);
}
/**
 * Adds another UI set for parsing files
 */
function addFile() {
    console.log("Adding File options");
    document.getElementById("chronovisor-converter-container").appendChild(fileTemplate.cloneNode(true));
    maps.push(null);
    files.push(null);
    data.push(null);
    og_data.push(null);
}
function readMetaFile(ev) {
    ev.preventDefault();
    console.log(ev);
    let file;
    if (ev.dataTransfer.items) {
        if (ev.dataTransfer.items[0].kind === 'file') {
            file = ev.dataTransfer.items[0].getAsFile();
        }
    }
    else {
        file = ev.dataTransfer.files[0];
    }
    console.log(file.name, file);
    let reader = new FileReader();
    reader.onerror = function () {
        console.error("Failed to parse file");
    };
    reader.onload = function (ev) {
        let contents = JSON.parse(ev.target.result.toString());
        let property = window.prompt(JSON.stringify(contents, null, 4), "startTimePropertyName");
        document.getElementById("chronovisor-time-offset").value = contents[property];
    };
    reader.readAsText(file);
}
function allowDrop(ev) {
    ev.preventDefault();
}
/**
 * downloads a text based file.
 * @param filename name of the file to download
 * @param text the file contents as a string
 */
function download(filename, text) {
    let elm = document.createElement('a');
    elm.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    elm.setAttribute("download", filename);
    elm.style.display = 'none';
    document.body.appendChild(elm);
    elm.click();
    document.body.removeChild(elm);
}
/**
 * Generates a unique identifier
 */
function getUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
//# sourceMappingURL=chronovisor.js.map