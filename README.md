# Luma

> Your life. Illuminated.

Luma is a private AI life companion that helps you grow in your career, develop your interests, manage daily tasks, draft communications, and navigate life — beautifully, intelligently, and completely privately on your own machine.

## What Luma Does

Luma is not a generic chatbot. It knows you personally — your career, your goals, your interests — and every response adapts to your life. The more you share, the more personalized and powerful it becomes.

**Growth**
- Career development coaching and guidance
- Interest and hobby development plans
- Personalized learning paths for any topic
- Goal setting and progress tracking

**Daily Life Management**
- Task and reminder management
- Email and message drafting
- Decision support with clear reasoning
- Weekly planning and organization

**Personal Companion**
- Morning briefings tailored to your day
- Overwhelm support and prioritization
- Life advice grounded in your personal context
- Always available, always private

## Features

- Beautiful warm dark interface with gold accents
- Personal profile — tell Luma who you are and what you care about
- Task manager with Luma-powered prioritization
- 8 quick command shortcuts for common needs
- Full chat interface with conversation memory
- Ollama status indicator — always know if your AI is connected
- 100% local — no data ever leaves your machine

## Privacy

Luma runs entirely on your own computer using Ollama. Your conversations, your goals, your personal information — none of it is sent to any external server. No subscriptions to OpenAI. No data harvesting. No ads. Just your AI, your data, your life.

## Setup

1. Install Ollama from ollama.com

2. Pull the required model:
ollama pull mistral-nemo

3. Clone and run:
git clone https://github.com/deandremedrano/luma.git
cd luma
npm install
npm run dev

4. Open your browser to http://localhost:5173

5. Go to Profile and tell Luma about yourself for personalized responses

## Tech Stack

- React + Vite
- Ollama (local AI runtime)
- Mistral Nemo 12B (runs locally on your Mac)
- No backend — runs entirely in your browser connected to local Ollama

## The Luma Family
Luma Personal     — this app — for individuals
Luma Enterprise   — for companies and teams (coming soon)

## Author

Built by Deandre Medrano
GitHub: github.com/deandremedrano
