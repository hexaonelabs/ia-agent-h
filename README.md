# Agent H 🤖 

NodeJS Autonomous Agent Manager with direct blockchain interactions and an multiples AI assistant. Inspired by the [EizaOS](https://github.com/elizaOS/eliza) project this agent framework is based on NodeJS and is designed to be modular, extensible and  more easily to use and scale.

<div align="center">
  <img src="./public/images/agent-h-33.jpeg" alt="Agent H Banner" width="100%" />
</div>

## Project Description
Agent H is a NodeJS-based system that orchestrates AI agents with direct blockchain integration. This innovative framework combines modular design, EVM compatibility, and natural language processing to create powerful, decentralized applications. With rapid deployment and easy customization, Agent H empowers developers to build the future of AI-driven blockchain solutions in minutes, not months.
Unleash the power of intelligent, autonomous agents in the decentralized world with Agent H!

## ✨ Features

- **🤖 IA Assistant manager**: orchestrate and manage multiple AI agent
- **🛠️ Highly extensible**: create your own tools and agents assistant
- **🔗 Direct blockchain interactions**: Provide default tools for EVM Blockchain interactions
- **🔒 Secure and private API server Endpoint**: Include a NestJS server that expost Agent to HTTP Request
- **📚 Easily configure & run:** only one programming language framework & configuration based on yml file
- **🚀 Ready to use and deploy** setup & deploy in less than 5 minutes


## 🚀 Quick Start

### Prerequisites

- [Node.js 20+](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [OpenIA API Key](https://platform.openai.com/settings/organization/general)

### Start by clone the repository

```bash
git clone https://github.com/hexaonelabs/ia-agent-h
cd ia-agent-h
cp .env.example .env
```

Once the agent is running, open you browser to `localhost:3000` and you should see the Agent H interface.

### Environment Variables
1. open `.env` file and add your OpenAI API Key, Twitter credentials and other configuration that you want to use.
2. Provide the seed phrase or privateKey of the wallet that you want to use to interact with the blockchain. This wallet will be used to sign transactions and interact with the blockchain.

### Edit Agent character files configuration
1. open `characters/agent-h.yml` file and edit the character name, description and other details. This file provide configurations for the main orchestrator agent. Do not remove this file.
2. add, edit or remove assistant with character file. Each character file will be loaded to generate an assistant based on the configuration provided in the file.

### Agent Controller
Some agent are designed to execute a specific task or to handle a specific type of request. To define an agent with controller, just provide `Ctrl: agents/{AGENT_CTRL}.agent` to the file configuration yml. You can create your own agent controller by creating a new file inside `src/agents` directory and export a Object with a `start()` function that will be called to run dedicated logic.

### Edit tool files configuration
Add, edit or remove tools with file inside `tools/{TOOL_FILE}.yml` directory. Each tool file will be loaded to generate a tool based on the configuration provided in the file. The tool have an `Handler` property that should be the name of the file inside `src/tools` directory that will be used to handle the tool logic. 

You can create your own tools by creating a new file inside `src/tools` directory and export a function that will be called when the tool is used. The function should return data that will be send to the main agent to generate a response to the user.

### Start development server
```bash
npm install
npm run start:dev
```

### Start production server
```bash
npm install
npm run start:prod
```

or you can use `pm2` to run the server in background

```bash
npm install -g pm2
npm install
npm run start:pm2
```

*Note: The server will be running on `localhost:3000` by default. You can change the port by editing the `.env` file. You have multiples auther build in srcipts that you can use to manage the server, lint the code, run test and more. Check the `package.json` file for more information.*

## Contributing
Contributions are welcome and appreciated. To contribute to this project, please fork the repository, create a new branch and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

You can find more information about contributing to this project in the CONTRIBUTING.md file.

## License
This project is open-source and distributed under the MIT License. See LICENSE for more information.

## Core Team
This project is developed by HexaOne Labs, a team that trust in the power of blockchain technology and decentralized finance (DeFi) to build a better world.

## Support
If you like this project, please consider supporting it by giving a ⭐️ on Github and sharing it with your friends!