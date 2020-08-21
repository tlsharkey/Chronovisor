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
var Chronovisor;
(function (Chronovisor) {
    var flags;
    (function (flags) {
        flags[flags["IS_SAME_AS"] = 0] = "IS_SAME_AS";
    })(flags || (flags = {}));
    var ChronoSet = /** @class */ (function () {
        function ChronoSet() {
        }
        ChronoSet.Jsonify = function (chronos) {
            var json = {};
            var keys = {};
            for (var i = 0; i < chronos.length; i++) {
                var key = void 0;
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
        };
        ChronoSet.Csvify = function (chronos, useOldFormat) {
            if (useOldFormat === void 0) { useOldFormat = false; }
            var csv;
            if (useOldFormat) {
                // Set headers
                csv = ["StartTime,EndTime,Title,Annotation,MainCategory,Category2,Category3"];
                // Get data
                for (var i = 0; i < chronos.length; i++) {
                    csv.push(chronos[i].toOldCsv());
                }
            }
            else {
                csv = ["Title,Description,Start(HMS),Start(sec),End(HMS),End(sec),Duration(sec),PrimaryTag,Tags"];
                for (var i = 0; i < chronos.length; i++) {
                    csv.push(chronos[i].toCsv());
                }
            }
            return csv.join("\r\n");
        };
        /**
         * Replaces found start and end pairs with a single element using the start timestamp and end timestamp.
         * Will combine data from start and end - using start's values where overlaps exist
         * @param chronos The Chrono objects to find pairs in
         * @param startKey the identifiers to use to find the start element eg: {"type": "speech starts", "description": "person A"}
         * @param endKey the identifiers to use to find the end element. Use the Chronovisor.flags.IS_SAME_AS flag to match with the startKey eg: {"type": "speech stops", "description": flags.IS_SAME_AS}
         * @returns full chronos array with individual start's and end's replaced by consolidated pairs.
         */
        ChronoSet.FindSuccessivePairs = function (chronos, startKey, endKey, returnAll) {
            if (returnAll === void 0) { returnAll = false; }
            function getIndecies(A, B) {
                return A.map(function (a) {
                    for (var i = 0; i < B.length; i++) {
                        if (B[i] === a) {
                            return i;
                        }
                    }
                    return -1;
                });
            }
            var indeciesToPop = [];
            // Get all elements matching the start keys
            var starts = chronos;
            var _loop_1 = function (key) {
                starts = starts.filter(function (c) { return c[key] === startKey[key]; });
            };
            for (var key in startKey) {
                _loop_1(key);
            }
            indeciesToPop = getIndecies(starts, chronos);
            // Get all elements matching the end keys
            var ends = chronos;
            var _loop_2 = function (key) {
                var value = endKey[key] === flags.IS_SAME_AS ? startKey[key] : endKey[key];
                ends = ends.filter(function (c) { return c[key] === value; });
            };
            for (var key in endKey) {
                _loop_2(key);
            }
            indeciesToPop = indeciesToPop.concat(getIndecies(ends, chronos));
            // Form pairs
            var pairs = starts;
            for (var _i = 0, pairs_1 = pairs; _i < pairs_1.length; _i++) {
                var start = pairs_1[_i];
                var index = chronos.indexOf(start);
                // Make sure the end comes after the start
                var end = void 0;
                var i = 0;
                for (; i < ends.length; i++) {
                    if (i === 0 || chronos.indexOf(end) <= index) {
                        end = ends[i];
                    }
                    else {
                        // remove end from ends list so other starts don't pair with it.
                        ends.splice(i - 1, 1);
                        break;
                    }
                }
                // Set Properties - prefer start's properties over end's
                start.type = start.type ? start.type : end.type;
                start.key = start.key ? start.key : end.key;
                start.title = start.title ? start.title : end.title;
                start.description = start.description ? start.description : end.description;
                start.end = /*i === ends.length? null:*/ end.start;
                start.duration = start.end - start.start;
                start.tags = start.tags + end.tags; // combine tags
                start.myPrimaryTagKey = start.myPrimaryTagKey ? start.myPrimaryTagKey : end.myPrimaryTagKey;
            }
            // remove starts and ends from chronos
            indeciesToPop = indeciesToPop.sort(function (a, b) { return b - a; });
            for (var _a = 0, indeciesToPop_1 = indeciesToPop; _a < indeciesToPop_1.length; _a++) {
                var i = indeciesToPop_1[_a];
                chronos.splice(i, 1);
            }
            // Return results
            if (returnAll)
                return chronos.concat(pairs);
            else
                return pairs;
        };
        return ChronoSet;
    }());
    Chronovisor.ChronoSet = ChronoSet;
    var Chrono = /** @class */ (function () {
        function Chrono(type, key, title, description, start, end, tags) {
            if (end === void 0) { end = null; }
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
        Chrono.prototype.toJson = function () {
            var s = new Date(this.start);
            var e = new Date(this.end);
            return {
                "type": this.type,
                "key": this.key,
                "title": this.title,
                "description": this.description,
                "start": {
                    "minute": s.getMinutes(),
                    "second": s.getSeconds(),
                    "totalSec": s.valueOf() * 1000
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
        };
        Chrono.prototype.toCsv = function (sep) {
            if (sep === void 0) { sep = ","; }
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
            var s = this.start ? new Date(this.start) : null;
            var e = this.end ? new Date(this.end) : null;
            var csv = [
                this.title ? this.title.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.description ? this.description.replace(sep, (sep === "," ? ";" : ",")) : "",
                s ? s.toISOString().split(/[TZ]/)[1] : "",
                s ? s.valueOf() / 1000 : "",
                e ? e.toISOString().split(/[TZ]/)[1] : "",
                e ? e.valueOf() / 1000 : "",
                this.duration,
                "",
                this.tags ? this.tags.replace(sep, (sep === "," ? ";" : ",")) : ""
            ];
            return csv.join(sep);
        };
        Chrono.prototype.toOldCsv = function (sep) {
            if (sep === void 0) { sep = ","; }
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
            var s = (this.start) ? new Date(this.start) : null;
            var e = (this.end) ? new Date(this.end) : null;
            var csv = [
                s ? s.toISOString().split(/[TZ]/)[1] : "",
                e ? e.toISOString().split(/[TZ]/)[1] : "",
                this.title ? this.title.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.tags ? this.tags.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.description ? this.description.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.title ? this.title.replace(sep, (sep === "," ? ";" : ",")) : "",
                this.type ? this.type.replace(sep, (sep === "," ? ";" : ",")) : ""
            ];
            return csv.join(sep);
        };
        return Chrono;
    }());
    Chronovisor.Chrono = Chrono;
    var Tag = /** @class */ (function () {
        function Tag() {
        }
        return Tag;
    }());
    Chronovisor.Tag = Tag;
    /**
     * Class that maps a csv or json to a Chrono object.
     * This object can be exported or imported to speed up the process
     * of converting files.
     */
    var Map = /** @class */ (function () {
        function Map(type, key, title, description, start, end, tags, firstRow, mapName, timestampFormat, sep) {
            if (firstRow === void 0) { firstRow = false; }
            if (mapName === void 0) { mapName = null; }
            if (timestampFormat === void 0) { timestampFormat = "C"; }
            if (sep === void 0) { sep = ","; }
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
        Map.prototype.convertCsv = function (data) {
            var chronos = [];
            var x = 0;
            if (this.firstRow)
                x = 1;
            for (var i = x; i < data.length; i++) {
                // separate out the csv cells
                var row = data[i].split(this.sep);
                // Parse
                var c = new Chrono((this.type === null) ? null : row[this.type], (this.key === null) ? null : row[this.key], (this.title === null) ? null : row[this.title], (this.description === null) ? null : row[this.description], (this.start === null) ? null : Map.convertTimestamp(row[this.start], this.timestampFormat) - timeOffset, (this.end === null) ? null : Map.convertTimestamp(row[this.end], this.timestampFormat) - timeOffset, (this.tags === null) ? null : row[this.tags]);
                chronos.push(c);
            }
            return chronos;
        };
        Map.convertTimestamp = function (timestamp, format) {
            if (format === void 0) { format = 'C'; }
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
            }
            else if (format === "C") {
                // nanoseconds to milliseconds
                timestamp = timestamp * 0.0001;
                // offset to Unix epoch
                var d = new Date(0, 0, 0, 0, 0, 0, 0);
                d.setFullYear(1);
                d.setMonth(0);
                d.setDate(1);
                timestamp = timestamp - d.valueOf();
            }
            return timestamp;
        };
        Map.prototype.convertJson = function (data) {
            // let chronos = [];
            // console.error("Not Implemented");
            // return chronos;
            var chronos = [];
            var x = 0;
            if (this.firstRow)
                x = 1;
            for (var i = x; i < data.length; i++) {
                // Parse
                var c = new Chrono((this.type === null) ? null : Map.getNestedValue(data[i], this.type), (this.key === null) ? null : Map.getNestedValue(data[i], this.key), (this.title === null) ? null : Map.getNestedValue(data[i], this.title), (this.description === null) ? null : Map.getNestedValue(data[i], this.description), (this.start === null) ? null : Map.convertTimestamp(Map.getNestedValue(data[i], this.start), this.timestampFormat) - timeOffset, (this.end === null) ? null : Map.convertTimestamp(Map.getNestedValue(data[i], this.end), this.timestampFormat) - timeOffset, (this.tags === null) ? null : Map.getNestedValue(data[i], this.tags));
                chronos.push(c);
            }
            return chronos;
        };
        Map.getNestedValue = function (data, keys) {
            if (typeof (keys) === "string")
                return keys;
            var ret = data;
            for (var i = 0; i < keys.length; i++) {
                ret = ret[keys[i]];
            }
            if (ret)
                return ret.toString();
            else
                return null;
        };
        Map.prototype["export"] = function () {
            if (this.mapName === null) {
                this.mapName = window.prompt("Give this mapping a name", "myMap");
            }
            var json = {
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
        };
        Map["import"] = function (json) {
            if (typeof (json) === "string") {
                json = JSON.parse(json);
            }
            return new Map(json["type"], json["key"], json["title"], json["description"], json["start"], json["end"], json["tags"], json["firstRow"], json["mapName"], json["timestampFormat"], json["sep"]);
        };
        Map.prototype.applyCsvDomElm = function (item, name, mapSelections, fileIndex) {
            if (item !== null && item !== undefined) {
                if (typeof (item) === "string") {
                    document.getElementsByClassName("chronovisor-static-" + name)[fileIndex].value = item;
                }
                else {
                    mapSelections[item].value = name;
                }
            }
        };
        /**
         * Uses the data from this map to set DOM elements
         * @param fileIndex the index of elements to apply the map to
         */
        Map.prototype.applyMapToDom = function (fileIndex) {
            var table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            var items = { "type": this.type, "title": this.title, "description": this.description, "start": this.start, "end": this.end, "tags": this.tags };
            var keys = Object.keys(items);
            // Erase static fields
            for (var k in keys) {
                document.getElementsByClassName("chronovisor-static-" + keys[k])[fileIndex].value = "";
            }
            // Set static only field 'key'
            document.getElementsByClassName("chronovisor-static-key")[fileIndex].value = this.key ? this.key : "";
            // CSV
            if (table.classList.contains("csv")) {
                var mapSelections = table.rows[0].getElementsByTagName("select");
                // Set all to 'ignore' to start
                for (var s in mapSelections) {
                    mapSelections[s].value = 'ignore';
                }
                for (var k in keys) {
                    this.applyCsvDomElm(items[keys[k]], keys[k], mapSelections, fileIndex);
                }
                // update table
                var csv = data[fileIndex].slice(sampleDataSize[0], sampleDataSize[1]);
                for (var i = 0; i < csv.length; i++) {
                    var elms = csv[i].split(this.sep);
                    for (var j = 0; j < elms.length; j++) {
                        table.rows[i + 1].cells[j].innerHTML = elms[j];
                    }
                }
            }
            // JSON
            else {
                for (var i = 0; i < keys.length; i++) {
                    var row = table.rows[i + 1];
                    // Set <select> element
                    row.cells[0].getElementsByTagName("select")[0].value = keys[i];
                    // Set selected properties
                    var addProp = row.cells[1].getElementsByTagName("button")[0];
                    if (items[keys[i]]) {
                        if (typeof (items[keys[i]]) === "string" || keys[i] === "key") {
                            // Set Static
                            document.getElementsByClassName("chronovisor-static-" + keys[i])[fileIndex].value = items[keys[i]];
                        }
                        else {
                            // Set Dynamic
                            for (var j = 0; j < items[keys[i]].length; j++) {
                                addProp.click();
                                row.cells[j + 2].getElementsByTagName("input")[0].value = items[keys[i]][j];
                            }
                        }
                    }
                }
            }
            // firstRow
            var fr = document.getElementsByClassName("chronovisor-selector-firstrow")[fileIndex];
            fr.checked = this.firstRow;
            // timestampFormat
            var time = document.getElementsByClassName("chronovisor-timestamp-format")[fileIndex];
            time.value = this.timestampFormat;
            // sep
            var sep = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0];
            sep.value = this.sep;
            console.debug("First Row", fr.checked, this.firstRow, "\nTimestamp", time.value, this.timestampFormat, "\nSeparator", sep.value, this.sep);
        };
        Map.getMapFromDOM = function (fileIndex) {
            if (typeof (fileIndex) !== "number") {
                var saveButtons = document.getElementsByClassName("chronovisor-save-mapping");
                for (var i = 0; i < saveButtons.length; i++) {
                    if (saveButtons[i] === fileIndex) {
                        fileIndex = i;
                    }
                }
            }
            fileIndex = parseInt(fileIndex.toString());
            var table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            var map = new Map(null, null, null, null, null, null, null, false, null);
            // CSV parsing
            if (table.classList.contains("csv")) {
                // Get mapping row
                var mappingRow = document.getElementsByClassName("chronovisor-selector-mapto")[fileIndex];
                var mapSelections = mappingRow.getElementsByTagName("select");
                for (var i = 0; i < mapSelections.length; i++) {
                    if (mapSelections[i].value === "ignore")
                        continue;
                    map[mapSelections[i].value] = i;
                }
            }
            // JSON parsing
            else {
                for (var i = 0; i < table.rows.length; i++) {
                    var row = table.rows[i];
                    if (row.cells[0].getElementsByTagName("select").length > 0) {
                        var mapto = row.cells[0].getElementsByTagName("select")[0].value;
                        var accessors = [];
                        for (var c = 0; c < row.cells.length; c++) {
                            var cell = row.cells[c];
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
            var opts = ["type", "title", "description", "start", "end", "tags"];
            for (var i = 0; i < opts.length; i++) {
                var opt = document.getElementsByClassName("chronovisor-static-" + opts[i])[fileIndex];
                var val = opt.value;
                if (val !== "") {
                    map[opts[i]] = val;
                }
            }
            // Get extras
            map.firstRow = document.getElementsByClassName("chronovisor-selector-firstrow")[fileIndex].checked;
            map.timestampFormat = document.getElementsByClassName("chronovisor-timestamp-format")[fileIndex].value;
            map.sep = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0].value;
            return map;
        };
        return Map;
    }());
    Chronovisor.Map = Map;
    var CSV = /** @class */ (function () {
        function CSV() {
        }
        /**
         * Creates a table that allows for easy mapping from the CSV to chronovis json
         * @param csv csv rows to display (just pass the first few rows)
         * @param sep the separator to use. Probably ',' or ';'
         */
        CSV.displayCsv = function (csv, fileIndex, sep) {
            if (sep === void 0) { sep = ","; }
            // make table
            document.getElementsByClassName("chronovisor-selector")[fileIndex].innerHTML = "";
            var table = document.createElement("table");
            table.classList.add("csv");
            // Create rows and populate them
            for (var i = 0; i < csv.length; i++) {
                var elms = csv[i].split(sep);
                // Create selection row
                if (i === 0) {
                    table.appendChild(this.createSelection(elms.length));
                }
                var row = document.createElement("tr");
                for (var j = 0; j < elms.length; j++) {
                    var cell = document.createElement("td");
                    cell.innerHTML = elms[j];
                    row.appendChild(cell);
                }
                table.appendChild(row);
            }
            document.getElementsByClassName("chronovisor-selector")[fileIndex].appendChild(table);
        };
        /**
         * Creates a row filled with selection boxes
         * each selection box has the same options.
         * These options correspond to which chronovis properties the row should correspond to.
         * @param {number} numberOfCells number of columns to make with selection boxes
         */
        CSV.createSelection = function (numberOfCells) {
            var row = document.createElement("tr");
            row.classList.add("chronovisor-selector-mapto");
            for (var i = 0; i < numberOfCells; i++) {
                var cell = document.createElement("td");
                var sel = document.createElement("select");
                // Create options
                var opts = ["ignore", "type", "title", "description", "start", "end", "tags"];
                for (var j = 0; j < opts.length; j++) {
                    var opt = document.createElement("option");
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
        };
        return CSV;
    }());
    Chronovisor.CSV = CSV;
    var Json = /** @class */ (function () {
        function Json() {
        }
        Json.displayJson = function (json, fileIndex) {
            // make table
            var container = document.getElementsByClassName("chronovisor-selector")[fileIndex];
            container.innerHTML = "";
            var table = document.createElement("table");
            table.classList.add("json");
            container.appendChild(table);
            // Create rows and populate them with json data
            Json.showSamples(fileIndex, sampleDataSize[0], sampleDataSize[1]);
            Json.createSelection(fileIndex);
            document.getElementsByClassName("chronovisor-selector")[fileIndex].appendChild(table);
        };
        Json.showSamples = function (fileIndex, startIndex, endIndex) {
            // Check valid indecies
            if (startIndex < 0 || startIndex > data[fileIndex].length || endIndex < startIndex || endIndex >= data[fileIndex].length) {
                console.error("Invalid indecies");
            }
            var table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            if (table.rows[0]) {
                table.rows[0].innerHTML = "";
            }
            else {
                table.insertRow(0);
            }
            for (var i = endIndex - 1; i >= startIndex; i--) {
                var cell = table.rows[0].insertCell(0);
                var span = document.createElement("pre");
                span.innerHTML = JSON.stringify(data[fileIndex][i], null, 4);
                cell.appendChild(span);
            }
        };
        Json.addNestedProperty = function (ev) {
            var row = ev.target.parentElement.parentElement;
            var cell = row.insertCell(-1);
            // Add input
            var input = document.createElement("input");
            input.type = "text";
            // Add remove button
            var rm = document.createElement("button");
            rm.innerHTML = "-";
            rm.onclick = Json.rmNestedProperty;
            // add to DOM
            cell.appendChild(input);
            cell.appendChild(rm);
        };
        Json.rmNestedProperty = function (ev) {
            var cell = ev.target.parentElement;
            var row = cell.parentElement;
            row.deleteCell(cell.cellIndex);
        };
        Json.createSelection = function (fileIndex) {
            var table = document.getElementsByClassName("chronovisor-selector")[fileIndex].getElementsByTagName("table")[0];
            var opts = ["type", "title", "description", "start", "end", "tags"];
            for (var i = opts.length - 1; i >= 0; i--) {
                var row = table.insertRow(1);
                // Create selection element
                var selectionRow = row.insertCell(0);
                var sel = document.createElement("select");
                for (var j = 0; j < opts.length; j++) {
                    var opt = document.createElement("option");
                    opt.value = opts[j];
                    opt.innerHTML = opts[j];
                    sel.appendChild(opt);
                }
                sel.value = opts[i];
                selectionRow.appendChild(sel);
                // Create button for adding nested property
                var addRow = row.insertCell(-1);
                var button = document.createElement("button");
                button.innerHTML = "add property";
                button.onclick = Json.addNestedProperty;
                addRow.appendChild(button);
            }
            Json.addRowButton(table);
        };
        Json.addRow = function (ev) {
            var table = ev.target.parentElement.parentElement.parentElement;
            table.deleteRow(-1);
            var row = table.insertRow(-1);
            var opts = ["type", "title", "description", "start", "end", "tags"];
            // Create selection element
            var selectionRow = row.insertCell(0);
            var sel = document.createElement("select");
            for (var j = 0; j < opts.length; j++) {
                var opt = document.createElement("option");
                opt.value = opts[j];
                opt.innerHTML = opts[j];
                sel.appendChild(opt);
            }
            sel.value = opts[0];
            selectionRow.appendChild(sel);
            // Create button for adding nested property
            var addRow = row.insertCell(-1);
            var button = document.createElement("button");
            button.innerHTML = "add property";
            button.onclick = Json.addNestedProperty;
            addRow.appendChild(button);
            Json.addRowButton(table);
        };
        Json.addRowButton = function (table) {
            var row = table.insertRow(-1);
            var cell = row.insertCell(0);
            var button = document.createElement("button");
            button.innerHTML = "add row";
            button.onclick = Json.addRow;
            cell.style.columnSpan = "-1";
            cell.appendChild(button);
        };
        return Json;
    }());
    Chronovisor.Json = Json;
    //#region Post Processing UI
    /**
     * Event Handlers and HTML generator functions
     */
    /**
     * Creates a selection dropdown menu for selecting filters for pairing elements
     */
    function PostProcessing_createSelection() {
        var opts = ["type", "title", "description", /*"start", "end", */ "tags" /*, "key"*/];
        var sel = document.createElement("select");
        for (var _i = 0, opts_1 = opts; _i < opts_1.length; _i++) {
            var opt = opts_1[_i];
            var optElm = document.createElement("option");
            optElm.value = opt;
            optElm.innerHTML = opt;
            sel.appendChild(optElm);
        }
        return sel;
    }
    Chronovisor.PostProcessing_createSelection = PostProcessing_createSelection;
    /**
     * Creates a selection drop down to select which Chrono property to use
     * And an input element that allows for a particular property value to be selected
     * @param row the table row to add the selection element and input element
     */
    function PostProcessing_CreateFilterRow(row) {
        row.innerHTML = "";
        row.insertCell(0);
        row.cells[0].appendChild(PostProcessing_createSelection());
        row.insertCell(1);
        var input = document.createElement("input");
        input.type = "text";
        input.value = "filter value";
        row.cells[1].appendChild(input);
        row.insertCell(2);
        var rm = document.createElement("button");
        rm.innerHTML = "-";
        rm.onclick = PostProcessing_RemoveFilter;
        row.cells[2].appendChild(rm);
    }
    Chronovisor.PostProcessing_CreateFilterRow = PostProcessing_CreateFilterRow;
    function PostProcessing_AddAddFilterButton(row) {
        var button = document.createElement("button");
        button.onclick = PostProcessing_AddFilterRow;
        button.innerHTML = "Add another filter";
        row.innerHTML = "";
        row.insertCell(0);
        row.cells[0].appendChild(button);
    }
    Chronovisor.PostProcessing_AddAddFilterButton = PostProcessing_AddAddFilterButton;
    function PostProcessing_AddFilterRow(ev) {
        var rowIndex = ev.target.parentElement.parentElement.rowIndex;
        var table = ev.target.parentElement.parentElement.parentElement.parentElement;
        // Add row
        PostProcessing_CreateFilterRow(table.rows[rowIndex]);
        // Add button for adding more
        PostProcessing_AddAddFilterButton(table.insertRow(-1));
    }
    Chronovisor.PostProcessing_AddFilterRow = PostProcessing_AddFilterRow;
    function PostProcessing_RemoveFilter(ev) {
        var rowIndex = ev.target.parentElement.parentElement.rowIndex;
        var table = ev.target.parentElement.parentElement.parentElement.parentElement;
        table.deleteRow(rowIndex);
    }
    Chronovisor.PostProcessing_RemoveFilter = PostProcessing_RemoveFilter;
    function PostProcessing_Process() {
        // Get data from HTML
        var pairs = [];
        for (var _i = 0, _a = document.getElementsByClassName("chronovisor-post-pair"); _i < _a.length; _i++) {
            var pair = _a[_i];
            var startFilter = {};
            var endFilter = {};
            // Get start
            var startTable = document.getElementsByClassName("chronovisor-post-start")[0];
            for (var _b = 0, _c = startTable.rows; _b < _c.length; _b++) {
                var row = _c[_b];
                if (row.cells[0] && row.cells[0].getElementsByTagName("select").length > 0)
                    startFilter[row.getElementsByTagName("select")[0].value] = row.getElementsByTagName("input")[0].value;
            }
            // Get end
            var endTable = document.getElementsByClassName("chronovisor-post-end")[0];
            for (var _d = 0, _e = endTable.rows; _d < _e.length; _d++) {
                var row = _e[_d];
                if (row.cells[0] && row.cells[0].getElementsByTagName("select").length > 0)
                    endFilter[row.getElementsByTagName("select")[0].value] = row.getElementsByTagName("input")[0].value;
            }
            pairs.push({
                "start": startFilter,
                "end": endFilter
            });
        }
        // Process data
        var chronos = convert("postProcessing");
        for (var _f = 0, pairs_2 = pairs; _f < pairs_2.length; _f++) {
            var pair = pairs_2[_f];
            chronos = ChronoSet.FindSuccessivePairs(chronos, pair.start, pair.end, true);
        }
        console.debug(chronos);
    }
    Chronovisor.PostProcessing_Process = PostProcessing_Process;
    function PostProcessing_CreatePair() {
        var container = document.getElementById("chronovisor-post-pairings");
        var pair = document.createElement("div");
        pair.classList.add("chronovisor-post-pair");
        container.appendChild(pair);
        // Create tables
        var start = document.createElement("table");
        var end = document.createElement("table");
        pair.appendChild(start);
        pair.appendChild(end);
        // Setup tables
        // start
        start.classList.add("chronovisor-post-start");
        start.createTHead().innerHTML = "<h3>Start elements match pattern</h3>";
        start.createTBody();
        start.insertRow(0);
        PostProcessing_CreateFilterRow(start.insertRow(0));
        PostProcessing_AddAddFilterButton(start.insertRow(1));
        // end
        end.classList.add("chronovisor-post-end");
        end.createTHead().innerHTML = "<h3>End elements match pattern</h3>";
        end.createTBody();
        end.insertRow(0);
        PostProcessing_CreateFilterRow(end.insertRow(0));
        PostProcessing_AddAddFilterButton(end.insertRow(1));
        // Create remove button
        var rm = document.createElement("button");
        rm.innerHTML = "remove pair";
        rm.onclick = this.PostProcessing_RemovePair;
        pair.appendChild(rm);
    }
    Chronovisor.PostProcessing_CreatePair = PostProcessing_CreatePair;
    function PostProcessing_RemovePair(ev) {
        ev.target.parentElement.parentElement.removeChild(ev.target.parentElement);
    }
    Chronovisor.PostProcessing_RemovePair = PostProcessing_RemovePair;
    //#endregion
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
    var errors = [];
    var sampleDataSize = [0, 4];
    function onLoad() {
        fileTemplate = document.getElementsByClassName("chronovisor-converter-template")[0];
    }
    Chronovisor.onLoad = onLoad;
    /**
     * Handles import of csv or json data to be converted to chronovis format
     * @param input event data from <input>'s onchange callback
     */
    function onImport(input) {
        var inputFields = document.getElementsByClassName("chronovisor-input-file");
        var fileIndex = 0;
        for (var i = 0; i < inputFields.length; i++) {
            if (inputFields[i] === input) {
                fileIndex = i;
                console.debug("File index set to", i);
                break;
            }
        }
        var file = input.files[0];
        if (!file) {
            return;
        }
        files[fileIndex] = input.files[0].name;
        // Setup reader
        var reader = new FileReader();
        reader.onerror = function () {
            console.error("Failed to parse file");
        };
        if (file.name.indexOf(".csv") !== -1) {
            reader.onload = function (ev) {
                var contents = ev.target.result.toString();
                data[fileIndex] = contents.split(/[\r\n]+/g);
                og_data[fileIndex] = data[fileIndex];
                var separatorContainer = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex];
                separatorContainer.style.visibility = "visible";
                var separator = maps[fileIndex] ? maps[fileIndex].sep : separatorContainer.getElementsByTagName("input")[0].value;
                Chronovisor.CSV.displayCsv(data[fileIndex].slice(sampleDataSize[0], sampleDataSize[1]), fileIndex, separator);
                if (maps[fileIndex]) {
                    maps[fileIndex].applyMapToDom(fileIndex);
                }
            };
        }
        else if (file.name.indexOf(".json") !== -1) {
            reader.onload = function (ev) {
                var contents = ev.target.result.toString();
                data[fileIndex] = JSON.parse(contents);
                og_data[fileIndex] = data[fileIndex];
                var separatorContainer = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex];
                separatorContainer.style.visibility = "hidden";
                Chronovisor.Json.displayJson(data[fileIndex].slice(sampleDataSize[0], sampleDataSize[1]), fileIndex);
                if (maps[fileIndex]) {
                    maps[fileIndex].applyMapToDom(fileIndex);
                }
            };
        }
        else {
            console.error("Invalid file type", file.name);
        }
        reader.readAsText(file);
    }
    Chronovisor.onImport = onImport;
    /**
     * Updates the display of data when the csv separator character is changed
     */
    function updateSeparator(ev) {
        var fileIndex = 0;
        var sepFields = document.getElementsByClassName("chronovisor-csv-sep");
        for (var i = 0; i < sepFields.length; i++) {
            if (sepFields[i] === ev.parentNode) {
                fileIndex = i;
                console.debug("Sep field index set to", i);
                break;
            }
        }
        var separator = document.getElementsByClassName("chronovisor-csv-sep")[fileIndex].getElementsByTagName("input")[0].value;
        Chronovisor.CSV.displayCsv(data.slice(sampleDataSize[0], sampleDataSize[1]), fileIndex, separator);
    }
    Chronovisor.updateSeparator = updateSeparator;
    /**
     * Converts csv/json to chronovis json.
     */
    function convert(downloadType) {
        if (downloadType === void 0) { downloadType = null; }
        // get time offset
        timeOffset = document.getElementById("chronovisor-time-offset").value;
        var timeOffsetFormat = document.getElementById("chronovisor-time-offset-format").value;
        timeOffset = Chronovisor.Map.convertTimestamp(timeOffset, timeOffsetFormat);
        var chronos = [];
        for (var i = 0; i < data.length; i++) {
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
        downloadType = downloadType ? downloadType : document.getElementById("chronovisor-save-format").value;
        if (downloadType === "json") {
            var jsonchronos = Chronovisor.ChronoSet.Jsonify(chronos);
            download("output.chronovis.json", JSON.stringify(jsonchronos));
        }
        else if (downloadType === "csv") {
            var csvchronos = Chronovisor.ChronoSet.Csvify(chronos, false);
            download("output.chronovis.csv", csvchronos);
        }
        else if (downloadType === "oldcsv") {
            var oldchronos = Chronovisor.ChronoSet.Csvify(chronos, true);
            download("output.old.chronovis.csv", oldchronos);
        }
        else {
            return chronos;
        }
    }
    Chronovisor.convert = convert;
    /**
     * sets the map data being used when a map file is uploaded
     * @param input file sent from <input>'s onchange callback
     */
    function loadMap(input) {
        var file = input.files[0];
        if (!file) {
            return;
        }
        // Get fileIndex
        var mapFields = document.getElementsByClassName("chronovisor-map-file");
        var fileIndex = 0;
        for (var i = 0; i < mapFields.length; i++) {
            if (mapFields[i] === input) {
                fileIndex = i;
                console.debug("map index set to", i);
                break;
            }
        }
        // Setup reader
        var reader = new FileReader();
        reader.onerror = function () {
            console.error("Failed to parse file");
        };
        reader.onload = function (ev) {
            var contents = JSON.parse(ev.target.result.toString());
            maps[fileIndex] = Chronovisor.Map["import"](contents);
            if (files[fileIndex])
                maps[fileIndex].applyMapToDom(fileIndex);
        };
        reader.readAsText(file);
    }
    Chronovisor.loadMap = loadMap;
    /**
     * Adds another UI set for parsing files
     */
    function addFile() {
        document.getElementById("chronovisor-converter-container").appendChild(fileTemplate.cloneNode(true));
        maps.push(null);
        files.push(null);
        data.push(null);
        og_data.push(null);
    }
    Chronovisor.addFile = addFile;
    function readMetaFile(ev) {
        ev.preventDefault();
        var file;
        if (ev.dataTransfer.items) {
            if (ev.dataTransfer.items[0].kind === 'file') {
                file = ev.dataTransfer.items[0].getAsFile();
            }
        }
        else {
            file = ev.dataTransfer.files[0];
        }
        var reader = new FileReader();
        reader.onerror = function () {
            console.error("Failed to parse file");
        };
        reader.onload = function (ev) {
            var contents = JSON.parse(ev.target.result.toString());
            var keys = Object.keys(contents).filter(function (k) { return k.search(/(start|begin|time|end|stop)/i) >= 0; });
            var property = window.prompt(JSON.stringify(contents, null, 4), keys[0] ? keys[0] : "startTimePropertyName");
            document.getElementById("chronovisor-time-offset").value = contents[property];
            autoSetFormat({ target: document.getElementById("chronovisor-time-offset") }, "chronovisor-time-offset-format");
        };
        reader.readAsText(file);
    }
    Chronovisor.readMetaFile = readMetaFile;
    function allowDrop(ev) {
        ev.preventDefault();
    }
    Chronovisor.allowDrop = allowDrop;
    function autoSetFormat(ev, id) {
        // Try to automatically determine format
        if (ev.target.value > new Date().valueOf() * 100) {
            // Assume C#
            document.getElementById(id).value = "C";
        }
        else if (ev.target.value < new Date().valueOf() / 100) {
            // Assume pythonic
            document.getElementById(id).value = "pythonic";
        }
        else {
            // TODO: set to javascript
        }
    }
    Chronovisor.autoSetFormat = autoSetFormat;
    /**
     * downloads a text based file.
     * @param filename name of the file to download
     * @param text the file contents as a string
     */
    function download(filename, text) {
        var elm = document.createElement('a');
        elm.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        elm.setAttribute("download", filename);
        elm.style.display = 'none';
        document.body.appendChild(elm);
        elm.click();
        document.body.removeChild(elm);
    }
    Chronovisor.download = download;
    /**
     * Generates a unique identifier
     */
    function getUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    Chronovisor.getUuid = getUuid;
})(Chronovisor || (Chronovisor = {}));
