/**
 * @summary Series of classes for importing json and csv files and converting them to Chronovis formmated jsons
 * @author Tommy Sharkey
 * @contact tsharkey@ucsd.edu
 * 
 * Classes (contained in namespace Chronovisor):
 *      Chrono: an object that has all of the chronovis data. Can be exported as csv or json
 *      Map: object representing a mapping from an arbitrary csv/json to a Chrono object. Contains info like: column 3 of foo.csv corresponds to Chrono.start
 *      Json: object used for importing an arbitrary json. Creates the UI used for forming a Map from the Json
 *      Csv: object used for importing an arbitrary csv. Creates the UI used for forming a Map from the Csv.
 *      Tag: unused. Supposed to represent chronovis tags
 * 
 * Additional functions:
 *      addFile: handles the drag and drop of a meta file into the 'offset timestamps by' div. calls readMetaFile
 *      allowDrop: allows use of addFile
 *      convert: function calls on objects to map a chosen file to a list of Chronos, and then downloads them to the chosen format (csv or json)
 *      download: helper function for downloading text files
 *      getUuid: helper function for generating unique ids for the exported Chronovis Json files
 *      loadMap: if the user loads a custom map json file, this function handles the parsing of it. Calls on Map object to update the HTML to reflect properties in the created Map
 *      onImport: handles import of a data file (json/csv). Calls on Csv and Json classes to setup the UI for mapping this data to Chrono objects
 *      onLoad: sets up some initial params
 *      readMetaFile: reads a meta file and sets the global timestamp offset (used when timestamps aren't relative to the start of the video)
 *      updateSeparator: eventListener for when user updates the separator character used for parsing csv files
 * 
 * Global Variables:
 *      data: list of imported data (csvs and jsons) extracted from files.
 *      errors: list of errors and warnings raised during the export process. Used for developers only.
 *      files: list of imported files' names. Indecies are the same as data
 *      fileTemplate: instantiated in onLoad. a copy of the main upload body. Can be duplicated to allow for multiple files to be uploaded
 *      maps: list of maps from imported data to chrono objects (indecies are the same as data)
 *      timeOffset: amount to offset all timestamps by. This is useful if timestamps are absolute / aren't relative to the start of the video
 */

namespace Chronovisor {
    export class Chrono {
        type: string;
        key: string;
        title: string;
        description: string;
        start: number;
        end: number;
        duration: number;
        tags: string;
        myPrimaryTagKey: string

        constructor(type: string, key: string, title: string, description: string, start: number, end: number = null, tags: string) {
            this.type = type;
            this.key = key;
            this.title = title;
            this.description = description;
            this.start = start;
            if (end === null || end === 0) {
                this.end = this.start;
            } else {
                this.end = end;
            }
            this.duration = this.end - this.start;

            if (!this.start) {
                errors.push({
                    "type": "warn",
                    "function": "Chron.constructor",
                    "message": "invalid start time",
                    "data": {
                        "start": this.start,
                        "end": this.end
                    }
                });
            }
        }

        public toJson(): object {
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
            }
        }

        public toCsv(sep: string = ","): string {
            if (!this.start || !this.end) {
                errors.push({
                    "type": "error",
                    "function": "toCsv",
                    "message": "couldn't convert start or end time to Date object",
                    "data": {
                        "start": this.start,
                        "end": this.end
                    }
                });
            }
            let s = this.start ? new Date(this.start) : null;
            let e = this.end ? new Date(this.end) : null;
            console.log("DATES", s, e);
            let csv = [
                this.title ? this.title.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.description ? this.description.replace(sep, (sep === "," ? ";" : ",")) : "",
                s ? s.toISOString().split(/[TZ]/)[1] : "",
                s ? s.valueOf() / 1000 : "",
                e ? e.toISOString().split(/[TZ]/)[1] : "",
                e ? e.valueOf() / 1000 : "",
                this.duration,
                "",
                this.tags ? this.tags.replace(sep, (sep === "," ? ";" : ",")) : ""
            ]
            return csv.join(sep);
        }

