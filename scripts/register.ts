import { exec } from "child_process";
import { execCallback } from "./common";
import Settings from "../appSettings.json";

const service = Settings.service;
exec(`New-Service -Name ${service.name} -BinaryPathName ${process.cwd()}/build/${Settings.exeName}.exe -DisplayName ${service.displayName} -Description ${service.description} -StartupType ${service.startupType}`, {
	shell: "powershell.exe"
}, execCallback as any);