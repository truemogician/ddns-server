import { exec } from "child_process";
import { execCallback } from "./common";
import Settings from "../appSettings.json";

exec(`New-Service -Name ${Settings.serviceName} -BinaryPathName build/${Settings.exeName}.exe`, {
	shell: "powershell.exe"
}, execCallback);