        public toOldCsv(sep: string = ","): string {
            if (!this.start || !this.end) {
                errors.push({
                    "type": "error",
                    "function": "toOldCsv",
                    "message": "couldn't convert start or end time to Date object",
                    "data": {
                        "start": this.start,
                        "end": this.end
                    }
                });
            }
            let s = (this.start) ? new Date(this.start) : null;
            let e = (this.end) ? new Date(this.end) : null;
            let csv = [
                s ? s.toISOString().split(/[TZ]/)[1] : "",
                e ? e.toISOString().split(/[TZ]/)[1] : "",
                this.title ? this.title.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.tags ? this.tags.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.description ? this.description.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.title ? this.title.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.type ? this.type.replace(sep, (sep === "," ? ";" : ",")) : ""
            ]
            return csv.join(sep);
        }

        public static Jsonify(chronos: Chrono[]): object {
            let json = {};
            let keys = {};

            for (let i = 0; i < chronos.length; i++) {
                let key;
                if (chronos[i].key) {
                    // check if in keys
                    if (chronos[i].key in keys) {
                        keys[chronos[i].key] += 1;
                    } else {
                        keys[chronos[i].key] = 0;
                    }
                    key = keys[chronos[i].key].toString() + chronos[i].key
                } else {
                    key = getUuid();
                }

                chronos[i].key = key;
                json[key] = chronos[i].toJson();
            }

            return json;
        }

