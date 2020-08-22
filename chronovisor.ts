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
 *      sampleDataSize: tuple of the sample size to make for csv and json table displays
 *      timeOffset: amount to offset all timestamps by. This is useful if timestamps are absolute / aren't relative to the start of the video
 */

namespace Chronovisor {
    enum flags {
        IS_SAME_AS,
    }
    enum downloadType {
        JSON=0, CSV, CSV_old
    }

    export class ChronoSet {
        private chronos: Chrono[];
        private chronos_backup: Chrono[]; // should never be change other than in constructor
        public get Chronos() {
            return this.chronos;
        }
        public static sets: ChronoSet[] = []

        constructor(chronos: Chrono[]) {
            this.chronos = chronos;
            this.chronos_backup = chronos;
            ChronoSet.sets.push(this);
        }

        public static GetChronosFromDom(fileIndex: number | number[]) {
            if (typeof(fileIndex) === "number"){
                fileIndex = [fileIndex];
            }
            let fileIndecies = fileIndex as number[];

            let chronos: Chrono[] = [];
            for (let i of fileIndecies) {
                if (maps[i] === null) {
                    maps[i] = Chronovisor.Map.getMapFromDOM(i);
                }

                chronos = chronos.concat(maps[i].convert(data[i]));
            }

            return new ChronoSet(chronos);
        }
        
        public Jsonify(): object {
            let json = {};
            let keys = {};

            for (let i = 0; i < this.chronos.length; i++) {
                let key;
                if (this.chronos[i].key) {
                    // check if in keys
                    if (this.chronos[i].key in keys) {
                        keys[this.chronos[i].key] += 1;
                    } else {
                        keys[this.chronos[i].key] = 0;
                    }
                    key = keys[this.chronos[i].key].toString() + this.chronos[i].key
                } else {
                    key = getUuid();
                }

                this.chronos[i].key = key;
                json[key] = this.chronos[i].toJson();
            }

            return json;
        }

        public Csvify(useOldFormat: boolean = false): string {
            let csv;

            if (useOldFormat) {
                // Set headers
                csv = ["StartTime,EndTime,Title,Annotation,MainCategory,Category2,Category3"];
                // Get data
                for (let i = 0; i < this.chronos.length; i++) {
                    csv.push(this.chronos[i].toOldCsv());
                }
            } else {
                csv = ["Title,Description,Start(HMS),Start(sec),End(HMS),End(sec),Duration(sec),PrimaryTag,Tags"];
                for (let i = 0; i < this.chronos.length; i++) {
                    csv.push(this.chronos[i].toCsv());
                }
            }

            return csv.join("\r\n");
        }

