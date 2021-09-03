import { ExecException } from "child_process";

export function execCallback(exception: ExecException, stdout: string, stderr: string) {
	if (exception)
		console.log(`Exception: ${exception}`);
	if (stdout)
		console.log(`Stdout: ${stdout}`);
	if (stderr)
		console.log(`Stderr: ${stderr}`);
}