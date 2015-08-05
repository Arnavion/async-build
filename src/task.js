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

var fs = require("fs");
var stream = require("stream");

var async = require("async");

var allTasks = Object.create(null);

function handleSyncBody(body) {
	return function (callback) {
		try {
			var result = body();
		}
		catch (ex) {
			callback(ex, null);
			return;
		}

		callback(null, result);
	};
}

function handleTaskResult(result, callback) {
	if (arguments.length === 1) {
		callback = result;
		result = null;
	}

	if (result instanceof stream.Transform) {
		result.on("data", function () { });
		result.on("end", function () {
			callback(null);
		});
		result.on("error", function (err) {
			callback(err);
		});
	}
	else {
		callback(null);
	}
}

function task(name, deps, body) {
	if (arguments.length < 3) {
		if (Array.isArray(deps)) {
			body = function () { };
		}
		else {
			body = deps;
			deps = [];
		}
	}

	if (body.length === 0) {
		body = handleSyncBody(body);
	}

	var originalBody = body;
	body = function (callback) {
		console.log("[" + new Date().toLocaleTimeString() + "] " + name + " - Starting");

		async.waterfall([originalBody, handleTaskResult], function (err) {
			if (err) {
				console.error("[" + new Date().toLocaleTimeString() + "] " + name + " - Failed");
				callback(err);
				return;
			}

			console.log("[" + new Date().toLocaleTimeString() + "] " + name + " - Succeeded");
			callback(null);
		});
	};

	allTasks[name] = { name: name, deps: deps, body: body };
}

task.runArgv = function (callback) {
	var tasksToRun;
	if (process.argv.length > 2) {
		tasksToRun = process.argv.slice(2);
	}
	else {
		tasksToRun = ["default"];
	}

	async.series(tasksToRun.map(function (task) {
		var tasks = Object.create(null);

		var walkDeps = function (task) {
			task = allTasks[task];

			if (task.name in tasks) {
				return;
			}

			tasks[task.name] = task.deps.concat(task.body);
			task.deps.forEach(walkDeps);
		};

		walkDeps(task);

		return function (callback) {
			async.auto(tasks, function (err, results) {
				if (err) {
					console.error(err.stack || err);
				}

				callback(err);
			});
		};
	}), callback);
};

task.clean = function (files) {
	return async.each.bind(async, files, function (file, callback) {
		fs.unlink(file, function (err) {
			if (err && err.code !== "ENOENT") {
				callback(err);
				return;
			}

			callback(null);
		});
	});
}

var helpers = require("./helpers");

task.src = helpers.src;
task.dest = helpers.dest;
task.watch = helpers.watch;
task.FileWatcher = helpers.FileWatcher;
task.FileTransform = helpers.FileTransform;

module.exports = task;
