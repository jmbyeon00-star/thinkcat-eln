// lib/i18n/getMessages.ts
import fs from "fs";
import path from "path";

export async function getMessages(locale?: string) {
    const lang = locale || "ko";

    return JSON.parse(
        fs.readFileSync(
            path.join(process.cwd(), "messages", `${lang}.json`),
            "utf-8"
        )
    );
}