        /**
         * Replaces found start and end pairs with a single element using the start timestamp and end timestamp.
         * Will combine data from start and end - using start's values where overlaps exist
         * @param chronos The Chrono objects to find pairs in
         * @param startKey the identifiers to use to find the start element eg: {"type": "speech starts", "description": "person A"}
         * @param endKey the identifiers to use to find the end element. Use the Chronovisor.flags.IS_SAME_AS flag to match with the startKey eg: {"type": "speech stops", "description": flags.IS_SAME_AS}
         * @returns the combined pairs
         */
        public FindSuccessivePairs(startKey: {}, endKey: {}) : Chrono[] { // FIXME: destroying data if any pairs exist

            function getIndecies(A: any[], B: any[]): number[] {
                return A.map(a => {
                    for (let i=0; i<B.length; i++) {
                        if (B[i] === a) {
                            return i;
                        }
                    }
                    return -1;
                });
            }
            let indeciesToPop: number[] = [];

            // Get all elements matching the start keys
            let starts: Chrono[] = this.chronos;
            for (let key in startKey) {
                starts = starts.filter(c => c[key] === startKey[key])
            }
            indeciesToPop = getIndecies(starts, this.chronos);

            // Get all elements matching the end keys
            let ends: Chrono[] = this.chronos;
            for (let key in endKey) {
                let value = endKey[key] === flags.IS_SAME_AS? startKey[key] : endKey[key];
                ends = ends.filter(c => c[key] === value);
            }
            indeciesToPop = indeciesToPop.concat(getIndecies(ends, this.chronos));

            // Form pairs
            let pairs = starts;
            for (let start of pairs) {
                let index = this.chronos.indexOf(start);

                // Make sure the end comes after the start
                let end;
                let i=0
                for (; i<ends.length; i++) {
                    if (i === 0 || this.chronos.indexOf(end) <= index) {
                        end = ends[i];
                    }
                    else {
                        // remove end from ends list so other starts don't pair with it.
                        ends.splice(i-1, 1);
                        break;
                    }
                }

                // Set Properties - prefer start's properties over end's
                start.type = start.type? start.type : end.type;
                start.key = start.key? start.key : end.key;
                start.title = start.title? start.title : end.title;
                start.description = start.description? start.description : end.description;
                start.end = /*i === ends.length? null:*/ end.start;
                start.duration = start.end - start.start;
                start.tags = start.tags + end.tags; // combine tags
                start.myPrimaryTagKey = start.myPrimaryTagKey? start.myPrimaryTagKey: end.myPrimaryTagKey;
            }

            // remove starts and ends from chronos
            console.log("removing", indeciesToPop.length, "elements from chronos's", this.chronos.length, "elements.");
            indeciesToPop = indeciesToPop.sort((a, b) => b-a);
            for (let i of indeciesToPop) {
                this.chronos.splice(i, 1);
            }

            // Add pairs to chronos
            this.chronos = this.chronos.concat(pairs);

            // Return results
            return pairs;
        }

        public download(type: downloadType) {
            switch (type) {
                case downloadType.JSON:
                    ChronoSet.downloadText("output.chronovis.json", JSON.stringify(this.Jsonify()));
                    break;
                case downloadType.CSV:
                    ChronoSet.downloadText("output.chronovis.csv", this.Csvify());
                    break;
                case downloadType.CSV_old:
                    ChronoSet.downloadText("output.chonovis-old.csv", this.Csvify(true));
                    break;
            }
        }

        public static downloadText (filename: string, data: string) {
            let elm = document.createElement('a');
            elm.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
            elm.setAttribute("download", filename);
            elm.style.display = 'none';
            document.body.appendChild(elm);
            elm.click();
            document.body.removeChild(elm);
        }
    }

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

