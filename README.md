# Localization Mutation Studio

An AI-powered tool for automated Android application testing, focusd on input mutations and localization edge cases.

## Overview

Localization Mutation Studio allows you to test how Android applications handle extreme input values (e.g., very long strings, special characters, mixed scripts). It leverages **Google Gemini** to translate high-level natural language goals into executable test steps and uses **ADB** with **UIAutomator** to perform actions and monitor for crashes.

### Key Features

- **Goal-Based Testing**: Describe what you want to do in plain English (e.g., "Open Swiggy, navigate to login, and enter the phone number").
- **AI Test Generation**: Gemini automatically generates the specific UI selectors and interaction steps.
- **Input Mutation**: Pre-defined edge-case mutations (Phone length, Text expansion, Symbol stress).
- **Crash Detection**: Automatically monitors `logcat` for FATAL EXCEPTIONs and ANRs.
- **Artifact Collection**: Captures screenshots and saves logcat outputs for every run.

---

## Project Structure

- **/web**: React + Vite frontend application.
- **/runner**: Node.js + Express backend that interfaces with ADB and Gemini.

---

## Requirements

1. **Node.js**: v18 or higher.
2. **Android SDK**: `adb` must be installed and available in your PATH.
3. **Android Emulator/Device**: A running emulator or a physical device with USB debugging enabled.
4. **Gemini API Key**: Required for the goal-based test generation.

---

## Setup Instructions

### 1. Runner (Backend)

Navigate to the `runner` directory and install dependencies:

```bash
cd runner
npm install
```

Create a `.env` file in the `runner` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=4545
```

### 2. Web (Frontend)

Navigate to the `web` directory and install dependencies:

```bash
cd web
npm install
```

---

## Running the Application

### 1. Start the Runner

In the `runner` directory:

```bash
npm run dev
```

The backend will start on `http://localhost:4545`.

### 2. Start the Frontend

In the `web` directory:

```bash
npm run dev
```

The frontend will typically start on `http://localhost:5173`. Open this URL in your browser.

---

## Usage Guide

1. **Configure App**: Enter the package name of the app you want to test (default: `in.swiggy.android`).
2. **Select Mutation**: Choose a field type and mutation kind (e.g., `PHONE_LONG`).
3. **Define Goal**: Write a natural language goal in the "Goal → Generate testcase" section.
   - _Example_: "Open the app, tap on the profile icon, then tap Login, and enter the phone number."
4. **Generate**: Click **Generate testcase (Gemini)**. The AI will build a JSON test sequence.
5. **Execute**: Click **Run on emulator**.
6. **Review**:
   - Watch the emulator for real-time interaction.
   - Check the "Run OK" box for crash status and screenshots.
   - View "Recent runs" for history.

---

## Troubleshooting

- **ADB not found**: Ensure `ADB_BIN` environment variable is set in the runner or `adb` is in your system PATH.
- **Gemini Errors**: Verify your API key and ensure you have internet access.
- **App Launch Fails**: Ensure the app is installed on the device and the package name is correct.
- **Selectors Fail**: If the UI changes, Gemini might need a more specific goal or you can use the **Manual fallback** mode with X/Y coordinates.
