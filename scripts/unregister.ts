import { exec } from "child_process";
import Settings from "../appSettings.json";
import { execCallback } from "./common";

exec(`sc.exe delete ${Settings.service.name}`, execCallback as any);