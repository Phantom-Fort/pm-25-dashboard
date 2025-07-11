import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // Write JSON input to a temporary file
    const filePath = path.join("/tmp", "temp_predict_input.json");
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    // Use python3 or fallback to python, with full path if needed
    const pythonCommand = process.platform === "win32" ? "python" : "python3";
    try {
      const result = execSync(`${pythonCommand} predict.py "${filePath}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });
      // Clean up temporary file
      unlinkSync(filePath);
      const prediction = JSON.parse(result);
      return NextResponse.json(prediction, { status: 200 });
    } catch (error) {
      // Clean up temporary file on error
      if (error === 1) {
        unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    console.error("Prediction error:", error);
    return NextResponse.json(
      { error: `Prediction failed: ${error}` },
      { status: 500 }
    );
  }
}