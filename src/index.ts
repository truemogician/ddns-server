import "@basic-type-extensions/array";
import Http from "http";
import Path from "path";
import axios, { AxiosError } from "axios";
import config from "../config/server.config.json";

namespace Dnspod {
	type NumString = string;
	type DateString = string;

	export interface Status {
		code: NumString,
		message: string,
		created_at: DateString
	}

	export interface Record {
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

	export type Response<T extends object = {}> = T & { status: Status };
}

namespace Ddns {
	export interface UpdateRecordsBody {
		domain: string;

		token: {
			id: number,
			value: string
		};

		oldIp: string;

		newIp: string;
	}

	export function isUpdateRecordsBody(body: any): body is UpdateRecordsBody {
		return body && typeof body === "object" &&
			typeof body.domain === "string" &&
			typeof body.token === "object" &&
			typeof body.token.id === "number" &&
			typeof body.token.value === "string" &&
			typeof body.oldIp === "string" &&
			typeof body.newIp === "string";
	}
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

process.chdir((process as any).pkg
	? Path.resolve(process.execPath, "..")
	: __dirname
);

const ipv4Pattern = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
Http.createServer(async (req, res) => {
	function send(statusCode: number, data?: any) {
		res.statusCode = statusCode;
		res.end(data);
	}

	function handleError(error: any) {
		const msg = error instanceof AxiosError
			? error.response?.data ?? error.message
			: error instanceof Error
				? error.message
				: error;
		console.error(msg);
		send(500, msg);
	}

	try {
		switch (req.url) {
			case "/my-ip": {
				if (req.method !== "GET") {
					send(405);
					return;
				}
				const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;
				res.setHeader("Content-Type", "text/plain");
				send(200, ip);
				break;
			}
			case "/dnspod/update": {
				if (req.method != "POST") {
					send(405);
					return;
				}
				res.setHeader("Content-Type", "text/plain");
				const string = await receiveBody(req);
				const body = JSON.parse(string);
				if (!Ddns.isUpdateRecordsBody(body)) {
					send(400, "Invalid body");
					return;
				}
				const { domain, token, oldIp, newIp } = body;
				if (!ipv4Pattern.test(oldIp) || !ipv4Pattern.test(newIp)) {
					send(400, "Invalid IP");
					return;
				}
				if (oldIp == newIp) {
					send(400, "IP not changed");
					return;
				}
				console.log(new Date().toTimeString(), body);
				const recordsResp = await axios.post<Dnspod.Response<{ records?: Dnspod.Record[] }>>(
					"https://dnsapi.cn/Record.List",
					{
						login_token: `${token.id},${token.value}`,
						format: "json",
						domain
					},
					{
						headers: {
							"Content-Type": "application/x-www-form-urlencoded"
						}
					}
				);
				if (recordsResp.status != 200 || recordsResp.data.status.code != "1") {
					send(500, recordsResp.data.status.message);
					return;
				}
				let records = recordsResp.data.records;
				records?.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
				records = records?.filter(r => r.value == body.oldIp);
				if (!records || records.length == 0) {
					send(200, "No record to update");
					return;
				}
				for (const record of records) {
					const resp = await axios.post<Dnspod.Response>(
						"https://dnsapi.cn/Record.Modify",
						{
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
						},
						{
							headers: {
								"Content-Type": "application/x-www-form-urlencoded"
							}
						}
					);
					if (resp.status != 200 || resp.data.status.code != "1") {
						send(500, resp.data.status.message);
						return;
					}
				}
				send(200, `Updated ${records.length} records`);
				break;
			}
			default:
				send(404);
		}
	}
	catch (error) {
		handleError(error);
	}
}).listen(config.port);

console.log("Listening on " + config.port);