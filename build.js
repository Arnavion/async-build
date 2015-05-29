/**
 * async-build
 *
 * https://github.com/Arnavion/async-build
 *
 * Copyright 2015 Arnav Singh
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var async = require("async");

async.series([
	function (callback) {
		var npm = require("npm");

		npm.load(function () {
			npm.commands["run-script"](["build"], callback);
		});
	},

	function (callback) {
		var fs = require("fs");
		var path = require("path");

		var task = require("./src/task");

		var inputFiles = [
			"./README.md", "./LICENSE",
			"./src/task.js", "./src/helpers.js"
		];

		var files = Object.create(null);
		inputFiles.forEach(function (filename) {
			files["./dist/" + path.basename(filename)] = filename;
		});

		async.series([
			// Clean dist/
			task.clean(Object.keys(files).concat(["./dist/package.json"])),

			// Create dist/ if necessary
			function (callback) {
				fs.mkdir("./dist", function (err) {
					if (err && err.code !== "EEXIST") {
						callback(err);
						return;
					}

					callback(null);
				});
			},

			// Copy all files except package.json and typings.d.ts
			async.each.bind(async, Object.keys(files), function (outputFilename, callback) {
				async.waterfall([fs.readFile.bind(fs, files[outputFilename]), fs.writeFile.bind(fs, outputFilename)], callback);
			}),

			// Copy package.json
			async.waterfall.bind(async, [
				fs.readFile.bind(fs, "./package.json"),
				function (data, callback) {
					try {
						var packageJson = JSON.parse(data);
						packageJson.devDependencies = undefined;
						packageJson.private = undefined;
						packageJson.scripts = undefined;
						packageJson.main = "task.js";
					}
					catch (ex) {
						callback(ex, null);
						return;
					}

					callback(null, new Buffer(JSON.stringify(packageJson, null, "\t")));
				},
				fs.writeFile.bind(fs, "./dist/package.json")
			]),

			// Copy typings.d.ts
			async.waterfall.bind(async, [
				function (callback) {
					async.parallel([
						fs.readFile.bind(fs, "./src/helpers.d.ts", { encoding: "utf8" }),
						fs.readFile.bind(fs, "./src/typings.d.ts", { encoding: "utf8" })
					], callback);
				},
				function (fileContents, callback) {
					try {
						var helpersDTs = fileContents[0];
						var typingsDTs = fileContents[1];

						helpersDTs =
							'declare module "async-build" {\n' +
							helpersDTs.split("\n")
								.map(function (line) { return "\t" + line; })
								.filter(function (line) { return line.match(/^\s*private/) === null })
								.map(function (line) { line = line.replace("export declare", "export"); return line; })
								.join("\n") + '\n' +
							'}';

						typingsDTs += "\n\n" + helpersDTs;
					}
					catch (ex) {
						callback(ex, null);
						return;
					}

					callback(null, typingsDTs);
				},
				function (typingsDTs, callback) {
					fs.writeFile("./dist/typings.d.ts", typingsDTs, { encoding: "utf8" }, callback)
				}
			]),
		], callback);
	}
], function (err) {
	if (err) {
		console.error(err.stack || err);
		process.exit(1);
	}
});