        /**
         * Uses mapping to convert non-chronovis data into chronovis data.
         * Converts both csv and json data
         * @param data non-chronovis compatible data to parse
         */
        public convert(data: string[]): Chrono[] {
            let chronos = [];

            // Parse through each line of the data to convert
            for (let i = this.firstRow? 1:0; i < data.length; i++) {
                let properties = {"type":null, "key":null, "title":null, "description":null, "start":null, "end":null, "tags":null};
                let datum : object|string|string[]= data[i];

                if (typeof(datum) === "string") { // separate out the csv cells if needed
                    datum = datum.split(this.sep);
                }

                // Loop through each property (type, title, description, ...) and extract its value from datum
                propertyLoop:
                for (let property of Object.keys(properties)) {
                    // check if it's a Static property
                    if (typeof(this[property]) === "string") {
                        properties[property] = this[property];
                    }

                    // handle array of dynamic properties
                    else if (typeof(this[property]) === "object") {
                        for (let accessor of this[property]) {
                            // Try to get the datum's value
                            let value;
                            if (typeof(accessor)==="object") 
                                value = Map.getNestedValue(datum, accessor)   
                            else
                                value = datum[accessor]

                            // assign value and continue if it exists
                            if (value) {
                                properties[property] = value;
                                continue propertyLoop;
                            }
                        }
                        // if none of the property's columns are populated
                        properties[property] = null;
                    }

                    // if it was never assigned: null
                    else {
                        properties[property] = null;
                    }
                }

                // Create Object
                let c = new Chrono(
                    properties.type,
                    properties.key,
                    properties.title,
                    properties.description,
                    Map.convertTimestamp(properties.start, this.timestampFormat) - timeOffset,
                    Map.convertTimestamp(properties.end, this.timestampFormat) - timeOffset, //FIXME: outputting strange value. Perhaps is null?
                    properties.tags
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

        private static getNestedValue(data: object, keys: string[] | string): string {
            if (typeof (keys) === "string") return keys;
            let ret = data;
            for (let i = 0; i < keys.length; i++) {
                ret = ret[keys[i]];
            }
            if (ret) return ret.toString();
            else return null;
        }

        public export() {

            function downloadAsTextFile(filename, text) {
                let elm = document.createElement('a');
                elm.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
                elm.setAttribute("download", filename);
                elm.style.display = 'none';
                document.body.appendChild(elm);
                elm.click();
                document.body.removeChild(elm);
            }

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
            downloadAsTextFile(this.mapName + ".cvrmap", JSON.stringify(json));
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
                    (document.getElementsByClassName("chronovisor-static-"+name)[fileIndex] as HTMLInputElement).value = item;
                } else {
                    for (let i of item)
                        mapSelections[i].value = name;
                }
            }
        }

        /**
         * Uses the data from this map to set DOM elements
         * @param fileIndex the index of elements to apply the map to
         */
        public applyMapToDom(fileIndex: number) {
            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            let items = {"type":this.type, "title":this.title, "description":this.description, "start":this.start, "end":this.end, "tags":this.tags};
            let keys = Object.keys(items);

            // Erase static fields
            for (let k in keys) {
                (document.getElementsByClassName("chronovisor-static-"+keys[k])[fileIndex] as HTMLInputElement).value = "";
            }

            // Set static only field 'key'
            (document.getElementsByClassName("chronovisor-static-key")[fileIndex] as HTMLInputElement).value = this.key? this.key: "";

            // CSV
            if (table.classList.contains("csv")) {
                let mapSelections = table.rows[0].getElementsByTagName("select");
                // Set all to 'ignore' to start
                for (let s in mapSelections) {
                    mapSelections[s].value = 'ignore';
                }
                for (let k in keys) {
                    this.applyCsvDomElm(items[keys[k]], keys[k], mapSelections, fileIndex);
                }

                // update table
                let csv = data[fileIndex].slice(sampleDataSize[0], sampleDataSize[1]);
                for (let i = 0; i < csv.length; i++) {
                    let elms = csv[i].split(this.sep);
                    for (let j = 0; j < elms.length; j++) {
                        table.rows[i+1].cells[j].innerHTML = elms[j];
                    }
                }
            }

            // JSON
            else {
                let r = 1;
                for (let i=0; i<keys.length; i++) {
                    if (items[keys[i]].length > 0) {
                        // Set Static
                        if (typeof(items[keys[i]]) === "string" || keys[i] === "key") { 
                            (document.getElementsByClassName("chronovisor-static-"+keys[i])[fileIndex] as HTMLInputElement).value = items[keys[i]];
                        }

                        // Set Dynamic
                        else {
                            for (let accessor of items[keys[i]]) {
                                let row = table.rows[r];
                                if (r === table.rows.length-1) {
                                    table.rows[r].getElementsByTagName("button")[0].click();
                                }
                                // Set dropdown element and add required input fields
                                row.cells[0].getElementsByTagName("select")[0].value = keys[i];
                                let addProp = row.cells[1].getElementsByTagName("button")[0];

                                for (let j=0; j<accessor.length; j++) {
                                    addProp.click();
                                    row.cells[j+2].getElementsByTagName("input")[0].value = accessor[j];
                                }
                                r++
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
            if (typeof (fileIndex) !== "number") {
                let saveButtons = document.getElementsByClassName("chronovisor-save-mapping");
                for (let i = 0; i < saveButtons.length; i++) {
                    if (saveButtons[i] === fileIndex) {
                        fileIndex = i;
                    }
                }
            }
            fileIndex = parseInt(fileIndex.toString());
            let table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            let map = new Map([], [], [], [], [], [], [], false, null);

            // CSV parsing
            if (table.classList.contains("csv")) {
                // Get mapping row
                let mappingRow = document.getElementsByClassName("chronovisor-selector-mapto")[fileIndex];
                let mapSelections = mappingRow.getElementsByTagName("select");
                for (let i = 0; i < mapSelections.length; i++) {
                    if (mapSelections[i].value === "ignore") continue;
                    map[mapSelections[i].value].push(i);
                }
            }

            // JSON parsing
            else {
                for (let i = 0; i < table.rows.length; i++) {
                    let row = table.rows[i];
                    if (row.cells[0].getElementsByTagName("select").length > 0) {
                        let mapto = row.cells[0].getElementsByTagName("select")[0].value;
                        let accessors = [];
                        for (let c = 0; c < row.cells.length; c++) {
                            let cell = row.cells[c];
                            if (cell.getElementsByTagName("input").length > 0) {
                                accessors.push(cell.getElementsByTagName("input")[0].value);
                            }
                        }
                        if (accessors.length !== 0) map[mapto].push(accessors);
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
            Json.showSamples(fileIndex, sampleDataSize[0], sampleDataSize[1]);
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
                let span = document.createElement("pre");
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




    //#region Post Processing UI
    /**
     * Event Handlers and HTML generator functions
     */

     /**
      * Creates a selection dropdown menu for selecting filters for pairing elements
      */
    export function PostProcessing_createSelection() {
        let opts = ["type", "title", "description", /*"start", "end", */"tags"/*, "key"*/];
        
        let sel = document.createElement("select");
        for (let opt of opts) {
            let optElm = document.createElement("option");
            optElm.value = opt;
            optElm.innerHTML = opt;
            sel.appendChild(optElm);
        }

        return sel;
    }

    /**
     * Creates a selection drop down to select which Chrono property to use
     * And an input element that allows for a particular property value to be selected
     * @param row the table row to add the selection element and input element
     */
    export function PostProcessing_CreateFilterRow(row: HTMLTableRowElement, addRename=false, property: string=null, value: string = null) {
        row.innerHTML = "";

        row.insertCell(0);
        row.cells[0].appendChild(PostProcessing_createSelection())
        if (property) 
            row.cells[0].getElementsByTagName("select")[0].value = property;

        row.insertCell(1);
        let input = document.createElement("input");
        input.type = "text";
        input.value = value?value:"filter value";
        let label = document.createElement("label");
        label.innerHTML = "value";
        row.cells[1].appendChild(label);
        row.cells[1].appendChild(input);

        if (addRename) {
            row.insertCell(2);
            let rename = document.createElement("input");
            rename.type = "text";
            rename.value = input.value;
            let renameLabel = document.createElement("label");
            renameLabel.innerHTML = "rename to";
            row.cells[2].appendChild(renameLabel);
            row.cells[2].appendChild(rename);
        }

        row.insertCell(addRename?3:2);
        let rm = document.createElement("button");
        rm.innerHTML = "-";
        rm.onclick = PostProcessing_RemoveFilter;
        row.cells[addRename?3:2].appendChild(rm);
    }

    export function PostProcessing_AddAddFilterButton(row: HTMLTableRowElement) {
        let button = document.createElement("button");
        button.onclick = PostProcessing_AddFilterRow;
        button.innerHTML = "Add another filter";
        row.innerHTML = "";
        row.insertCell(0);
        row.cells[0].appendChild(button)
    }

    export function PostProcessing_AddFilterRow(ev) {
        let rowIndex = (ev.target.parentElement.parentElement as HTMLTableRowElement).rowIndex;
        let table = ev.target.parentElement.parentElement.parentElement.parentElement as HTMLTableElement;
        
        // Clean table
        for (let i=table.rows.length-1; i>=0; i--) {
            if (table.rows[i].innerHTML === "")
                table.deleteRow(i);
        }

        // Add row
        let rename = false;
        if (table.classList.contains("chronovisor-post-start") && rowIndex===0) 
            rename = true;
        PostProcessing_CreateFilterRow(table.rows[rowIndex], rename);

        // Add button for adding more
        PostProcessing_AddAddFilterButton(table.insertRow(-1))
    }

    export function PostProcessing_RemoveFilter(ev) {
        let rowIndex = (ev.target.parentElement.parentElement as HTMLTableRowElement).rowIndex;
        let table = (ev.target.parentElement.parentElement.parentElement.parentElement as HTMLTableElement);
        table.deleteRow(rowIndex);
    }

    export function PostProcessing_Process(): ChronoSet {

        // Get data from HTML
        let pairs = [];
        for (let pair of document.getElementsByClassName("chronovisor-post-pair")) {
            let startFilter = {};
            let endFilter = {}

            // Get start
            let startTable = document.getElementsByClassName("chronovisor-post-start")[0] as HTMLTableElement;
            for (let row of startTable.rows) {
                if (row.cells[0] && row.cells[0].getElementsByTagName("select").length > 0)
                    startFilter[(row.getElementsByTagName("select")[0] as HTMLSelectElement).value] = (row.getElementsByTagName("input")[0] as HTMLInputElement).value;
            }

            // Get end
            let endTable = document.getElementsByClassName("chronovisor-post-end")[0] as HTMLTableElement;
            for (let row of endTable.rows) {
                if (row.cells[0] && row.cells[0].getElementsByTagName("select").length > 0)
                    endFilter[(row.getElementsByTagName("select")[0] as HTMLSelectElement).value] = (row.getElementsByTagName("input")[0] as HTMLInputElement).value;
            }

            pairs.push({
                "start": startFilter,
                "end": endFilter,
                "name": startTable.rows[0].getElementsByTagName("input")[1].value
            })
        }


        // Process data
        let chronoset = getChronoSet();
        let table = document.getElementById("chronovisor-post-display") as HTMLTableElement;
        table.rows[0].innerHTML = "";
        for (let pair of pairs) {
            let paired = chronoset.FindSuccessivePairs(pair.start, pair.end);
            table.rows[0].insertCell(-1).innerHTML = `<div><pre>${JSON.stringify(paired, null, 4)}</pre></div>`
        }
        console.log("[Process] After pairing, chronoset has", chronoset.Chronos.length, "chronos");
        return chronoset;
    }

    export function PostProcessing_CreatePair() {
        let container = document.getElementById("chronovisor-post-pairings");
        let pair = document.createElement("div");
        pair.classList.add("chronovisor-post-pair");
        container.appendChild(pair);

        // Create tables
        let start = document.createElement("table");
        let end = document.createElement("table");
        pair.appendChild(start);
        pair.appendChild(end);

        // Setup tables
        // start
        start.classList.add("chronovisor-post-start");
        start.createTHead().innerHTML = "<h3>Start elements match pattern</h3>";
        start.createTBody();
        start.insertRow(0);
        PostProcessing_CreateFilterRow(start.insertRow(0), true);
        PostProcessing_AddAddFilterButton(start.insertRow(1));
        // end
        end.classList.add("chronovisor-post-end");
        end.createTHead().innerHTML = "<h3>End elements match pattern</h3>";
        end.createTBody();
        end.insertRow(0);
        PostProcessing_CreateFilterRow(end.insertRow(0));
        PostProcessing_AddAddFilterButton(end.insertRow(1));

        // Create remove button
        let rm = document.createElement("button");
        rm.innerHTML = "remove pair";
        rm.onclick = this.PostProcessing_RemovePair;
        pair.appendChild(rm);
    }

    export function PostProcessing_RemovePair(ev) {
        ev.target.parentElement.parentElement.removeChild(ev.target.parentElement);
    }
    //#endregion








    /* 
    ==========================
            MAIN
    ========================== 
    */

    var data = [null];
    var og_data = [null];
    var files = [null];
    var maps: Map[] = [null];
    var fileTemplate
    var timeOffset;
    var errors = [];
    var sampleDataSize: [number, number] = [0, 4];

    export function onLoad() {
        fileTemplate = document.getElementsByClassName("chronovisor-converter-template")[0];
    }

    /**
     * Handles import of csv or json data to be converted to chronovis format
     * @param input event data from <input>'s onchange callback
     */
    export function onImport(input) {
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
                let separator;
                if (maps[fileIndex]) {
                    separator = maps[fileIndex].sep;
                }
                else {
                    let m = data[fileIndex][0].match(/(,|;|\t|   *|::)/);
                    if (m) {
                        separator = m[0];
                        separatorContainer.getElementsByTagName("input")[0].value = m[0];
                    }
                    else {
                        separator = separatorContainer.getElementsByTagName("input")[0].value;
                    }
                }
                Chronovisor.CSV.displayCsv(data[fileIndex].slice(sampleDataSize[0], sampleDataSize[1]), fileIndex, separator);
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

                Chronovisor.Json.displayJson(data[fileIndex].slice(sampleDataSize[0], sampleDataSize[1]), fileIndex);
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
    export function updateSeparator(ev) {
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
        Chronovisor.CSV.displayCsv(data.slice(sampleDataSize[0], sampleDataSize[1]), fileIndex, separator);
    }

    /**
     * Makes request to convert DOM into chronoset
     */
    function getChronoSet(downloadType:string=null) : ChronoSet{
        // get time offset
        timeOffset = (document.getElementById("chronovisor-time-offset") as HTMLInputElement).value;
        let timeOffsetFormat = (document.getElementById("chronovisor-time-offset-format") as HTMLSelectElement).value;
        timeOffset = Chronovisor.Map.convertTimestamp(timeOffset, timeOffsetFormat);

        let indecies = [];
        for (let i=0; i<data.length; i++)
            indecies.push(i);
        let chronoset = ChronoSet.GetChronosFromDom(indecies);
        return chronoset;
    }

    /**
     * sets the map data being used when a map file is uploaded
     * @param input file sent from <input>'s onchange callback
     */
    export function loadMap(input) {
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
    export function addFile() {
        document.getElementById("chronovisor-converter-container").appendChild(fileTemplate.cloneNode(true));
        maps.push(null);
        files.push(null);
        data.push(null);
        og_data.push(null);
    }

    export function readMetaFile(ev) {
        ev.preventDefault();

        let file;

        if (ev.dataTransfer.items) {
            if (ev.dataTransfer.items[0].kind === 'file') {
                file = ev.dataTransfer.items[0].getAsFile();
            }
        } else {
            file = ev.dataTransfer.files[0]
        }

        let reader = new FileReader();
        reader.onerror = function () {
            console.error("Failed to parse file");
        }

        reader.onload = function (ev) {
            let contents = JSON.parse(ev.target.result.toString());
            let keys = Object.keys(contents).filter(k => k.search(/(start|begin|time|end|stop)/i) >= 0);
            let property = window.prompt(JSON.stringify(contents, null, 4), keys[0]? keys[0] : "startTimePropertyName");
            (document.getElementById("chronovisor-time-offset") as HTMLInputElement).value = contents[property];

            autoSetFormat({target: document.getElementById("chronovisor-time-offset")}, "chronovisor-time-offset-format");
        }

        reader.readAsText(file);
    }

    export function allowDrop(ev) {
        ev.preventDefault();
    }

    export function autoSetFormat(ev, id) {
        // Try to automatically determine format
        if (ev.target.value > new Date().valueOf() * 100) {
            // Assume C#
            (document.getElementById(id) as HTMLSelectElement).value = "C";
        }
        else if (ev.target.value < new Date().valueOf() / 100) {
            // Assume pythonic
            (document.getElementById(id) as HTMLSelectElement).value = "pythonic";
        }
        else {
            // TODO: set to javascript
        }
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

    export function showPostProcessingInfo() {
        window.alert(
`====================
Post Processing
====================
This section allows you to select elements from your converted data and combine them.

This is useful if you have 'start' and 'end' events that you would like to combine into single duration events.

Use the properties set above to target these elements. Regex is not supported yet :'(`
            );
    }

    /**
     * Downloads processed and post processed data
     */
    export function download() {
        let chronoset: ChronoSet = PostProcessing_Process();
        console.log("[download] downloading", chronoset.Chronos, "chronos");
        let downloadFormat: number = parseInt((document.getElementById("chronovisor-save-format") as HTMLSelectElement).value);
        chronoset.download(downloadFormat as downloadType)
    }
}