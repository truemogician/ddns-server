import { exec } from "child_process";

function getNodeMajorVersion(): number {
	const version = process.version.substr(1);
	return Number.parseInt(version.substring(0, version.indexOf(".")));
}
exec(`pkg build/index.js -t node${getNodeMajorVersion()}-win-${process.arch} -o build/ddns-server.exe`)