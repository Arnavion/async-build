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

// Type definitions for Node.js v0.12.0
// Project: http://nodejs.org/
// Definitions by: Microsoft TypeScript <http://typescriptlang.org>, DefinitelyTyped <https://github.com/borisyankov/DefinitelyTyped>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

interface Buffer { }
interface BufferConstructor { }
declare var Buffer: BufferConstructor;

declare var process: {
	cwd(): string;
};

declare module "fs" {
	export function mkdir(path: string, callback: (err: Error & { code?: string } | null) => void): void;
	export function readdirSync(path: string): string[];
	export function readFile(filename: string, encoding: "utf8", callback: (err: Error | null, data: string) => void): void;
	export function stat(path: string, callback: (err: any, stats: Stats) => void): void;
	export function statSync(path: string): Stats;
	export function unwatchFile(filename: string, listener: (curr: Stats, prev: Stats) => void): void;
	export function watchFile(filename: string, options: { interval: number }, listener: (curr: Stats, prev: Stats) => void): void;
	export function writeFile(filename: string, data: any, encoding: "utf8", callback: (err: Error | null) => void): void;

	interface Stats {
		isDirectory(): boolean;
		isFile(): boolean;
		mtime: Date;
	}
}

declare module "path" {
	export function dirname(p: string): string;
	export function join(...paths: string[]): string;
	export function relative(from: string, to: string): string;
	export function resolve(...pathSegments: string[]): string;
}

declare module "stream" {
	export class Readable<T> {
		constructor(opts: { objectMode: boolean; });

		push(chunk: T | null): boolean;

		protected _read(size: number): void;
	}

	export class Transform<TIn, TOut> {
		constructor(opts: { objectMode: boolean; });

		push(chunk: TOut): boolean;

		protected _transform(chunk: TIn, encoding: string, callback: (error: Error | null) => void): void;
		protected _flush(callback: (error: Error | null) => void): void;
	}
}
