# SignalWire + OpenAI Voice Assistant

**Build an AI phone assistant that actually understands and responds naturally to your callers.**

This project connects SignalWire's telephony platform with OpenAI's GPT-4 Realtime API to create voice assistants that can answer phone calls, have natural conversations, and help callers with real information—all in real-time.

## What This Does

This application creates a **bidirectional audio streaming bridge** between phone calls and OpenAI's Realtime API:

### Overview
1. **Incoming Call** → SignalWire receives the call and streams audio via WebSocket to our server
2. **Audio Processing** → Our TypeScript server forwards the audio stream to OpenAI's Realtime API using the official SDK
3. **Function Call Processing** → When AI needs information (weather, time, etc.), function calls are processed locally on our server
4. **AI Response** → OpenAI processes speech and function results in real-time, generating audio responses
5. **Audio Feedback** → AI responses stream back through our WebSocket server to SignalWire
6. **Caller Hears AI** → SignalWire feeds the AI audio directly back into the call

### What Users Experience
The result is an AI assistant that can:
- Have natural, flowing conversations with **zero buffering delays**
- Answer questions and provide information in real-time
- Check the weather for any US city
- Tell the current time
- Handle interruptions naturally (no more talking over each other!)

All with crystal-clear HD voice quality and true real-time bidirectional communication.

## Prerequisites

You'll need:

