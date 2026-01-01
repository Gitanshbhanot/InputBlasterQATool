# Mutation Studio - Runner Backend

This is the Node.js + Express backend that controls ADB and integrates with the Google Gemini API.

## Setup

```bash
npm install
```

Create a `.env` file with your Gemini API key:

```env
GEMINI_API_KEY=your_key
```

Run the server:

```bash
npm run dev
```

The server exposes endpoints for:

- `/generate`: Uses Gemini to create test cases from natural language goals.
- `/run`: Executes a test sequence on a connected Android device.
- `/runs`: Lists previous test runs.

For full project documentation, see the [Main README](../README.md).
