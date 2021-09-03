import Http from "http";
import Request from "request-promise";

const port = 3367;

type NumString = string;
type DateString = string;

interface Body {
	tokenId: number,
	tokenValue: string,
	ipVersion?: 4 | 6,
	domain: string,
	subDomain?: string,
	ip: string
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

function parseBody<T = any>(req: Http.IncomingMessage): Promise<T> {
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
				resolve(JSON.parse(body));
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

Http.createServer(async (req, res) => {
	if (req.url != "/dnspod") {
		send(res, 404);
		return;
	}
	if (req.method != "POST") {
		send(res, 405);
		return;
	}
	try {
		const body = await parseBody<Body>(req);
		const recordsResp = JSON.parse(await Request.post("https://dnsapi.cn/Record.List", {
			form: {
				login_token: `${body.tokenId},${body.tokenValue}`,
				format: "json",
				domain: body.domain,
				sub_domain: body.subDomain ?? "@",
				record_type: body.ipVersion == 6 ? "AAAA" : "A"
			}
		})) as {
			status: DnspodStatus,
			records?: Record[]
		};
		if (recordsResp.status.code != "1") {
			res.setHeader("Content-Type", "text/plain");
			send(res, 400, recordsResp.status.message);
			return;
		}
		recordsResp.records!.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
		const record = recordsResp.records![0];
		if (record.value == body.ip) {
			res.setHeader("Content-Type", "text/plain");
			send(res, 200, `${body.subDomain ? body.subDomain + '.' : ''}${body.domain}的解析值没有变化，无需更新`);
			return;
		}
		const modifyResp = JSON.parse(await Request.post("https://dnsapi.cn/Record.Modify", {
			form: {
				login_token: `${body.tokenId},${body.tokenValue}`,
				format: "json",
				domain: body.domain,
				record_id: record.id,
				sub_domain: record.name,
				record_type: record.type,
				record_line_id: record.line_id,
				value: body.ip,
				mx: record.mx,
				ttl: record.ttl,
				status: record.status,
				weight: record.weight
			}
		})) as { status: DnspodStatus };
		if (modifyResp.status.code != "1") {
			res.setHeader("Content-Type", "text/plain");
			send(res, 400, modifyResp.status.message);
			return;
		};
		send(res, 200, `${body.subDomain ? body.subDomain + '.' : ''}${body.domain}的解析值成功从${record.value}更新为${body.ip}`);
	}
	catch (error) {
		send(res, 500, error);
	}
}).listen(port);

console.log("Listening on " + port);