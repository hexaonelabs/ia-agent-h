# Agent H 🤖 

NodeJS Autonomous Agent with direct blockchain interactions and an AI assistant. Inspired by the [EizaOS]() project this agent framework is based on NodeJS and is designed to be modular and extensible more easily than the original project which is written in Python and requires a lot of dependencies and setup to get started. 

<div align="center">
  <img src="./public/images/agent-h-33.jpeg" alt="Agent H Banner" width="100%" />
</div>

## ✨ Features

- **🛠️ Highly extensible**: create your own tools and agents
- **🔗 Direct blockchain interactions**: no need for external APIs
- **📚 Easily configure & run:** only one programming language framework
- **🚀 Ready to use and deploy** setup & deploy in less than 5 minutes


## 🚀 Quick Start

### Prerequisites

- [Node.js 20+](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

### Start by clone the repository

```bash
git clone https://github.com/hexaonelabs/ia-agent-h
cd ia-agent-h
cp .env.example .env
npm install
npm run start:dev
```

Once the agent is running, open you browser to `localhost:3000` and you should see the Agent H interface.

### Edit the character file
1. open `src/const/prompt.ts`