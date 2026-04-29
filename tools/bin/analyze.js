#!/usr/bin/env node
import { detectVelocitySpikes, detectSentimentFlips, detectNewEntrants, detectSqueezeLanguage, detectOptionsSurge } from '../wsb-analyze.js';

const input = JSON.parse(process.argv[2]);
const command = input.command;

const commands = {
  'velocity': () => detectVelocitySpikes(input.current, input.history),
  'sentiment': () => detectSentimentFlips(input.current, input.previous),
  'new-entrants': () => detectNewEntrants(input.current, new Set(input.historicalTickers)),
  'squeeze': () => detectSqueezeLanguage(input.posts),
  'options': () => detectOptionsSurge(input.current, input.history),
  'full': () => ({
    velocitySpikes: detectVelocitySpikes(input.current, input.history),
    sentimentFlips: detectSentimentFlips(input.current, input.previous),
    newEntrants: detectNewEntrants(input.current, new Set(input.historicalTickers)),
    squeezeCandidates: detectSqueezeLanguage(input.posts),
    optionsSurges: detectOptionsSurge(input.currentOptions, input.optionsHistory),
  }),
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

console.log(JSON.stringify(commands[command](), null, 2));
