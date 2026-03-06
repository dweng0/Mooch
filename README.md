# Meet Mooch
<div align="center">
<img src="mooch.svg" width="180" alt="Mooch the bunny"/>

Meet Mooch
</div>

[![Evolution](https://github.com/dweng0/Mooch/actions/workflows/evolve.yml/badge.svg)](https://github.com/dweng0/Mooch/actions/workflows/evolve.yml)
[![Download](https://img.shields.io/github/v/release/dweng0/Mooch?label=Download&logo=github)](https://github.com/dweng0/Mooch/releases/latest)

## Built BAADD: **B**ehaviour-**A**nd **A**I **D**riven **D**evelopment

Mooch is an interview assistant that can help you. It uses ai to listen to your interviewer and gives you live feedback and suggestions.

## Features

- **Real-time feedback** - Mooch listens to your interviewer, transcribes what they are asking, and provides you with real-time feedback and suggestions on how to answer the question.

- **Passive listening** - Mooch listens to your interviewer and gives you bullet points on questions it hears.

- **Coding help** - Take a screenshot of code you need to work on, provide audio context and watch Mooch generate code suggestions for you.

- **Tailor mooch to each interview** - Provide a job description and your resume for context and Mooch will tailor its suggestions to the specific job you are interviewing for.

- **Works with Claude, OpenAI, Gemini and multiple OpenAI compatible LLMS** - Mooch can use any of these LLMs to provide you with feedback and suggestions.

## Written with BADD

Mooch is built and maintained by an AI agent using Behaviour and AI Driven Development. The agent runs on a schedule, reads the BDD spec, picks up GitHub issues, writes tests, ships code, and closes the loop — no human in the loop required.

**1. The agent wakes up and starts an evolution session**

![BAADD agent starting an evolution session](resources/cleanupshop.png)

**2. It reads open issues and turns them into BDD scenarios**

![Agent turns owner issues into BDD features](resources/turns-owner-issues-into-BDD-features.png)

**3. It writes tests, implements the feature, and commits**

![Agent commits changes](resources/commit-changes.png)

**4. It comments on the issue with the commit reference and closes it**

![Agent responds to issues](resources/responds-to-messages.png)

