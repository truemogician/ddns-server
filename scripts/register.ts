import { exec } from "child_process";
import Settings from "../appSettings.json";

exec(`New-Service -Name ${Settings.serviceName} -BinaryPathName build/${Settings.exeName}.exe`, {
	shell: "powershell.exe"
}, (error, stdout, stderr) => {
	if (error)
		console.log(`Exception: ${error}`);
	if (stdout)
		console.log(`Stdout: ${stdout}`);
	if (stderr)
		console.log(`Stderr: ${stderr}`);
});