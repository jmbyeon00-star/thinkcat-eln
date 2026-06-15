import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || (session as any).user?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { task_id, file_path, mode } = await req.json();
    const GPU_BASE = process.env.GPU_BACKEND_URL;
    if (!GPU_BASE) {
        return NextResponse.json({ error: "GPU_BACKEND_URL 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const endpoint = mode === "async" ? "/gpu/note/extract-async" : "/gpu/note/extract";

    let res: Response;
    try {
        res = await fetch(`${GPU_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id, file_path }),
        });
    } catch (err) {
        return NextResponse.json({ error: `GPU 백엔드 연결 실패: ${String(err)}` }, { status: 502 });
    }

    const text = await res.text();
    try {
        const data = JSON.parse(text);
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ error: `GPU 응답 파싱 실패: ${text.slice(0, 200)}` }, { status: 500 });
    }
}
