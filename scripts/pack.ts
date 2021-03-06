import { exec } from "child_process";
import { execCallback } from "./common";
import Settings from "../appSettings.json";

function getNodeMajorVersion(): number {
	const version = process.version.substr(1);
	return Number.parseInt(version.substring(0, version.indexOf(".")));
}
exec(`pkg build/src/index.js -t node${getNodeMajorVersion()}-win-${process.arch} -o build/${Settings.exeName}.exe`, execCallback as any);