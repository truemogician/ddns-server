import { exec } from "child_process";
import { execCallback } from "./common";
import Settings from "../appSettings.json";

const service = Settings.service;
function escapeShell(command: string) {
	if (!/[ "'$`\\]/.test(command))
		return command;
	return `"${command.replace(/(["'$`\\])/g, '\\$1')}"`;
}
exec(`New-Service -Name ${service.name} -BinaryPathName ${escapeShell(process.cwd() + "/build/" + Settings.exeName + ".exe")} -DisplayName ${escapeShell(service.displayName)} -Description ${escapeShell(service.description)} -StartupType ${service.startupType}`, {
	shell: "powershell.exe"
}, execCallback as any);