        public static Csvify(chronos: Chrono[], useOldFormat: boolean = false): string {
            let csv;

            if (useOldFormat) {
                // Set headers
                csv = ["StartTime,EndTime,Title,Annotation,MainCategory,Category2,Category3"];
                // Get data
                for (let i = 0; i < chronos.length; i++) {
                    csv.push(chronos[i].toOldCsv());
                }
            } else {
                csv = ["Title,Description,Start(HMS),Start(sec),End(HMS),End(sec),Duration(sec),PrimaryTag,Tags"];
                for (let i = 0; i < chronos.length; i++) {
                    csv.push(chronos[i].toCsv());
                }
            }

            return csv.join("\r\n");
        }

    }

    export class Tag {

    }


    /**
     * Class that maps a csv or json to a Chrono object.
     * This object can be exported or imported to speed up the process
     * of converting files.
     */
    export class Map {

        public type;
        public key;
        public title;
        public description;
        public start;
        public end;
        public tags;
        public firstRow: boolean;
        public mapName;
        public timestampFormat;
        public sep;

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

        public convertCsv(data: string[]): Chrono[] {
            let chronos = [];

            let x = 0;
            if (this.firstRow) x = 1;
            for (let i = x; i < data.length; i++) {

                // separate out the csv cells
                let row = data[i].split(this.sep);

                // Parse
                let c = new Chrono(
                    (this.type === null) ? null : row[this.type],
                    (this.key === null) ? null : row[this.key],
                    (this.title === null) ? null : row[this.title],
                    (this.description === null) ? null : row[this.description],
                    (this.start === null) ? null : Map.convertTimestamp(row[this.start], this.timestampFormat) - timeOffset,
                    (this.end === null) ? null : Map.convertTimestamp(row[this.end], this.timestampFormat) - timeOffset,
                    (this.tags === null) ? null : row[this.tags]
                )

                chronos.push(c);
            }

            return chronos;
        }

        public static convertTimestamp(timestamp: number | string, format = 'C'): number {
            if (timestamp === null) {
                errors.push({
                    "type": "error",
                    "function": "convertTimestamp",
                    "message": "invalid timestamp",
                    "data": {
                        "timestamp": timestamp,
                        "format": format
                    }
                });
                return null;
            }

            if (typeof (timestamp) === 'string') {
                timestamp = parseInt(timestamp);
            }

            if (format === "pythonic") {
                timestamp = timestamp * 1000;
            } else if (format === "C") {
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

        public convertJson(data: object[]): Chrono[] {
            // let chronos = [];
            // console.error("Not Implemented");
            // return chronos;



            let chronos = [];

            let x = 0;
            if (this.firstRow) x = 1;
            for (let i = x; i < data.length; i++) {
                // Parse
                let c = new Chrono(
                    (this.type === null) ? null : Map.getNestedValue(data[i], this.type),
                    (this.key === null) ? null : Map.getNestedValue(data[i], this.key),
                    (this.title === null) ? null : Map.getNestedValue(data[i], this.title),
                    (this.description === null) ? null : Map.getNestedValue(data[i], this.description),
                    (this.start === null) ? null : Map.convertTimestamp(Map.getNestedValue(data[i], this.start), this.timestampFormat) - timeOffset,
                    (this.end === null) ? null : Map.convertTimestamp(Map.getNestedValue(data[i], this.end), this.timestampFormat) - timeOffset,
                    (this.tags === null) ? null : Map.getNestedValue(data[i], this.tags)
                )

                chronos.push(c);
            }

            return chronos;
        }

        private static getNestedValue(data: object, keys: string[] | string): string {
            if (typeof (keys) === "string") return keys;
            let ret = data;
            for (let i = 0; i < keys.length; i++) {
                ret = ret[keys[i]];
            }
            if (ret) return ret.toString();
            else return null;
        }

        public
        export () {
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
            }
            download(this.mapName + ".json", JSON.stringify(json));
        }

        public static import(json: object): Map {
            if (typeof (json) === "string") {
                json = JSON.parse(json);
            }

            return new Map(
                json["type"],
                json["key"],
                json["title"],
                json["description"],
                json["start"],
                json["end"],
                json["tags"],
                json["firstRow"],
                json["mapName"],
                json["timestampFormat"],
                json["sep"]
            );
        }

        private applyCsvDomElm(item, name:string, mapSelections, fileIndex) {
            if (item !== null && item !== undefined) { 
                if (typeof (item) === "string") {
                    console.log("Setting Static", name);
                    (document.getElementsByClassName("chronovisor-static-"+name)[fileIndex] as HTMLInputElement).value = item;
                } else {
                    console.log("Setting", name, "to", item, "on", mapSelections[item]);
                    mapSelections[item].value = name;
                }
            }
        }

        /**
         * Uses the data from this map to set DOM elements
         * @param fileIndex the index of elements to apply the map to
         */
        public applyMapToDom(fileIndex: number) {
            console.log("Applying map to DOM");
            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            let items = {"type":this.type, "key":this.key, "title":this.title, "description":this.description, "start":this.start, "end":this.end, "tags":this.tags};
            let keys = Object.keys(items);
            console.log(table, items, keys);

            // Erase static fields
            for (let k in keys) {
                (document.getElementsByClassName("chronovisor-static-"+keys[k])[fileIndex] as HTMLInputElement).value = "";
            }

            // CSV
            if (table.classList.contains("csv")) {
                console.log("Is CSV");
                let mapSelections = table.rows[0].getElementsByTagName("select");
                console.log("Map Selections", mapSelections);
                // Set all to 'ignore' to start
                for (let s in mapSelections) {
                    mapSelections[s].value = 'ignore';
                }
                for (let k in keys) {
                    console.log("Setting", keys[k], "to", items[keys[k]], "targetting", mapSelections[items[keys[k]]]);
                    this.applyCsvDomElm(items[keys[k]], keys[k], mapSelections, fileIndex);
                }

                // update table
                CSV.displayCsv(data[fileIndex].slice(0,4), fileIndex, this.sep);
            }
            // JSON
            else {
                console.log("Is JSON");
                for (let i=0; i<keys.length; i++) {
                    let row = table.rows[i+1];
                    console.log("Setting", keys[i], "to", items[keys[i]], "on elm", row.cells[0].getElementsByTagName("select")[0]);
                    row.cells[0].getElementsByTagName("select")[0].value = keys[i];
                    let addProp = row.cells[1].getElementsByTagName("button")[0];
                    if (items[keys[i]]) {
                        if (typeof(items[keys[i]]) === "string") {
                            console.log("Setting static");
                            (document.getElementsByClassName("chronovisor-static-"+keys[i])[fileIndex] as HTMLInputElement).value = items[keys[i]];
                        }
                        else {
                            console.log("Setting dynamic")
                            for (let j=0; j<items[keys[i]].length; j++) {
                                addProp.click();
                                row.cells[j+2].getElementsByTagName("input")[0].value = items[keys[i]][j];
                            }
                        }
                    }
                }
            }
            
            // firstRow
            let fr = document.getElementsByClassName("chronovisor-selector-firstrow")[fileIndex] as HTMLInputElement;
            fr.checked = this.firstRow;
            // timestampFormat
            let time = document.getElementsByClassName("chronovisor-timestamp-format")[fileIndex] as HTMLInputElement;
            time.value = this.timestampFormat;
            // sep
            let sep = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0] as HTMLInputElement;
            sep.value = this.sep;
            console.debug("First Row", fr.checked, this.firstRow, "\nTimestamp", time.value, this.timestampFormat, "\nSeparator", sep.value, this.sep);
        }

        public static getMapFromDOM(fileIndex: number | Node): Map {
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
                    if (mapSelections[i].value === "ignore") continue;

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
                        if (accessors.length === 0) map[mapto] = null;
                        else map[mapto] = accessors;

                    }
                }
            }

            // Check static properties
            let opts = ["type", "title", "description", "start", "end", "tags"];
            for (let i = 0; i < opts.length; i++) {
                let opt = document.getElementsByClassName("chronovisor-static-" + opts[i])[fileIndex] as HTMLInputElement;
                let val = opt.value;
                if (val !== "") {
                    map[opts[i]] = val;
                }
            }

            // Get extras
            map.firstRow = (document.getElementsByClassName("chronovisor-selector-firstrow")[fileIndex] as HTMLInputElement).checked;
            map.timestampFormat = (document.getElementsByClassName("chronovisor-timestamp-format")[fileIndex] as HTMLInputElement).value;
            map.sep = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0].value;

            return map;
        }

    }

    export class CSV {

        /**
         * Creates a table that allows for easy mapping from the CSV to chronovis json
         * @param csv csv rows to display (just pass the first few rows)
         * @param sep the separator to use. Probably ',' or ';'
         */
        public static displayCsv(csv: string[], fileIndex: number, sep: string = ",") {
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
        public static createSelection(numberOfCells: number) {
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

    export class Json {

        public static displayJson(json: [], fileIndex: number) {
            // make table
            let container = document.getElementsByClassName("chronovisor-selector")[fileIndex];
            container.innerHTML = "";
            let table = document.createElement("table");
            table.classList.add("json");
            container.appendChild(table);


            // Create rows and populate them with json data
            Json.showSamples(fileIndex, 0, 5);
            Json.createSelection(fileIndex);

            document.getElementsByClassName("chronovisor-selector")[fileIndex].appendChild(table);
        }

        public static showSamples(fileIndex: number, startIndex: number, endIndex: number) {
            // Check valid indecies
            if (startIndex < 0 || startIndex > data[fileIndex].length || endIndex < startIndex || endIndex >= data[fileIndex].length) {
                console.error("Invalid indecies");
            }

            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            if (table.rows[0]) {
                table.rows[0].innerHTML = "";
            } else {
                table.insertRow(0);
            }
            for (let i = endIndex - 1; i >= startIndex; i--) {
                let cell = table.rows[0].insertCell(0);
                let span = document.createElement("div");
                span.innerHTML = JSON.stringify(data[fileIndex][i], null, 4);
                cell.appendChild(span);
            }
        }

        public static addNestedProperty(ev) {
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

        public static rmNestedProperty(ev) {
            let cell = ev.target.parentElement;
            let row = cell.parentElement;
            row.deleteCell(cell.cellIndex);
        }

        public static createSelection(fileIndex: number) {
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

        public static addRow(ev) {
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

        private static addRowButton(table: HTMLTableElement) {
            let row = table.insertRow(-1);
            let cell = row.insertCell(0);
            let button = document.createElement("button");
            button.innerHTML = "add row";
            button.onclick = Json.addRow;
            cell.style.columnSpan = "-1";
            cell.appendChild(button);
        }
    }
}







/* 
==========================
        MAIN
========================== 
*/

var data = [null];
var og_data = [null];
var files = [null];
var maps = [null];
var fileTemplate
var timeOffset;
var errors = [];

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
            console.debug("File index set to", i)
            break;
        }
    }


    let file: File = input.files[0];
    if (!file) {
        return;
    }
    files[fileIndex] = input.files[0].name;

    // Setup reader
    let reader = new FileReader();
    reader.onerror = function () {
        console.error("Failed to parse file");
    }

    if (file.name.indexOf(".csv") !== -1) {
        reader.onload = function (ev) {
            let contents = ev.target.result.toString();
            data[fileIndex] = contents.split(/[\r\n]+/g);
            og_data[fileIndex] = data[fileIndex];

            let separatorContainer = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex] as HTMLInputElement
            separatorContainer.style.visibility = "visible";
            let separator = maps[fileIndex]? maps[fileIndex].sep : separatorContainer.getElementsByTagName("input")[0].value;
            Chronovisor.CSV.displayCsv(data[fileIndex].slice(0, 4), fileIndex, separator);
            if (maps[fileIndex]) {
                maps[fileIndex].applyMapToDom(fileIndex);
            }
        }
    } else if (file.name.indexOf(".json") !== -1) {
        reader.onload = function (ev) {
            let contents = ev.target.result.toString();
            data[fileIndex] = JSON.parse(contents);
            og_data[fileIndex] = data[fileIndex];

            let separatorContainer = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex] as HTMLInputElement
            separatorContainer.style.visibility = "hidden";

            Chronovisor.Json.displayJson(data[fileIndex].slice(0, 4), fileIndex);
            if (maps[fileIndex]) {
                maps[fileIndex].applyMapToDom(fileIndex);
            }
        }
    } else {
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
    timeOffset = (document.getElementById("chronovisor-time-offset") as HTMLInputElement).value;
    let timeOffsetFormat = (document.getElementById("chronovisor-time-offset-format") as HTMLSelectElement).value;
    timeOffset = Chronovisor.Map.convertTimestamp(timeOffset, timeOffsetFormat);

    let chronos = []
    for (let i = 0; i < data.length; i++) {
        if (maps[i] === null) {
            maps[i] = Chronovisor.Map.getMapFromDOM(i);
        }

        if (files[i].indexOf(".csv") !== -1) {
            chronos = chronos.concat(maps[i].convertCsv(data[i]));
        } else {
            chronos = chronos.concat(maps[i].convertJson(data[i]));
        }
    }

    let downloadType = (document.getElementById("chronovisor-save-format") as HTMLSelectElement).value;
    console.log("Download type set to", downloadType);
    if (downloadType === "json") {
        let jsonchronos = Chronovisor.Chrono.Jsonify(chronos);
        download("output.chronovis.json", JSON.stringify(jsonchronos));
    } else if (downloadType === "csv") {
        let csvchronos = Chronovisor.Chrono.Csvify(chronos, false);
        download("output.chronovis.csv", csvchronos);
    } else if (downloadType === "oldcsv") {
        let oldchronos = Chronovisor.Chrono.Csvify(chronos, true);
        download("output.old.chronovis.csv", oldchronos);
    }
}

/**
 * sets the map data being used when a map file is uploaded
 * @param input file sent from <input>'s onchange callback
 */
function loadMap(input) {
    let file: File = input.files[0];
    if (!file) {
        return;
    }

    // Get fileIndex
    let mapFields = document.getElementsByClassName("chronovisor-map-file");
    let fileIndex = 0;
    for (let i = 0; i < mapFields.length; i++) {
        if (mapFields[i] === input) {
            fileIndex = i;
            console.debug("map index set to", i)
            break;
        }
    }

    // Setup reader
    let reader = new FileReader();
    reader.onerror = function () {
        console.error("Failed to parse file");
    }

    reader.onload = function (ev) {
        let contents = JSON.parse(ev.target.result.toString());
        maps[fileIndex] = Chronovisor.Map.import(contents);
        if (files[fileIndex]) maps[fileIndex].applyMapToDom(fileIndex);
    }

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
    } else {
        file = ev.dataTransfer.files[0]
    }
    console.log(file.name, file);

    let reader = new FileReader();
    reader.onerror = function () {
        console.error("Failed to parse file");
    }

    reader.onload = function (ev) {
        let contents = JSON.parse(ev.target.result.toString());
        let property = window.prompt(JSON.stringify(contents, null, 4), "startTimePropertyName");
        (document.getElementById("chronovisor-time-offset") as HTMLInputElement).value = contents[property];
    }

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
function getUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}