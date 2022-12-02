import "@basic-type-extensions/array";
import Http from "http";
import Path from "path";
import Request from "request-promise";
import config from "../config/server.config.json";

type NumString = string;
type DateString = string;

interface Body {
	domain: string;

	token: {
		id: number,
		value: string
	};

	oldIp: string;

	newIp: string;
}
interface Record {
	id: NumString,
	ttl: NumString,
	value: string,
	enabled: "0" | "1",
	status: "enable" | "disable",
	updated_on: DateString,
	name: string,
	line: string,
	line_id: NumString,
	type: "A" | "CNAME" | "MX" | "TXT" | "NS" | "AAAA" | "SPF" | "SRV" | "CAA" | "显性URL" | "隐性URL",
	weight: number | null,
	monitor_status: string,
	remark: "string",
	mx: NumString
}
interface DnspodStatus {
	code: NumString,
	message: string,
	created_at: DateString
}

function isBody(body: any): body is Body {
	return body && typeof body === "object" &&
		typeof body.domain === "string" &&
		typeof body.token === "object" &&
		typeof body.token.id === "number" &&
		typeof body.token.value === "string" &&
		typeof body.oldIp === "string" &&
		typeof body.newIp === "string";
}

function receiveBody(req: Http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", chunk => {
			try {
				body += chunk.toString()
			}
			catch (error) {
				reject(error);
			}
		});
		req.on("end", () => {
			try {
				resolve(body);
			}
			catch (error) {
				reject(error);
			}
		});
	});
}

function send(req: Http.ServerResponse, statusCode: number, data?: any) {
	req.statusCode = statusCode;
	req.end(data);
}

process.chdir((process as any).pkg
	? Path.resolve(process.execPath, "..")
	: __dirname
);

const ipv4Pattern = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
Http.createServer(async (req, res) => {
	try {
		switch (req.url) {
			case "my-ip": {
				if (req.method !== "GET") {
					send(res, 405);
					return;
				}
				const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;
				res.setHeader("Content-Type", "text/plain");
				send(res, 200, ip);
				break;
			}
			case "/dnspod/update": {
				if (req.method != "POST") {
					send(res, 405);
					return;
				}
				res.setHeader("Content-Type", "text/plain");
				const string = await receiveBody(req);
				const body = JSON.parse(string);
				if (!isBody(body)) {
					send(res, 400, "Invalid body");
					return;
				}
				const { domain, token, oldIp, newIp } = body;
				if (!ipv4Pattern.test(oldIp) || !ipv4Pattern.test(newIp)) {
					send(res, 400, "Invalid IP");
					return;
				}
				if (oldIp == newIp) {
					send(res, 400, "IP not changed");
					return;
				}
				console.log(new Date().toTimeString(), body);
				const recordsResp = JSON.parse(await Request.post("https://dnsapi.cn/Record.List", {
					form: {
						login_token: `${token.id},${token.value}`,
						format: "json",
						domain
					}
				})) as {
					status: DnspodStatus,
					records?: Record[]
				};
				if (recordsResp.status.code != "1") {
					send(res, 500, recordsResp.status.message);
					return;
				}
				recordsResp.records!.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
				const records = recordsResp.records!.filter(r => r.value == body.oldIp);
				if (records.length == 0) {
					send(res, 200, "No record to update");
					return;
				}
				const results = await records.mapAsync(
					record => Request.post("https://dnsapi.cn/Record.Modify", {
						form: {
							login_token: `${token.id},${token.value}`,
							format: "json",
							domain,
							record_id: record.id,
							sub_domain: record.name,
							record_type: record.type,
							record_line_id: record.line_id,
							value: newIp,
							mx: record.mx,
							ttl: record.ttl,
							status: record.status,
							weight: record.weight
						}
					}).then(r => JSON.parse(r) as { status: DnspodStatus }),
					(error: any) => {
						console.error(error);
						send(res, 500, error);
						return undefined;
					}
				);
				if (results === undefined)
					return;
				const errorResult = results.find(r => r.status.code != "1");
				if (errorResult) {
					send(res, 500, errorResult.status.message);
					return;
				}
				send(res, 200, `Updated ${results.length} records`);
				break;
			}
			default:
				send(res, 404);
		}
	}
	catch (error) {
		console.error(error);
		send(res, 500, error);
	}
}).listen(config.port);

console.log("Listening on " + config.port);