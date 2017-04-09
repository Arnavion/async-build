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

import fs = require("fs");
import path = require("path");
import stream = require("stream");

export interface File {
	path: string;
	contents: string | Buffer;
}

export function src(files: string | string[], options?: { relativeTo?: string }): stream.Readable<File | Error> {
	if (!Array.isArray(files)) {
		files = [files];
	}

	return new FileSource(files, (options && options.relativeTo) ? path.resolve(options.relativeTo) : process.cwd());
}

export function dest(base: string): stream.Transform<File | Error, File | Error> {
	return new FileDest(base);
}

export function watch(directory: string, onChangeCallback: () => void): FileWatcher {
	const fileWatcher = new FileWatcher(onChangeCallback);

	const entries = fs.readdirSync(directory);
	for (let entry of entries) {
		const entryName = path.join(directory, entry);
		const stats = fs.statSync(entryName);
		if (stats.isFile()) {
			fileWatcher.watchFile(entryName);
		}
	}

	return fileWatcher;
}

export class FileWatcher {
	private _watchedFiles = Object.create(null);
	private _modifiedFiles = Object.create(null);
	private _pendingCall: number | null = null;

	constructor(private _onChangeCallback: (fileNames: string[]) => void) { }

	watchFile(fileName: string): void {
		if (fileName in this._watchedFiles) {
			return;
		}

		const watchFileCallback = (currentFile: fs.Stats, previousFile: fs.Stats) => {
			if (currentFile.mtime.getTime() <= 0) {
				this._fileChangedCallback(fileName);
				fs.unwatchFile(fileName, watchFileCallback);
				delete this._watchedFiles[fileName];
			}
			else {
				this._fileChangedCallback(fileName);
			}
		};

		fs.watchFile(fileName, { interval: 500 }, watchFileCallback);
		this._watchedFiles[fileName] = true;
	}

	private _fileChangedCallback(fileName: string): void {
		this._modifiedFiles[fileName] = true;

		if (this._pendingCall === null) {
			this._pendingCall = setTimeout(() => {
				this._pendingCall = null;

				const modifiedFiles = Object.keys(this._modifiedFiles);

				for (let fileName of modifiedFiles) {
					delete this._modifiedFiles[fileName];
				}

				this._onChangeCallback(modifiedFiles);
			}, 100);
		}
	}
}

export class FileTransform extends stream.Transform<File | Error, File | Error> {
	constructor(
		transform?: (this: FileTransform, chunk: File, encoding: string, callback: (error: Error | null) => void) => void,
		flush?: (this: FileTransform, callback: (error: Error | null) => void) => void
	) {
		super({ objectMode: true });

		const transform_ = transform || ((chunk, encoding, callback) => callback(null));

		const originalTransform: (chunk: File, encoding: string, callback: (error: Error | null) => void) => void =
			(transform_.length < 3) ?
				(chunk, encoding, callback) => {
					try {
						transform_.call(this, chunk, encoding);
						callback(null);
					}
					catch (ex) {
						callback(ex);
					}
				} :
				transform_.bind(this);

		this._transform = (chunk, encoding, callback) => {
			if (chunk instanceof Error) {
				this.push(chunk);

				callback(null);
			}
			else {
				originalTransform(chunk, encoding, err => {
					if (err) {
						this.push(err);
					}

					callback(null);
				});
			}
		};

		const flush_ = flush || (callback => callback(null));

		this._flush =
			(flush_.length < 1) ?
				((callback: (error: Error | null) => void) => {
					try {
						flush_.call(this);
						callback(null);
					}
					catch (ex) {
						callback(ex);
					}
				}) :
				flush_.bind(this);
	}
}

class FileSource extends stream.Readable<File | Error> {
	private _numRead: number = 0;

	constructor(private _files: string[], private _relativeTo: string) {
		super({ objectMode: true });
	}

	_read() {
		if (this._numRead >= this._files.length) {
			this.push(null);
			return;
		}

		const filename = this._files[this._numRead++];
		fs.readFile(filename, "utf8", (err, data) => {
			if (err) {
				this.push(err);
				this._numRead = this._files.length;
				return;
			}

			this.push({ path: path.relative(this._relativeTo, filename), contents: data });
		});
	}
}

class FileDest extends stream.Transform<File | Error, File | Error> {
	constructor(private _base: string) {
		super({ objectMode: true });
	}

	_transform(chunk: File | Error, encoding: string, callback: (error: Error | null) => void) {
		if (chunk instanceof Error) {
			callback(chunk);
			return;
		}

		const outputPath = path.join(this._base, path.relative(process.cwd(), chunk.path));
		mkdirp(path.dirname(outputPath), err => {
			if (err) {
				callback(err);
				return;
			}

			fs.writeFile(outputPath, chunk.contents, "utf8", err => {
				if (err) {
					callback(err);
					return;
				}

				this.push(chunk);
				callback(null);
			});
		});
	}
}

function mkdirp(directory: string, callback: (error: Error | null) => void) {
	fs.mkdir(directory, err => {
		if (err) {
			if (err.code === "ENOENT") {
				const parent = path.dirname(directory);
				if (parent !== directory) {
					mkdirp(parent, err => {
						if (err) {
							callback(err);
							return;
						}

						mkdirp(directory, callback);
					});
				}
				else {
					callback(new Error("Root does not exist."));
				}
			}
			else if (err.code === "EEXIST") {
				fs.stat(directory, (err, stats) => {
					if (err) {
						callback(err);
						return;
					}

					if (!stats.isDirectory()) {
						callback(new Error(`${ directory } already exists and is not a directory.`));
						return;
					}

					callback(null);
				});
			}
			else {
				callback(err);
			}

			return;
		}

		callback(null);
	});
}
