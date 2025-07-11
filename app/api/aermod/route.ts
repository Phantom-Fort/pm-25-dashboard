import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const input = JSON.stringify(data);
    // Call Python script for AERMOD dispersion
    const result = execSync(`python aermod.py '${input}'`, {
      encoding: "utf-8",
    });
    const dispersion = JSON.parse(result);
    return NextResponse.json(dispersion, { status: 200 });
  } catch (error) {
    console.error("AERMOD error:", error);
    return NextResponse.json(
      { error: `Dispersion failed: ${error}` },
      { status: 500 }
    );
  }
}