1. **Node.js 20+** - [Download here](https://nodejs.org/)
2. **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys) (requires paid account)
3. **SignalWire Account** - [Sign up free](https://signalwire.com) (for phone integration)
4. **ngrok** (for local development) - [Install ngrok](https://ngrok.com/download) to expose your local server
5. **Docker** (optional) - [Install Docker](https://docs.docker.com/get-docker/) for containerized deployment


## Built With

- **[@openai/agents](https://www.npmjs.com/package/@openai/agents)** - OpenAI's official SDK for GPT-4 Realtime API
- **[@openai/agents-realtime](https://www.npmjs.com/package/@openai/agents-realtime)** - Real-time audio streaming with OpenAI
- **[Fastify](https://fastify.dev/)** - High-performance web framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript

## SignalWire Setup

### 1. Create Your SignalWire Project

Follow the [SignalWire Getting Started Guide](https://developer.signalwire.com/guides/getting-started) to:
- Create your SignalWire project
- Set up your workspace

### 2. Create a cXML Webhook Resource

Before you can assign webhook URLs, you need to create a cXML webhook resource:

1. In your SignalWire dashboard, go to **My Resources**
2. Click **Create Resource**
3. Select **Script** as the resource type, then select `cXML`.
4. Set the resource to `Handle Using` as `External Url`
5. Set the `Primary Script URL` to your server's **webhook endpoint**:
   
   a. For local development, use ngrok to expose port 5050:
      ```bash
      npx ngrok http 5050
      # Use the HTTPS URL from ngrok + /incoming-call
      # Example: https://abc123.ngrok.io/incoming-call
      ```
   b. For production environments, set your server URL + `/incoming-call`:
      ```
      https://your-domain.com/incoming-call
      ```

   > **🚨 Critical:** You MUST include `/incoming-call` at the end of your URL. This is the specific webhook endpoint that handles incoming calls.
6. Give it a descriptive name (e.g., "AI Voice Assistant")
7. Create the resource

> **📖 Learn More:** Follow the [SignalWire Call Fabric Resources Guide](https://developer.signalwire.com/platform/call-fabric/resources) for detailed instructions.


### 3. Create a SIP Address

To test your AI assistant, create a SIP address that connects to your cXML resource:

1. Now from the resource page of the resource you just created, click the `Addresses * Phone NUmbers` tab
2. Click **Add** to create a new address
3. Select **SIP Address** as the address type
5. Fill out the address information
6. Save the configuration

> **📖 Learn More:** Follow the [SignalWire Call Fabric Addresses Guide](https://developer.signalwire.com/platform/call-fabric/addresses) for detailed SIP address creation.


> **💡 Tip:** You can also purchase a regular [phone number](https://developer.signalwire.com/platform/dashboard/get-started/phone-numbers) and link it to your cXML resource if you prefer traditional phone number calling.

## Quick Start

> **⚠️ Prerequisites:** Make sure you've completed the [Prerequisites](#prerequisites) and [SignalWire Setup](#signalwire-setup) sections above before starting!

### Step 1: Clone and Install
```bash
git clone <repository-url>
cd code/cxml-realtime-agent-stream
npm install
```

### Step 2: Add Your API Key

Choose **ONE** method based on how you'll run the app:

#### 🔵 **Option A: Local Development** (using .env file)
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

#### 🐳 **Option B: Docker Deployment** (using secrets folder)
```bash
mkdir -p secrets
echo "sk-your-actual-api-key-here" > secrets/openai_api_key.txt
```

> **Note:** Never use both methods at the same time. Docker automatically uses the secrets folder, while local development uses .env.

### Step 3: Run Your Assistant

**For Local Development:**
```bash
npm run build
npm start
```

**For Docker:**
```bash
docker-compose up --build signalwire-assistant
```

✅ **Your AI assistant webhook is now running at `http://localhost:5050/incoming-call`**

> **📞 Important:** The `/incoming-call` endpoint is where SignalWire sends call data to trigger your AI assistant. This is the URL you'll configure in your SignalWire cXML resource.

### Step 4: Test It!

**Call the SIP address you created in [Step 3](#3-create-a-sip-address) to test your AI assistant:**

1. **Using a SIP Phone or Softphone:**
   - Dial: `sip:your-sip-address@yourproject.dapp.signalwire.com`
   - Replace with the actual SIP address you created in your SignalWire resource

2. **The call flow will be:**
   - Your SIP call → SignalWire → Your webhook endpoint → AI assistant

> **📱 Alternative:** If you purchased a regular phone number and linked it to your cXML resource, you can also call that number directly.

> **🔧 Troubleshooting:** If you haven't set up ngrok yet, go back to [SignalWire Setup](#signalwire-setup) to expose your local server.

## How It Works

```
Phone Call → SignalWire → Your Server → OpenAI → Real-time Response → Caller
```

1. Someone calls your SignalWire number
2. SignalWire streams the audio to your server via WebSocket
3. Your server forwards it to OpenAI's Realtime API
4. OpenAI processes speech and generates responses instantly
5. Responses stream back to the caller in real-time

The magic is in the real-time streaming—there's no "recording, processing, playing back." It's a continuous, natural conversation.

## Configuration

### Environment Variables

Configure your assistant using the following variables. Each variable is handled differently depending on your deployment method:

| Variable | Local Development | Docker Deployment | Type | Required |
|----------|-------------------|-------------------|------|----------|
| `OPENAI_API_KEY` | `.env` file | Docker secrets file (`secrets/openai_api_key.txt`) | Secret | Yes |
| `PORT` | `.env` file | docker-compose environment section | Environment Variable | No |
| `AUDIO_FORMAT` | `.env` file | docker-compose environment section | Environment Variable | No |

#### Setting Up Variables

**For Local Development:**
Create a `.env` file in your project root:
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
PORT=5050  # optional, defaults to 5050
AUDIO_FORMAT=pcm16  # optional
```

**For Docker Deployment:**
- `OPENAI_API_KEY`: Create `secrets/openai_api_key.txt` with your API key
- `PORT`: Already configured in `docker-compose.yml` (can be modified there)
- `AUDIO_FORMAT`: Already configured in `docker-compose.yml` (can be modified there)

#### Audio Format Options

- `pcm16` - **High Definition Audio (24kHz)** - Crystal clear voice quality, best for demos
- `g711_ulaw` - **Standard Telephony (8kHz)** - Traditional phone quality (default)

> **🔐 Security Note:** Docker uses secrets for sensitive data like API keys, while regular environment variables are used for configuration options.

### Customize Your Assistant

Edit `src/config.ts` to change your AI's personality:

```typescript
export const AGENT_CONFIG = {
  voice: 'alloy',  // Choose: alloy, echo, fable, onyx, nova, shimmer
  instructions: `Your custom personality here...`
}
```

### Add New Capabilities

Create new tools in `src/tools/` - see `weather.tool.ts` for an example.

## Production Deployment

For production deployment, we recommend using Docker. See the [Docker Setup Guide](README.Docker.md) for:
- External secrets management
- Health checks and monitoring
- Docker Swarm configuration
- Troubleshooting tips

## Development

```bash
# Development with hot reload
npm run dev

# Type checking
npm run typecheck

# View debug logs
DEBUG=openai-agents:* npm run dev
```

## Common Issues & Solutions

**"Missing OPENAI_API_KEY"**
- Make sure your `.env` file exists and contains your actual API key

**"SignalWire client connection error"**
- Ensure your webhook URL is publicly accessible (use ngrok for local testing)
- Check that port 5050 is not blocked

**Audio quality issues**
- HD voice requires `L16@24000h` codec in SignalWire webhook
- Standard quality: Remove the codec parameter

**Can't receive calls**
- Verify SignalWire webhook is set to your public URL **with `/incoming-call`** endpoint
- Check ngrok is still running and URL hasn't changed
- Common mistake: Using base URL without `/incoming-call` (calls won't work!)
- Look at console logs for connection messages


## Project Structure

```
src/
├── config.ts          # AI assistant configuration
├── index.ts           # Server setup
├── routes/            # HTTP endpoints
│   ├── webhook.ts     # Handles incoming calls
│   ├── streaming.ts   # WebSocket audio streaming
│   └── health.ts      # Health check endpoint
├── tools/             # AI capabilities (weather, time, etc.)
└── transports/        # SignalWire ↔ OpenAI bridge
```



---

Built with TypeScript, Fastify, and WebSockets. MIT Licensed.